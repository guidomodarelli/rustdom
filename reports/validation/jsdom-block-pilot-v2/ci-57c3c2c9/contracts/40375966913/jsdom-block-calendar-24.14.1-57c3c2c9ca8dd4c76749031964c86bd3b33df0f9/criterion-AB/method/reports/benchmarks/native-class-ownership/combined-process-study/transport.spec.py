"""Exercise current transport readers against independently pinned real historical bytes, without executing archived code or measuring a DOM."""
import copy
import gzip
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
import zipfile

METHOD = Path(__file__).resolve().parent
REPOSITORY = METHOD.parents[3]
specification = importlib.util.spec_from_file_location('combined_transport', METHOD / 'transport.py')
transport = importlib.util.module_from_spec(specification)
specification.loader.exec_module(transport)
REFERENCE = json.loads((METHOD / 'constants/transport-reference.json').read_bytes())


class RecordedTransportContracts(unittest.TestCase):
    """Retain the historical failure as a failure while testing byte authentication and owned output boundaries."""

    @classmethod
    def setUpClass(cls):
        cls.temporary = tempfile.TemporaryDirectory(prefix='combined-transport-contracts-')
        cls.root = Path(cls.temporary.name)
        cls.collection = cls.root / 'recorded'
        cls.collection.mkdir()
        cls.binding = REFERENCE['binding']
        for name, checksum in REFERENCE['files'].items():
            source = REPOSITORY / name
            if transport.digest(source) != checksum:
                raise AssertionError('Changed independently pinned transport reference: ' + name)
            if source.parent == REPOSITORY / REFERENCE['collection']:
                shutil.copyfile(source, cls.collection / source.name)
        with zipfile.ZipFile(cls.collection / 'artifact.zip') as archive:
            with archive.open(cls.binding['tarName']) as source, (cls.collection / cls.binding['tarName']).open('xb') as target:
                shutil.copyfileobj(source, target, transport.CAPTURE['hashChunkBytes'])
        cls.reader = transport.current_reader(REPOSITORY, cls.binding)
        cls.observed_run = json.loads((cls.collection / 'run.json').read_bytes())
        cls.jobs = json.loads((cls.collection / 'jobs.json').read_bytes())
        cls.artifact = json.loads((cls.collection / 'artifacts.json').read_bytes())['artifacts'][0]

    @classmethod
    def tearDownClass(cls):
        cls.temporary.cleanup()

    def owned(self, name):
        output = self.root / name
        output.mkdir()
        (output / transport.POLICY['ownerFile']).write_text(json.dumps(transport.ownership(self.binding)))
        return output

    def test_complete_real_transport_preserves_rejected_conclusion(self):
        result = transport.verify_collection(REPOSITORY, self.collection, self.binding)
        self.assertTrue(result['transportAuthenticated'])
        self.assertEqual(result['runConclusion'], 'failure')
        self.assertEqual(result['jobConclusion'], 'failure')
        self.assertIsNone(result['performanceAccepted'])
        self.assertFalse(result['gateReevaluated'])
        self.assertFalse(result['collectorExecutedDOM'])

    def test_immutable_run_job_and_attempt_bindings(self):
        self.reader.authenticate_run(self.observed_run, self.jobs)
        for field, value in [('id', self.binding['runId'] + 1), ('head_sha', '0' * 40),
                             ('run_attempt', 2), ('path', '.github/workflows/other.yml'), ('event', 'push')]:
            with self.subTest(runField=field):
                changed = copy.deepcopy(self.observed_run)
                changed[field] = value
                with self.assertRaises(AssertionError):
                    self.reader.authenticate_run(changed, self.jobs)
        for field, value in [('id', self.binding['jobId'] + 1), ('run_id', self.binding['runId'] + 1),
                             ('head_sha', '0' * 40), ('run_attempt', 2), ('name', 'another-job')]:
            with self.subTest(jobField=field):
                changed = copy.deepcopy(self.jobs)
                changed['jobs'][0][field] = value
                with self.assertRaises(AssertionError):
                    self.reader.authenticate_run(self.observed_run, changed)

    def test_pull_request_moving_head_is_not_the_immutable_source(self):
        changed = copy.deepcopy(self.observed_run)
        changed['pull_requests'][0]['head']['sha'] = '0' * 40
        self.reader.authenticate_run(changed, self.jobs)

    def test_artifact_identity_size_and_digest(self):
        filename = self.collection / 'artifact.zip'
        self.reader.authenticate_artifact(self.artifact, filename)
        changes = [('id', self.binding['artifactId'] + 1), ('name', 'different-artifact'), ('expired', True),
                   ('size_in_bytes', self.binding['zipBytes'] + 1), ('digest', 'sha256:' + '0' * 64)]
        for field, value in changes:
            with self.subTest(field=field):
                changed = copy.deepcopy(self.artifact)
                changed[field] = value
                with self.assertRaises(AssertionError):
                    self.reader.authenticate_artifact(changed, filename)
        for field, value in [('id', self.binding['runId'] + 1), ('head_sha', '0' * 40)]:
            changed = copy.deepcopy(self.artifact)
            changed['workflow_run'][field] = value
            with self.assertRaises(AssertionError):
                self.reader.authenticate_artifact(changed, filename)

    def test_corrupted_real_zip_is_rejected(self):
        filename = self.root / 'corrupt.zip'
        shutil.copyfile(self.collection / 'artifact.zip', filename)
        with filename.open('r+b') as output:
            first = output.read(1)
            output.seek(0)
            output.write(bytes([first[0] ^ 1]))
        with self.assertRaises(AssertionError):
            self.reader.authenticate_artifact(self.artifact, filename)

    def test_initial_collection_can_authenticate_actual_artifact_before_its_id_is_pinned(self):
        initial = {name: value for name, value in self.binding.items()
                   if name not in ['artifactId', 'zipSha256', 'zipBytes', 'tarSha256', 'tarBytes']}
        reader = transport.current_reader(REPOSITORY, initial)
        reader.authenticate_artifact(self.artifact, self.collection / 'artifact.zip')
        with self.assertRaises(KeyError):
            transport.verify_collection(REPOSITORY, self.collection, initial)

    def test_repeated_failed_binary_authentication_closes_descriptors(self):
        changed = {**self.artifact, 'digest': 'sha256:' + '0' * 64}
        before = len(list(Path('/proc/self/fd').iterdir()))
        for attempt in range(32):
            with self.assertRaises(AssertionError):
                self.reader.authenticate_artifact(changed, self.collection / 'artifact.zip')
        after = len(list(Path('/proc/self/fd').iterdir()))
        self.assertEqual(after, before)
        print(json.dumps({'binaryAuthenticationFailures': 32, 'descriptorsBefore': before, 'descriptorsAfter': after,
                          'measurementProcesses': 0, 'performanceAccepted': None}))

    def test_foreign_output_rejected_before_any_api_call(self):
        output = self.root / 'foreign'
        output.mkdir()
        data = output / 'keep.txt'
        data.write_bytes(b'foreign work\n')
        with self.assertRaises(AssertionError):
            transport.collect(REPOSITORY, output, self.binding)
        self.assertEqual(data.read_bytes(), b'foreign work\n')
        self.assertEqual(list(output.iterdir()), [data])

    def test_linked_metadata_rejected_before_any_api_call(self):
        for link_kind in ['symlink', 'hardlink']:
            with self.subTest(kind=link_kind):
                output = self.owned('linked-' + link_kind)
                source = output / 'keep.json'
                source.write_bytes(b'{}\n')
                alias = output / 'run.json'
                if link_kind == 'symlink':
                    alias.symlink_to(source)
                else:
                    os.link(source, alias)
                with self.assertRaises(AssertionError):
                    transport.collect(REPOSITORY, output, self.binding)
                self.assertEqual(source.read_bytes(), b'{}\n')

    def test_interrupted_download_bytes_and_observations_are_preserved(self):
        output = self.owned('partials')
        for name in ['artifact.zip.part', 'job.log.part']:
            (output / name).write_bytes(name.encode())
        (output / 'run.json').write_bytes((self.collection / 'run.json').read_bytes())
        transport.assert_owned(output, self.binding)
        before = transport.snapshot(output, False, 'before')
        transport.rotate_partials(output, self.binding)
        after = transport.snapshot(output, True, 'after')
        self.assertNotEqual(before, after)
        self.assertEqual((before / 'run.json').read_bytes(), (after / 'run.json').read_bytes())
        saved = sorted(filename.read_bytes() for filename in (output / 'partials').iterdir())
        self.assertEqual(saved, sorted([b'artifact.zip.part', b'job.log.part']))
        self.assertFalse((output / 'artifact.zip.part').exists())

    def test_interrupted_tar_is_preserved_but_complete_tar_is_reused(self):
        for pinned in [True, False]:
            with self.subTest(pinned=pinned):
                output = self.owned('tar-recovery-' + str(pinned))
                shutil.copyfile(self.collection / 'artifact.zip', output / 'artifact.zip')
                filename = output / self.binding['tarName']
                filename.write_bytes(b'interrupted extraction')
                binding = self.binding if pinned else {name: value for name, value in self.binding.items()
                    if name not in ['tarSha256', 'tarBytes']}
                transport.assert_owned(output, binding)
                transport.rotate_partials(output, binding)
                self.assertFalse(filename.exists())
                saved = list((output / 'partials').iterdir())
                self.assertEqual(len(saved), 1)
                self.assertEqual(saved[0].read_bytes(), b'interrupted extraction')
                shutil.copyfile(self.collection / self.binding['tarName'], filename)
                transport.rotate_partials(output, binding)
                self.assertEqual(len(list((output / 'partials').iterdir())), 1)
                self.assertEqual(transport.digest(filename), self.binding['tarSha256'])

    def test_historical_transport_cannot_be_promoted_to_current_scientific_capture(self):
        with self.assertRaises((AssertionError, KeyError)):
            transport.current_binding(self.binding)
        result = subprocess.run([sys.executable, '-O', str(METHOD / 'transport.py'), '--observe',
            str(REPOSITORY), str(METHOD / 'constants/transport-reference.json'), str(self.root / 'optimized')],
            capture_output=True, text=True, timeout=10)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('requires non-optimized Python', result.stderr)
        self.assertFalse((self.root / 'optimized').exists())

    def test_independent_tar_digest_must_match_actual_zip_member(self):
        changed = {**self.binding, 'tarSha256': '0' * 64}
        with self.assertRaises(AssertionError):
            transport.verify_collection(REPOSITORY, self.collection, changed)

    def test_full_real_archive_extraction_matches_every_original_member(self):
        destination = self.root / 'extracted'
        result = transport.extract(REPOSITORY, self.collection, destination, self.binding)
        original = json.loads(gzip.decompress((REPOSITORY / REFERENCE['memberManifest']).read_bytes()))
        actual = json.loads(gzip.decompress(Path(result['memberManifest']).read_bytes()))
        self.assertEqual(actual, original)
        self.assertEqual(result['members'], len(original))
        self.assertEqual(result['regularFiles'], sum(member['kind'] == 'file' for member in original))
        self.assertEqual(result['links'], 6)
        self.assertIsNone(result['performanceAccepted'])
        self.assertFalse(result['archivedCodeExecuted'])
        print(json.dumps(result))
        with self.assertRaises(AssertionError):
            transport.extract(REPOSITORY, self.collection, destination, self.binding)
        self.assertEqual(Path(result['memberManifest']).read_bytes(), gzip.compress(
            (json.dumps(original, indent=2) + '\n').encode(), mtime=0))


if __name__ == '__main__':
    unittest.main(verbosity=2)
