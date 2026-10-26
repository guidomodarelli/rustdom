"""Exercise the data reader with actual hosted archives and independent corrupted transport copies."""
import contextlib
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import shutil
import sys
import tempfile
import unittest
import zipfile

repository = Path(sys.argv[1]).resolve(strict=True)
location = Path(__file__).with_name('verify.py')
specification = importlib.util.spec_from_file_location('current_hosted_reader', location)
reader = importlib.util.module_from_spec(specification)
specification.loader.exec_module(reader)
collection = Path(sys.argv[2]).resolve(strict=True)
artifact_ids = [12625768503, *sorted(int(artifact) for artifact in reader.POLICY['artifacts'] if artifact != '12625768503')]
fixtures = [collection / ('artifact-' + str(artifact)) for artifact in artifact_ids]

class HostedReaderContracts(unittest.TestCase):
    def test_real_matrix_complete_receipts(self):
        for fixture in fixtures:
            with self.subTest(artifact=fixture.name):
                result = reader.verify(repository, fixture)
                self.assertTrue(result['qualified'])
                self.assertEqual(result['commandsPassed'], 19)
                self.assertEqual(result['wpt']['fixtures'], 240)
                self.assertFalse(result['wpt']['complete'])
                self.assertIsNone(result['performanceAccepted'])
                self.assertEqual([len(endpoints) for endpoints in result['memoryEndpoints']], [6, 6])

    @contextlib.contextmanager
    def changed_transport(self):
        with tempfile.TemporaryDirectory(prefix='composed-reader-negative-', dir=repository / '.cache') as temporary:
            directory = Path(temporary)
            os.link(fixtures[0] / 'artifact.zip', directory / 'artifact.zip')
            for name in ['metadata.json', 'members.json', 'job.json']:
                shutil.copyfile(fixtures[0] / name, directory / name)
            yield directory

    def reject_change(self, filename, change):
        with self.changed_transport() as directory:
            value = json.loads((directory / filename).read_bytes())
            change(value)
            (directory / filename).write_text(json.dumps(value), encoding='utf-8')
            with self.assertRaises(AssertionError):
                reader.verify(repository, directory)

    def test_other_run_is_rejected(self):
        self.reject_change('metadata.json', lambda record: record['workflow_run'].update(id=40260877389))

    def test_other_commit_is_rejected(self):
        self.reject_change('metadata.json', lambda record: record['workflow_run'].update(head_sha='8dc0513ac7aa8a63b73161ac79249bcb392fd981'))

    def test_other_attempt_is_rejected(self):
        self.reject_change('members.json', lambda record: record.update(attempt=2))

    def test_incomplete_member_manifest_is_rejected(self):
        self.reject_change('members.json', lambda record: record['files'].pop(next(iter(record['files']))))

    def test_changed_member_digest_is_rejected(self):
        self.reject_change('members.json', lambda record: record['files'][reader.PREFIX + 'composed-qualification.json'].update(sha256='0' * 64))

    def test_wrong_platform_name_is_rejected(self):
        self.reject_change('metadata.json', lambda record: record.update(name=record['name'].replace('ubuntu-22.04', 'windows-latest')))

    def test_changed_archive_is_rejected(self):
        with self.changed_transport() as directory:
            archive = directory / 'artifact.zip'
            raw = bytearray(archive.read_bytes())
            raw[-1] ^= 1
            archive.unlink()
            archive.write_bytes(raw)
            with self.assertRaises(AssertionError):
                reader.verify(repository, directory)

    def test_coherently_resealed_archive_and_ledgers_are_rejected(self):
        with self.changed_transport() as directory:
            archive = directory / 'artifact.zip'
            raw = archive.read_bytes() + b'changed transport with coherently rewritten ledgers'
            archive.unlink()
            archive.write_bytes(raw)
            # ZIP permits a trailer. Its complete member ledger is still valid;
            # only an independent reviewed artifact pin detects this replacement.
            with zipfile.ZipFile(archive) as bundle:
                self.assertIsNone(bundle.testzip())
            checksum = hashlib.sha256(raw).hexdigest()
            metadata = json.loads((directory / 'metadata.json').read_bytes())
            metadata.update(size_in_bytes=len(raw), digest='sha256:' + checksum)
            (directory / 'metadata.json').write_text(json.dumps(metadata), encoding='utf-8')
            members = json.loads((directory / 'members.json').read_bytes())
            members.update(archiveSha256=checksum)
            (directory / 'members.json').write_text(json.dumps(members), encoding='utf-8')
            with self.assertRaises(AssertionError):
                reader.verify(repository, directory)

if __name__ == '__main__':
    unittest.main(argv=[sys.argv[0]])
