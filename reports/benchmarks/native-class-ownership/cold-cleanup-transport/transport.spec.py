"""Exercise the real hosted transport and damaged copies, without SDK mocks or DOM execution."""
import copy
import importlib.util
import json
import os
from pathlib import Path
import py_compile
import shutil
import subprocess
import sys
import tempfile
import unittest

evidence = Path(sys.argv.pop(1)).resolve()
repository = Path(__file__).resolve().parents[4]
spec = importlib.util.spec_from_file_location('cold_preparation_collection', Path(__file__).with_name('collect.py'))
collector = importlib.util.module_from_spec(spec)
spec.loader.exec_module(collector)
import extract

run = json.loads((evidence / collector.FILES['run']).read_text(encoding='utf-8'))
jobs = json.loads((evidence / collector.FILES['jobs']).read_text(encoding='utf-8'))
artifact_list = json.loads((evidence / collector.FILES['artifacts']).read_text(encoding='utf-8'))['artifacts']
artifact = next(item for item in artifact_list if item['id'] == collector.POLICY['artifactId'])


class TransportContracts(unittest.TestCase):
    def test_real_run_and_job_are_bound_to_the_declared_source(self):
        collector.authenticate_run(run, jobs)

    def test_another_commit_is_rejected(self):
        altered = copy.deepcopy(run)
        altered['head_sha'] = '0' * 40
        with self.assertRaises(AssertionError):
            collector.authenticate_run(altered, jobs)

    def test_another_run_is_rejected(self):
        altered = copy.deepcopy(run)
        altered['id'] += 1
        with self.assertRaises(AssertionError):
            collector.authenticate_run(altered, jobs)

    def test_another_attempt_is_rejected(self):
        altered = copy.deepcopy(run)
        altered['run_attempt'] += 1
        with self.assertRaises(AssertionError):
            collector.authenticate_run(altered, jobs)

    def test_another_job_is_rejected(self):
        altered = copy.deepcopy(jobs)
        altered['jobs'][0]['id'] += 1
        with self.assertRaises(AssertionError):
            collector.authenticate_run(run, altered)

    def test_another_workflow_is_rejected(self):
        altered = copy.deepcopy(run)
        altered['path'] = '.github/workflows/another.yml'
        with self.assertRaises(AssertionError):
            collector.authenticate_run(altered, jobs)

    def test_unconsumed_upstream_metadata_is_compatible(self):
        extended = copy.deepcopy(run)
        extended['future_metadata'] = {'unrelated': True}
        collector.authenticate_run(extended, jobs)
        extended_artifact = copy.deepcopy(artifact)
        extended_artifact['future_metadata'] = [1, 2]
        collector.authenticate_artifact(extended_artifact, evidence / collector.FILES['zip'])

    def test_actual_zip_matches_api_identity_digest_size_and_crc(self):
        collector.authenticate_artifact(artifact, evidence / collector.FILES['zip'])

    def test_one_changed_zip_byte_is_rejected(self):
        with tempfile.TemporaryDirectory(prefix='rustdom-cold-zip-') as temporary:
            filename = Path(temporary) / 'changed.zip'
            shutil.copyfile(evidence / collector.FILES['zip'], filename)
            with filename.open('r+b') as content:
                content.seek(-1, 2)
                value = content.read(1)[0]
                content.seek(-1, 2)
                content.write(bytes([value ^ 1]))
            with self.assertRaises(AssertionError):
                collector.authenticate_artifact(artifact, filename)

    def test_another_artifact_id_is_rejected(self):
        altered = copy.deepcopy(artifact)
        altered['id'] += 1
        with self.assertRaises(AssertionError):
            collector.authenticate_artifact(altered, evidence / collector.FILES['zip'])

    def test_artifact_from_another_run_is_rejected(self):
        altered = copy.deepcopy(artifact)
        altered['workflow_run']['id'] += 1
        with self.assertRaises(AssertionError):
            collector.authenticate_artifact(altered, evidence / collector.FILES['zip'])

    def test_another_api_digest_cannot_replace_the_pin(self):
        altered = copy.deepcopy(artifact)
        altered['digest'] = 'sha256:' + '0' * 64
        with self.assertRaises(AssertionError):
            collector.authenticate_artifact(altered, evidence / collector.FILES['zip'])

    def test_collection_preserves_nonempty_unowned_output(self):
        with tempfile.TemporaryDirectory(prefix='rustdom-cold-existing-') as temporary:
            directory = Path(temporary)
            sentinel = directory / collector.FILES['run']
            sentinel.write_text('user data', encoding='utf-8')
            with self.assertRaises(FileExistsError):
                collector.collect(repository, directory, True)
            self.assertEqual(sentinel.read_text(encoding='utf-8'), 'user data')
            self.assertEqual([filename.name for filename in directory.iterdir()], [sentinel.name])

    def test_wrong_source_extraction_rejects_before_creating_output(self):
        with tempfile.TemporaryDirectory(prefix='rustdom-cold-source-') as temporary:
            directory = Path(temporary)
            state = json.loads((evidence / collector.FILES['state']).read_text(encoding='utf-8'))
            state['head'] = '0' * 40
            (directory / collector.FILES['state']).write_text(json.dumps(state), encoding='utf-8')
            target = directory / 'output'
            with self.assertRaises(AssertionError):
                extract.extract(repository, directory, target)
            self.assertFalse(target.exists())

    def test_extraction_preserves_existing_output_and_user_file(self):
        with tempfile.TemporaryDirectory(prefix='rustdom-cold-extract-') as temporary:
            directory = Path(temporary)
            sentinel = directory / 'user.txt'
            sentinel.write_text('preserve', encoding='utf-8')
            with self.assertRaises(FileExistsError):
                extract.extract(repository, evidence, directory)
            self.assertEqual(sentinel.read_text(encoding='utf-8'), 'preserve')
            self.assertEqual([filename.name for filename in directory.iterdir()], ['user.txt'])

    def test_optimized_python_cannot_disable_integrity_checks(self):
        with tempfile.TemporaryDirectory(prefix='rustdom-cold-optimized-') as temporary:
            target = Path(temporary) / 'output'
            for name, arguments in [('collect.py', [repository, target]), ('extract.py', [repository, evidence, target])]:
                command = [sys.executable, '-O', str(Path(__file__).with_name(name)), *map(str, arguments)]
                child = subprocess.run(command, capture_output=True, text=True)
                self.assertNotEqual(child.returncode, 0)
                self.assertIn('non-optimized Python', child.stderr)
                self.assertFalse(target.exists())

    def test_a_matching_bytecode_cache_cannot_replace_the_verified_extractor(self):
        with tempfile.TemporaryDirectory(prefix='rustdom-cold-bytecode-') as temporary:
            directory = Path(temporary)
            helper = directory / collector.POLICY['extractorPath']
            helper.parent.mkdir(parents=True)
            trusted = (repository / collector.POLICY['extractorPath']).read_bytes()
            malicious = b'raise RuntimeError("untrusted bytecode cache executed")\n'
            helper.write_bytes(malicious + b'#' + b' ' * (len(trusted) - len(malicious) - 1))
            timestamp = helper.stat().st_mtime_ns
            py_compile.compile(str(helper), doraise=True, invalidation_mode=py_compile.PycInvalidationMode.TIMESTAMP)
            helper.write_bytes(trusted)
            os.utime(helper, ns=(timestamp, timestamp))
            control_spec = importlib.util.spec_from_file_location('negative_bytecode_control', helper)
            control = importlib.util.module_from_spec(control_spec)
            with self.assertRaisesRegex(RuntimeError, 'untrusted bytecode cache executed'):
                control_spec.loader.exec_module(control)
            destination = directory / 'existing'
            destination.mkdir()
            sentinel = destination / 'user.txt'
            sentinel.write_text('preserve', encoding='utf-8')
            with self.assertRaises(FileExistsError):
                extract.extract(directory, evidence, destination)
            self.assertEqual(sentinel.read_text(encoding='utf-8'), 'preserve')


if __name__ == '__main__':
    unittest.main()
