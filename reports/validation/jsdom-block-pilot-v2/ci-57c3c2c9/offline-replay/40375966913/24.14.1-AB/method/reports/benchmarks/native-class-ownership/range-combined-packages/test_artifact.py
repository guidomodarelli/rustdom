"""Exercise authenticated real CI transport without loading its runtime or executing archived helpers."""
import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
import zipfile
import shutil

SOURCE = Path(__file__).resolve().parent
REPOSITORY = SOURCE.parents[3]
FIXTURE = json.loads((SOURCE / 'constants/reader-fixture.json').read_bytes())
SPEC = importlib.util.spec_from_file_location('combined_artifact', SOURCE / 'artifact.py')
READER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(READER)


class ArtifactContracts(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.fixture = REPOSITORY / FIXTURE['directory']
        cls.archive = cls.fixture / 'artifact.zip'
        cls.metadata = json.loads((cls.fixture / 'metadata.json').read_bytes())
        assert cls.metadata['id'] == FIXTURE['artifactId']
        assert cls.metadata['digest'] == FIXTURE['digest']
        assert cls.archive.stat().st_size == FIXTURE['bytes']
        assert 'sha256:' + READER.digest(cls.archive) == FIXTURE['digest']
        with zipfile.ZipFile(cls.archive) as archive:
            cls.members = {member.filename: archive.read(member) for member in archive.infolist()}
        cls.qualification = next(name for name in cls.members if name.endswith(READER.POLICY['qualificationSuffix']))
        cls.native = next(name for name in cls.members if name.endswith(READER.POLICY['nativeBinary']))

    def changed_archive(self, change):
        """Rewrite a private transport copy, preserving the independently pinned original fixture."""
        members = dict(self.members)
        change(members)
        temporary = tempfile.TemporaryDirectory(prefix='rustdom-artifact-reader-')
        self.addCleanup(temporary.cleanup)
        destination = Path(temporary.name) / 'changed.zip'
        with zipfile.ZipFile(destination, 'x', zipfile.ZIP_DEFLATED) as archive:
            for name, raw in members.items():
                archive.writestr(name, raw)
        metadata = copy.deepcopy(self.metadata)
        metadata.update(size_in_bytes=destination.stat().st_size, digest='sha256:' + READER.digest(destination))
        return destination, metadata

    def test_reads_real_qualified_job_without_qualifying_its_failed_matrix(self):
        result = READER.inspect_artifact(REPOSITORY, self.archive, self.metadata)
        self.assertEqual(result['binarySha256'], FIXTURE['binarySha256'])
        self.assertEqual(len(result['selectedFiles']), FIXTURE['selectedFiles'])
        self.assertEqual(result['qualification']['sourceChangesRaw'], json.loads(self.members[self.qualification])['sourceChangesRaw'])
        self.assertNotIn('matrixQualified', result)
        self.assertFalse(result['runtimeExecuted'])
        self.assertIsNone(result['performanceAccepted'])

    def test_rejects_changed_transport_size_and_digest(self):
        for field, value in [('size_in_bytes', 1), ('digest', 'sha256:' + '0' * 64)]:
            metadata = {**self.metadata, field: value}
            with self.subTest(field=field), self.assertRaisesRegex(AssertionError, 'ZIP'):
                READER.inspect_artifact(REPOSITORY, self.archive, metadata)

    def test_rejects_changed_binary_even_after_resealing_transport(self):
        archive, metadata = self.changed_archive(lambda members: members.__setitem__(self.native, members[self.native] + b'changed'))
        with self.assertRaises(AssertionError):
            READER.inspect_artifact(REPOSITORY, archive, metadata)

    def test_rejects_failed_command_or_changed_source_identity(self):
        for mode in ['command', 'source', 'platform']:
            def change(members):
                qualification = json.loads(members[self.qualification])
                if mode == 'command':
                    qualification['commands'][0]['exitCode'] = 1
                elif mode == 'source':
                    qualification['preparedSource']['patchSha256'] = '0' * 64
                else:
                    qualification['platform'] = 'win32'
                members[self.qualification] = json.dumps(qualification).encode()
            archive, metadata = self.changed_archive(change)
            with self.subTest(mode=mode), self.assertRaises(AssertionError):
                READER.inspect_artifact(REPOSITORY, archive, metadata)

    def test_rejects_traversal_and_ambiguous_candidate_paths(self):
        for name in ['../escape', 'second' + self.qualification]:
            archive, metadata = self.changed_archive(lambda members: members.__setitem__(name, members[self.qualification]))
            with self.subTest(name=name), self.assertRaises(AssertionError):
                READER.inspect_artifact(REPOSITORY, archive, metadata)

    def test_public_cli_rejects_the_failed_old_matrix(self):
        result = subprocess.run([sys.executable, '-B', str(SOURCE / 'artifact.py'), str(REPOSITORY), str(self.fixture.parent)], capture_output=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn(b'Combined artifact reader:', result.stderr)
        self.assertFalse(result.stdout)

    @unittest.skipUnless(READER.BINDING['complete'], 'Selected matrix has no independently published binding yet')
    def test_public_cli_reads_the_complete_selected_matrix(self):
        collection = REPOSITORY / READER.BINDING['collectionDirectory']
        result = subprocess.run([sys.executable, '-B', str(SOURCE / 'artifact.py'), str(REPOSITORY), str(collection)], capture_output=True)
        self.assertEqual(result.returncode, 0, result.stderr.decode())
        selected = json.loads(result.stdout)
        self.assertTrue(selected['matrixQualified'])
        self.assertEqual(selected['artifactId'], READER.BINDING['artifactId'])
        self.assertEqual(selected['binarySha256'], READER.BINDING['binarySha256'])

    @unittest.skipUnless(READER.BINDING['complete'], 'Selected matrix has no independently published binding yet')
    def test_rejects_a_resealed_local_collection_against_external_binding(self):
        original = REPOSITORY / READER.BINDING['collectionDirectory']
        with tempfile.TemporaryDirectory(prefix='rustdom-collection-reader-') as temporary:
            copied = Path(temporary) / 'collection'
            shutil.copytree(original, copied)
            artifact_id = READER.BINDING['artifactId']
            archive_path = copied / ('artifact-' + str(artifact_id)) / 'artifact.zip'
            with zipfile.ZipFile(archive_path, 'a') as archive:
                archive.writestr('extra-runtime-file', b'changed')
            local_digest = 'sha256:' + READER.digest(archive_path)
            metadata_path = copied / ('artifact-' + str(artifact_id)) / 'metadata.json'
            metadata = json.loads(metadata_path.read_bytes())
            metadata.update(digest=local_digest, size_in_bytes=archive_path.stat().st_size)
            metadata_path.write_text(json.dumps(metadata), encoding='utf-8')
            artifacts = json.loads((copied / 'artifacts.json').read_bytes())
            next(entry for entry in artifacts['artifacts'] if entry['id'] == artifact_id).update(metadata)
            (copied / 'artifacts.json').write_text(json.dumps(artifacts), encoding='utf-8')
            with self.assertRaisesRegex(AssertionError, 'changed authenticated receipt'):
                READER.inspect_collection(REPOSITORY, copied)

    @classmethod
    def tearDownClass(cls):
        assert 'sha256:' + hashlib.sha256(cls.archive.read_bytes()).hexdigest() == FIXTURE['digest']


if __name__ == '__main__':
    unittest.main()
