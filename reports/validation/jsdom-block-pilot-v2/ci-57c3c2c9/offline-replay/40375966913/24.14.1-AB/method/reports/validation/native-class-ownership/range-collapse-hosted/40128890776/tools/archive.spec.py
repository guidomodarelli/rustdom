"""Exercise preservation and tamper failures against the real pinned hosted archives; no mocks or DOM."""
import json
from pathlib import Path
import shutil
import sys
import unittest
import archive_reader
from test_support import owned_temporary

repository, collection = (Path(value).resolve(strict=True) for value in sys.argv[1:3])
del sys.argv[1:3]
profile = archive_reader.POLICY['prospectivePerformanceBuildProfile']


def inspect(output, source=repository, evidence=collection, key=profile):
    # These rejection cases must finish before any Node invocation is possible.
    return archive_reader.inspect(source, evidence, key, output, Path('node-must-not-be-executed'))


def copy_artifact(temporary):
    evidence = temporary / 'collection'
    directory = evidence / profile
    directory.mkdir(parents=True)
    for name in ['artifact.json', 'artifact.zip']:
        shutil.copyfile(collection / profile / name, directory / name)
    return evidence, directory


class ActualArchivePreservation(unittest.TestCase):
    def test_existing_output_is_preserved(self):
        with owned_temporary() as temporary:
            output = temporary / 'inspection'
            output.mkdir()
            sentinel = output / 'inspection.json'
            sentinel.write_bytes(b'foreign inspection')
            with self.assertRaisesRegex(AssertionError, 'Preserve previous'):
                inspect(output)
            self.assertEqual(sentinel.read_bytes(), b'foreign inspection')
            self.assertEqual(len(list(output.iterdir())), 1)

    def test_repository_cannot_be_used_as_output(self):
        with self.assertRaisesRegex(AssertionError, 'disjoint'):
            inspect(repository)

    def test_repository_parent_cannot_be_used_as_output(self):
        with self.assertRaisesRegex(AssertionError, 'disjoint'):
            inspect(repository.parent)

    def test_collection_cannot_be_used_as_output(self):
        with self.assertRaisesRegex(AssertionError, 'disjoint'):
            inspect(collection)

    def test_source_policy_tampering_fails_before_output_creation(self):
        with owned_temporary() as temporary:
            source = temporary / 'source'
            policy = source / archive_reader.POLICY['sourcePolicyPath']
            policy.parent.mkdir(parents=True)
            original = (repository / archive_reader.POLICY['sourcePolicyPath']).read_bytes()
            policy.write_bytes(original + b'\n')
            output = temporary / 'inspection'
            with self.assertRaises(AssertionError):
                inspect(output, source=source)
            self.assertFalse(output.exists())
            self.assertEqual(policy.read_bytes(), original + b'\n')

    def test_altered_artifact_metadata_cannot_create_output(self):
        with owned_temporary() as temporary:
            evidence, directory = copy_artifact(temporary)
            filename = directory / 'artifact.json'
            metadata = json.loads(filename.read_bytes())
            metadata['id'] += 1
            filename.write_text(json.dumps(metadata), encoding='utf-8')
            altered = filename.read_bytes()
            output = temporary / 'inspection'
            with self.assertRaises(AssertionError):
                inspect(output, evidence=evidence)
            self.assertFalse(output.exists())
            self.assertEqual(filename.read_bytes(), altered)

    def test_altered_zip_cannot_create_output_or_repair_input(self):
        with owned_temporary() as temporary:
            evidence, directory = copy_artifact(temporary)
            filename = directory / 'artifact.zip'
            content = bytearray(filename.read_bytes())
            content[-1] ^= 1
            filename.write_bytes(content)
            output = temporary / 'inspection'
            with self.assertRaises(AssertionError):
                inspect(output, evidence=evidence)
            self.assertFalse(output.exists())
            self.assertEqual(filename.read_bytes(), content)

    def test_unknown_profile_cannot_borrow_the_selected_artifact(self):
        with owned_temporary() as temporary:
            output = temporary / 'inspection'
            with self.assertRaises(StopIteration):
                inspect(output, key='unregistered-profile')
            self.assertFalse(output.exists())


if __name__ == '__main__':
    unittest.main(verbosity=2)
