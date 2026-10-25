"""Exercise actual published API/ZIP bytes and bounded negative transport contracts; no SDK or archived helper is mocked/executed."""
import copy
from pathlib import Path
import tempfile
import unittest

import transport

REPOSITORY = Path(__file__).resolve().parents[4]
COLLECTION = REPOSITORY / 'reports/validation/owner-batch-method-ci/40216555955'
HEAD = '564f0f554bcc43f8a12df1acaedc97525d1032ae'
BINDING = {'repository': 'guidomodarelli/rustdom', 'mode': 'functional', 'attempt': 1, 'runId': 40216555955,
           'head': HEAD, 'jobs': {'22.12.0': 121238836694, '24.14.1': 121238836517}, 'artifacts': {
               '22.12.0': {'id': 12608328874, 'name': 'owner-batch-method-22.12.0-' + HEAD,
                           'size_in_bytes': 4652679, 'digest': 'sha256:049219c11835731dbfa252b677112ba7e917e62bc0e1909c7225d8e61a167496'},
               '24.14.1': {'id': 12608500108, 'name': 'owner-batch-method-24.14.1-' + HEAD,
                           'size_in_bytes': 4646689, 'digest': 'sha256:f1b587d5d558d383a3c1f379ffdd0d5539728ef0c842cd9d42a8850737886af7'}}}


class TransportContracts(unittest.TestCase):
    def setUp(self):
        self.run = transport.read_json(COLLECTION / 'run.json')
        self.jobs = transport.read_json(COLLECTION / 'jobs.json')
        self.artifacts = transport.read_json(COLLECTION / 'artifacts.json')

    def verify_metadata(self, binding=BINDING):
        return transport.authenticate_metadata(binding, self.run, self.jobs, self.artifacts)

    def test_real_published_matrix_binds_both_selected_jobs_and_original_zips(self):
        selected = self.verify_metadata()
        self.assertEqual(len(selected), 2)
        for entry in selected:
            filename = COLLECTION / ('artifact-' + str(entry['artifact']['id'])) / 'artifact.zip'
            members = transport.inspect_zip(filename, entry['artifact'])
            self.assertTrue(members)
            self.assertEqual(len({member['path'] for member in members}), len(members))
            original = transport.read_json(filename.parent / 'members.json')['members']
            self.assertEqual([{key: member[key] for key in ['path', 'bytes', 'sha256']} for member in members], original)

    def test_an_attempt_or_source_change_is_rejected(self):
        for field, value in [('run_attempt', 2), ('head_sha', '0' * 40), ('id', BINDING['runId'] + 1)]:
            original = self.run[field]; self.run[field] = value
            with self.assertRaises(AssertionError): self.verify_metadata()
            self.run[field] = original

    def test_functional_evidence_cannot_be_relabelled_as_capture(self):
        binding = {**BINDING, 'mode': 'capture'}
        with self.assertRaises(AssertionError): self.verify_metadata(binding)

    def test_changed_job_attempt_name_or_owner_is_rejected(self):
        job = next(job for job in self.jobs['jobs'] if job['id'] == BINDING['jobs']['22.12.0'])
        for field, value in [('run_attempt', 2), ('name', 'different job'), ('run_id', 1), ('head_sha', '0' * 40)]:
            original = job[field]; job[field] = value
            with self.assertRaises(AssertionError): self.verify_metadata()
            job[field] = original

    def test_missing_duplicate_or_different_artifact_is_rejected(self):
        original = copy.deepcopy(self.artifacts)
        for transform in [lambda assets: assets['artifacts'].pop(),
                          lambda assets: assets['artifacts'].__setitem__(1, assets['artifacts'][0]),
                          lambda assets: assets['artifacts'][0].__setitem__('id', 1),
                          lambda assets: assets['artifacts'][0].__setitem__('digest', 'sha256:' + '0' * 64)]:
            self.artifacts = copy.deepcopy(original); transform(self.artifacts)
            with self.assertRaises(AssertionError): self.verify_metadata()

    def test_original_zip_cannot_pass_with_changed_independent_digest(self):
        entry = self.verify_metadata()[0]; artifact = {**entry['artifact'], 'digest': 'sha256:' + '0' * 64}
        filename = COLLECTION / ('artifact-' + str(artifact['id'])) / 'artifact.zip'
        with self.assertRaises(AssertionError): transport.inspect_zip(filename, artifact)

    def test_bounded_metadata_rejects_a_shared_inode(self):
        import os
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary); first = root / 'first.json'; first.write_text('{}'); second = root / 'second.json'
            os.link(first, second)
            with self.assertRaises(AssertionError): transport.read_json(first)
            self.assertEqual(first.read_text(), '{}')

    def test_member_paths_reject_escape_aliases_and_windows_devices(self):
        for name in ['/escape', '../escape', 'a/../escape', 'a\\b', 'C:escape', './alias', 'a//alias', 'a//', 'trailing.', 'CON', 'a/nul.txt', 'COM1.json']:
            with self.assertRaises(AssertionError, msg=name): transport.safe_name(name)

    def test_existing_collection_is_preserved_before_any_network_request(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary); output = root / 'existing'; output.mkdir(); marker = output / 'marker'; marker.write_bytes(b'owned elsewhere')
            with self.assertRaises(AssertionError): transport.collect(BINDING, output)
            self.assertEqual(marker.read_bytes(), b'owned elsewhere')

    def test_json_creation_is_exclusive(self):
        with tempfile.TemporaryDirectory() as temporary:
            target = Path(temporary) / 'metadata.json'; transport.write_json(target, {'first': True})
            expected = target.read_bytes()
            with self.assertRaises(FileExistsError): transport.write_json(target, {'second': True})
            self.assertEqual(target.read_bytes(), expected)

    def test_offline_verification_rejects_unpinned_self_describing_collection(self):
        binding = {key: value for key, value in BINDING.items() if key != 'artifacts'}
        with self.assertRaises(AssertionError): transport.verify_collection(binding, COLLECTION)

    def test_real_api_catalog_matches_the_independently_published_source_commit(self):
        profile_binding = {'repository': 'guidomodarelli/rustdom', 'head': 'e7895fb0daeb7858ba99805cff21a07f5767241f',
                           'producerCatalogSha256': '7c267c59f6103bc5a9154dda65e6b90af16778caedadf432e6ee2f46d218db21'}
        folder = REPOSITORY / 'reports/validation/owner-batch-transport/20261025'
        profile = transport.producer_catalog(profile_binding, folder)
        self.assertEqual(profile['sourceCommit'], profile_binding['head'])
        self.assertEqual(len(profile['files']), 778)
        for mutation in [{'head': '0' * 40}, {'producerCatalogSha256': '0' * 64}]:
            with self.assertRaises(AssertionError): transport.producer_catalog({**profile_binding, **mutation}, folder)


if __name__ == '__main__':
    unittest.main()
