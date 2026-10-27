"""Exercise real hosted bundles and damaged independent transport copies."""
import contextlib
import importlib.util
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
import types

location = Path(__file__).with_name('verify.py')
reader = types.ModuleType('current_hosted_reader')
reader.__file__ = str(location)
exec(compile(location.read_bytes(), str(location), 'exec'), reader.__dict__)
repository = Path(sys.argv.pop(1)).resolve(strict=True)

class HostedContracts(unittest.TestCase):
    @contextlib.contextmanager
    def independent_copy(self):
        artifact_id, pin = next(iter(reader.PINS['artifacts'].items()))
        source = reader.ROOT / 'confirmed' / pin['kind'] / ('artifact-' + artifact_id)
        with tempfile.TemporaryDirectory() as temporary:
            target = Path(temporary)
            for filename in ['metadata.json', 'job.json', 'job.log', 'members.json', 'artifact.zip']:
                shutil.copyfile(source / filename, target / filename)
            yield target, int(artifact_id)

    def test_all_eighteen_actual_bundles_and_memory_endpoints(self):
        result = reader.verify_all(repository)
        self.assertEqual(result['functionalJobsPassed'], 18)
        self.assertTrue(result['generalCiPassed'])
        self.assertFalse(result['historicalOwnershipGatePassed'])
        self.assertIsNone(result['performanceAccepted'])
        self.assertEqual(sum(len(probe['endpoints']) for item in result['artifacts'] for probe in item['memory']), 216)

    def test_wrong_attempt_rejected(self):
        with self.independent_copy() as (target, artifact_id):
            job = json.loads((target / 'job.json').read_bytes()); job['run_attempt'] = 2
            (target / 'job.json').write_text(json.dumps(job), encoding='utf-8')
            with self.assertRaises(AssertionError):
                reader.verify_artifact(repository, target, artifact_id)

    def test_wrong_node_rejected(self):
        with self.independent_copy() as (target, artifact_id):
            metadata = json.loads((target / 'metadata.json').read_bytes()); metadata['name'] = metadata['name'].replace('24.14.1', '24.0.0').replace('22.12.0', '22.0.0').replace('24.20.0', '24.0.0')
            (target / 'metadata.json').write_text(json.dumps(metadata), encoding='utf-8')
            with self.assertRaises(AssertionError):
                reader.verify_artifact(repository, target, artifact_id)

    def test_corrupted_zip_rejected(self):
        with self.independent_copy() as (target, artifact_id):
            archive = target / 'artifact.zip'
            raw = archive.read_bytes(); archive.write_bytes(raw[:-32] + b'corrupt')
            with self.assertRaises(AssertionError):
                reader.verify_artifact(repository, target, artifact_id)

    def test_coherently_resealed_metadata_cannot_change_independent_pins(self):
        with self.independent_copy() as (target, artifact_id):
            archive = target / 'artifact.zip'; archive.write_bytes(b'fake complete archive')
            metadata = json.loads((target / 'metadata.json').read_bytes())
            metadata['size_in_bytes'] = archive.stat().st_size
            metadata['digest'] = 'sha256:' + reader.checksum(archive.read_bytes())
            (target / 'metadata.json').write_text(json.dumps(metadata), encoding='utf-8')
            (target / 'members.json').write_text(json.dumps({'files': {}}), encoding='utf-8')
            with self.assertRaises(AssertionError):
                reader.verify_artifact(repository, target, artifact_id)

    def test_incomplete_log_rejected(self):
        with self.independent_copy() as (target, artifact_id):
            (target / 'job.log').write_bytes(b'partial')
            with self.assertRaises(AssertionError):
                reader.verify_artifact(repository, target, artifact_id)

    def test_missing_member_manifest_rejected(self):
        with self.independent_copy() as (target, artifact_id):
            (target / 'members.json').unlink()
            with self.assertRaises(FileNotFoundError):
                reader.verify_artifact(repository, target, artifact_id)

    def test_optimized_cli_rejected(self):
        result = subprocess.run([sys.executable, '-O', str(location), str(repository)], capture_output=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn(b'non-optimized Python', result.stderr)

if __name__ == '__main__':
    unittest.main()
