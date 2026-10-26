"""Exercise real hosted data and reject damaged/coherently resealed data without executing it."""
import contextlib
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import types
import unittest

location = Path(__file__).with_name('verify.py')
reader = types.ModuleType('current_pilot_hosted_reader'); reader.__file__ = str(location)
exec(compile(location.read_bytes(), str(location), 'exec'), reader.__dict__)
dataset = location.parent.parent / '40286292347'

class HostedCalendarContracts(unittest.TestCase):
    @contextlib.contextmanager
    def copy(self):
        with tempfile.TemporaryDirectory(prefix='pilot-hosted-input-') as temporary:
            target = Path(temporary) / 'dataset'; shutil.copytree(dataset, target)
            yield target

    def test_actual_two_jobs_and_identical_complete_calendars(self):
        result = reader.verify(dataset)
        self.assertEqual(result['jobsPassed'], 2)
        self.assertEqual(sum(item['testsPassed'] for item in result['artifacts']), 12)
        self.assertFalse(result['scientificCaptureExecuted']); self.assertIsNone(result['performanceAccepted'])

    def test_changed_commit_rejected(self):
        with self.copy() as target:
            path = target / 'run.json'; run = json.loads(path.read_bytes()); run['head_sha'] = '0' * 40
            path.write_bytes(json.dumps(run).encode())
            with self.assertRaises(AssertionError): reader.verify(target)

    def test_coherent_reseal_with_input_policy_cannot_replace_independent_pins(self):
        with self.copy() as target:
            archive = b'changed zip'; path = target / '22.12.0-artifact.zip'; path.write_bytes(archive)
            metadata_path = target / '22.12.0-metadata.json'; metadata = json.loads(metadata_path.read_bytes())
            metadata.update(size_in_bytes=len(archive), digest='sha256:' + reader.checksum(archive))
            metadata_path.write_bytes(json.dumps(metadata).encode())
            policy = json.loads(json.dumps(reader.POLICY))
            policy['files'][path.name] = reader.checksum(archive)
            policy['files'][metadata_path.name] = reader.checksum(metadata_path.read_bytes())
            (target / 'policy.json').write_bytes(json.dumps(policy).encode())
            with self.assertRaises(AssertionError): reader.verify(target)

    def test_truncated_job_log_rejected(self):
        with self.copy() as target:
            (target / '24.14.1-job.log').write_bytes(b'partial')
            with self.assertRaises(AssertionError): reader.verify(target)

    def test_missing_member_manifest_rejected(self):
        with self.copy() as target:
            (target / '22.12.0-members.json').unlink()
            with self.assertRaises(AssertionError): reader.verify(target)

    def test_optimized_cli_rejected(self):
        result = subprocess.run([sys.executable, '-O', str(location), str(dataset)], capture_output=True)
        self.assertNotEqual(result.returncode, 0); self.assertIn(b'non-optimized Python', result.stderr)

    def test_registered_variance_producer_has_eleven_plus_six_contracts(self):
        result = reader.verify(dataset.with_name('40288143186'), '40288143186')
        self.assertEqual(result['runId'], 40288143186)
        self.assertEqual(sum(item['testsPassed'] for item in result['artifacts']), 22)
        self.assertEqual(sum(item['readerTestsPassed'] for item in result['artifacts']), 12)
        self.assertFalse(result['scientificCaptureExecuted'])

    def test_old_producer_cannot_satisfy_variance_policy(self):
        with self.assertRaises(AssertionError): reader.verify(dataset, '40288143186')

    def test_policy_selector_cannot_escape_registered_current_code(self):
        for selector in ['../policy', '/absolute', '40288143186.json', '４０２８８１４３１８６']:
            with self.subTest(selector=selector), self.assertRaises(ValueError): reader.verify(dataset, selector)

if __name__ == '__main__': unittest.main()
