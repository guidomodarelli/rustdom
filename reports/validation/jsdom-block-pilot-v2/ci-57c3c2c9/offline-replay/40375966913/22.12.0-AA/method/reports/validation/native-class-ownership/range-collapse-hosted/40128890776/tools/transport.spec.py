"""Exercise real saved API/ZIP data and ownership failures without platform/library mocks or DOM."""
import copy
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import unittest
import zipfile
import collect
from test_support import owned_temporary

repository, evidence = map(Path, sys.argv[1:3])
del sys.argv[1:3]
run = json.loads((evidence / 'run.json').read_bytes())
jobs = json.loads((evidence / 'jobs.json').read_bytes())
profile = next(job for job in collect.POLICY['jobs'] if job['key'] == collect.POLICY['prospectivePerformanceBuildProfile'])
metadata = json.loads((evidence / profile['key'] / 'artifact.json').read_bytes())
archive = evidence / profile['key'] / 'artifact.zip'


class ActualRangeBuildTransport(unittest.TestCase):
    def test_actual_build_and_six_job_identities_match(self):
        collect.authenticate_run(run, jobs)

    def test_another_head_cannot_borrow_this_build(self):
        changed = copy.deepcopy(run)
        changed['head_sha'] = '0' * 40
        with self.assertRaises(AssertionError):
            collect.authenticate_run(changed, jobs)

    def test_another_run_or_attempt_is_rejected(self):
        for field, value in [('id', run['id'] + 1), ('run_attempt', 2)]:
            with self.subTest(field=field):
                changed = copy.deepcopy(run)
                changed[field] = value
                with self.assertRaises(AssertionError):
                    collect.authenticate_run(changed, jobs)

    def test_a_substituted_matrix_job_is_rejected(self):
        changed = copy.deepcopy(jobs)
        changed['jobs'][0]['id'] += 1
        with self.assertRaises(AssertionError):
            collect.authenticate_run(run, changed)

    def test_compatible_provider_metadata_additions_do_not_change_consumed_identity(self):
        changed = {**run, 'futureProviderMetadata': {'unrelated': ['new', None]}}
        collect.authenticate_run(changed, jobs)

    def test_original_zip_matches_actual_api_name_size_digest_and_crc(self):
        collect.authenticate_artifact(metadata, archive, profile)

    def test_expiry_metadata_does_not_destroy_an_already_preserved_pinned_archive(self):
        collect.authenticate_artifact({**metadata, 'expired': True}, archive, profile)

    def test_another_artifact_id_or_source_is_rejected(self):
        changed = copy.deepcopy(metadata)
        changed['id'] += 1
        with self.assertRaises(AssertionError):
            collect.authenticate_artifact(changed, archive, profile)
        changed = copy.deepcopy(metadata)
        changed['workflow_run']['head_sha'] = '0' * 40
        with self.assertRaises(AssertionError):
            collect.authenticate_artifact(changed, archive, profile)

    def test_one_changed_byte_is_not_authenticated(self):
        with owned_temporary() as temporary:
            filename = temporary / 'changed.zip'
            content = bytearray(archive.read_bytes())
            content[-1] ^= 1
            filename.write_bytes(content)
            with self.assertRaises(AssertionError):
                collect.authenticate_artifact(metadata, filename, profile)

    def test_coherently_resealed_bytes_and_metadata_cannot_redefine_the_independent_pins(self):
        with owned_temporary() as temporary:
            filename = temporary / 'resealed.zip'
            with zipfile.ZipFile(filename, 'w') as altered:
                altered.writestr('replacement.txt', 'different evidence')
            changed = copy.deepcopy(metadata)
            changed.update(size_in_bytes=filename.stat().st_size, digest='sha256:' + hashlib.sha256(filename.read_bytes()).hexdigest())
            with self.assertRaises(AssertionError):
                collect.authenticate_artifact(changed, filename, profile)

    def test_an_unmarked_nonempty_destination_is_preserved_before_any_api_call(self):
        with owned_temporary() as temporary:
            output = temporary / 'collection'
            output.mkdir()
            sentinel = output / 'run.json'
            sentinel.write_bytes(b'foreign evidence')
            with self.assertRaises(AssertionError):
                collect.collect(repository, output, False)
            self.assertEqual(sentinel.read_bytes(), b'foreign evidence')
            self.assertEqual([filename.name for filename in output.iterdir()], ['run.json'])

    def test_a_wrong_ownership_marker_is_preserved_before_any_api_call(self):
        with owned_temporary() as temporary:
            output = temporary / 'collection'
            output.mkdir()
            marker = output / collect.POLICY['ownerFile']
            marker.write_bytes(b'{}')
            with self.assertRaises(AssertionError):
                collect.collect(repository, output, False)
            self.assertEqual(marker.read_bytes(), b'{}')
            self.assertEqual(len(list(output.iterdir())), 1)

    def test_optimized_entrypoints_fail_before_creating_output(self):
        with owned_temporary() as temporary:
            for name in ['collect.py', 'archive_reader.py']:
                destination = temporary / name
                result = subprocess.run([sys.executable, '-O', str(Path(__file__).with_name(name)), str(repository), str(destination)],
                    capture_output=True, text=True)
                self.assertNotEqual(result.returncode, 0)
                self.assertIn('non-optimized Python', result.stderr)
                self.assertFalse(destination.exists())


if __name__ == '__main__':
    unittest.main(verbosity=2)
