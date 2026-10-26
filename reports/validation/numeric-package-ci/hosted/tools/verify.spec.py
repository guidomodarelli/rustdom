"""Exercise authentic functional artifacts and coherently damaged independent input trees."""
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
reader = types.ModuleType('current_numeric_hosted_reader')
reader.__file__ = str(location)
exec(compile(location.read_bytes(), str(location), 'exec'), reader.__dict__)
dataset = location.parent.parent / '40277876693'

class HostedPackageContracts(unittest.TestCase):
    @contextlib.contextmanager
    def copied_data(self):
        with tempfile.TemporaryDirectory(prefix='numeric-hosted-data-') as temporary:
            target = Path(temporary) / 'dataset'
            shutil.copytree(dataset, target)
            yield target

    def test_actual_two_jobs_and_twelve_memory_endpoints(self):
        result = reader.verify(dataset)
        self.assertEqual(result['jobsPassed'], 2)
        self.assertEqual(sum(len(state['cycles']) for artifact in result['artifacts'] for state in artifact.get('memory', [])), 12)
        self.assertFalse(result['producerCanonicalIndexSealPresent'])
        self.assertIsNone(result['performanceAccepted'])

    def test_modified_run_identity_rejected(self):
        with self.copied_data() as target:
            run = json.loads((target / 'run.json').read_bytes()); run['head_sha'] = '0' * 40
            (target / 'run.json').write_text(json.dumps(run), encoding='utf-8')
            with self.assertRaises(AssertionError):
                reader.verify(target)

    def test_coherent_reseal_including_input_policy_cannot_replace_trusted_policy(self):
        with self.copied_data() as target:
            artifact_id = next(iter(reader.POLICY['artifacts']))
            directory = target / ('artifact-' + artifact_id)
            archive = b'changed purported archive'; (directory / 'artifact.zip').write_bytes(archive)
            metadata = json.loads((directory / 'metadata.json').read_bytes())
            metadata['size_in_bytes'] = len(archive); metadata['digest'] = 'sha256:' + reader.checksum(archive)
            metadata_raw = json.dumps(metadata).encode(); (directory / 'metadata.json').write_bytes(metadata_raw)
            fake_policy = json.loads((target / 'policy.json').read_bytes())
            fake_policy['artifacts'][artifact_id].update(bytes=len(archive), sha256=reader.checksum(archive), metadataSha256=reader.checksum(metadata_raw))
            (target / 'policy.json').write_text(json.dumps(fake_policy), encoding='utf-8')
            with self.assertRaises(AssertionError):
                reader.verify(target)

    def test_incomplete_job_log_rejected(self):
        with self.copied_data() as target:
            artifact_id = next(iter(reader.POLICY['artifacts']))
            (target / ('artifact-' + artifact_id) / 'job.log').write_bytes(b'partial log')
            with self.assertRaises(AssertionError):
                reader.verify(target)

    def test_missing_member_manifest_rejected(self):
        with self.copied_data() as target:
            artifact_id = next(iter(reader.POLICY['artifacts']))
            (target / ('artifact-' + artifact_id) / 'members.json').unlink()
            with self.assertRaises(FileNotFoundError):
                reader.verify(target)

    def test_optimized_cli_rejected(self):
        result = subprocess.run([sys.executable, '-O', str(location), str(dataset)], capture_output=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn(b'non-optimized Python', result.stderr)

if __name__ == '__main__':
    unittest.main()
