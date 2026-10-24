"""Contracts over the actual completed run, filesystem and downloaded bytes; no new DOM or capture."""
import copy
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
import zipfile
import collect as collector
import extract

repository, evidence = map(Path, sys.argv[1:3])
del sys.argv[1:3]
read = lambda filename: json.loads(filename.read_text(encoding='utf-8'))
run = read(evidence / 'run.json')
jobs = read(evidence / 'jobs.json')
artifact = read(evidence / 'artifacts.json')['artifacts'][0]


class ColdStudyTransport(unittest.TestCase):
    def test_actual_run_and_job(self):
        collector.authenticate_run(run, jobs)

    def test_source_cannot_be_substituted(self):
        changed = copy.deepcopy(run)
        changed['head_sha'] = '0' * 40
        with self.assertRaises(AssertionError):
            collector.authenticate_run(changed, jobs)

    def test_run_cannot_be_substituted(self):
        changed = copy.deepcopy(run)
        changed['id'] += 1
        with self.assertRaises(AssertionError):
            collector.authenticate_run(changed, jobs)

    def test_attempt_two_cannot_borrow_authorization(self):
        changed = copy.deepcopy(run)
        changed['run_attempt'] = 2
        with self.assertRaises(AssertionError):
            collector.authenticate_run(changed, jobs)

    def test_job_cannot_be_substituted(self):
        changed = copy.deepcopy(jobs)
        changed['jobs'][0]['id'] += 1
        with self.assertRaises(AssertionError):
            collector.authenticate_run(run, changed)

    def test_workflow_cannot_be_substituted(self):
        changed = copy.deepcopy(run)
        changed['path'] = '.github/workflows/ci.yml'
        with self.assertRaises(AssertionError):
            collector.authenticate_run(changed, jobs)

    def test_actual_zip_matches_api_identity_digest_size_and_crc(self):
        collector.authenticate_artifact(artifact, evidence / 'artifact.zip')

    def test_another_artifact_id_is_rejected(self):
        changed = copy.deepcopy(artifact)
        changed['id'] += 1
        with self.assertRaises(AssertionError):
            collector.authenticate_artifact(changed, evidence / 'artifact.zip')

    def test_another_artifact_run_is_rejected(self):
        changed = copy.deepcopy(artifact)
        changed['workflow_run']['id'] += 1
        with self.assertRaises(AssertionError):
            collector.authenticate_artifact(changed, evidence / 'artifact.zip')

    def test_changed_bytes_cannot_borrow_digest(self):
        with tempfile.TemporaryDirectory(prefix='rustdom-cold-byte-') as temporary:
            filename = Path(temporary) / 'changed.zip'
            content = bytearray((evidence / 'artifact.zip').read_bytes())
            content[-1] ^= 1
            filename.write_bytes(content)
            with self.assertRaises(AssertionError):
                collector.authenticate_artifact(artifact, filename)

    def test_wrong_artifact_size_is_rejected(self):
        changed = copy.deepcopy(artifact)
        changed['size_in_bytes'] += 1
        with self.assertRaises(AssertionError):
            collector.authenticate_artifact(changed, evidence / 'artifact.zip')

    def test_expired_artifact_is_rejected(self):
        changed = copy.deepcopy(artifact)
        changed['expired'] = True
        with self.assertRaises(AssertionError):
            collector.authenticate_artifact(changed, evidence / 'artifact.zip')

    def test_unmarked_nonempty_collection_preserves_foreign_data_before_api(self):
        with tempfile.TemporaryDirectory(prefix='rustdom-cold-owner-') as temporary:
            output = Path(temporary) / 'collection'
            output.mkdir()
            sentinel = output / 'run.json'
            sentinel.write_bytes(b'foreign data')
            with self.assertRaises(AssertionError):
                collector.collect(repository, output, False)
            self.assertEqual(sentinel.read_bytes(), b'foreign data')
            self.assertEqual([filename.name for filename in output.iterdir()], ['run.json'])

    def test_wrong_ownership_marker_is_rejected_before_api(self):
        with tempfile.TemporaryDirectory(prefix='rustdom-cold-other-owner-') as temporary:
            output = Path(temporary) / 'collection'
            output.mkdir()
            marker = output / collector.POLICY['ownerFile']
            marker.write_bytes(b'{}')
            with self.assertRaises(AssertionError):
                collector.collect(repository, output, False)
            self.assertEqual(marker.read_bytes(), b'{}')
            self.assertEqual(len(list(output.iterdir())), 1)

    def test_extraction_refuses_wrong_source_before_creating_output(self):
        with tempfile.TemporaryDirectory(prefix='rustdom-cold-source-') as temporary:
            collection = Path(temporary) / 'collection'
            collection.mkdir()
            state = read(evidence / 'collection.json')
            state['head'] = '0' * 40
            (collection / 'collection.json').write_text(json.dumps(state))
            destination = Path(temporary) / 'archive'
            with self.assertRaises(AssertionError):
                extract.extract(repository, collection, destination)
            self.assertFalse(destination.exists())

    def test_coherently_resealed_replacement_cannot_redefine_published_pins(self):
        with tempfile.TemporaryDirectory(prefix='rustdom-cold-resealed-') as temporary:
            collection = Path(temporary) / 'collection'
            collection.mkdir()
            state = read(evidence / 'collection.json')
            tar = collection / collector.TAR_NAME
            tar.write_bytes(b'substituted archive')
            filename = collection / 'artifact.zip'
            with zipfile.ZipFile(filename, 'w') as archive:
                archive.write(tar, collector.TAR_NAME)
            state.update(tarSha256=hashlib.sha256(tar.read_bytes()).hexdigest(),
                         zipSha256=hashlib.sha256(filename.read_bytes()).hexdigest())
            (collection / 'collection.json').write_text(json.dumps(state))
            destination = Path(temporary) / 'archive'
            with self.assertRaises(AssertionError):
                extract.extract(repository, collection, destination)
            self.assertFalse(destination.exists())

    def test_unqualified_policy_cannot_extract_before_destination(self):
        with tempfile.TemporaryDirectory(prefix='rustdom-cold-unqualified-') as temporary:
            destination = Path(temporary) / 'archive'
            original = extract.POLICY
            extract.POLICY = {**original, 'artifactId': None}
            try:
                with self.assertRaises(RuntimeError):
                    extract.extract(repository, evidence, destination)
                self.assertFalse(destination.exists())
            finally:
                extract.POLICY = original

    def test_optimized_entrypoints_fail_before_mutation(self):
        with tempfile.TemporaryDirectory(prefix='rustdom-cold-optimized-') as temporary:
            for name in ['collect.py', 'extract.py']:
                destination = Path(temporary) / name
                process = subprocess.run([sys.executable, '-O', str(Path(__file__).with_name(name)),
                    str(repository), str(evidence), str(destination)], capture_output=True, text=True)
                self.assertNotEqual(process.returncode, 0)
                self.assertIn('non-optimized Python', process.stderr)
                self.assertFalse(destination.exists())


if __name__ == '__main__':
    unittest.main(verbosity=2)
