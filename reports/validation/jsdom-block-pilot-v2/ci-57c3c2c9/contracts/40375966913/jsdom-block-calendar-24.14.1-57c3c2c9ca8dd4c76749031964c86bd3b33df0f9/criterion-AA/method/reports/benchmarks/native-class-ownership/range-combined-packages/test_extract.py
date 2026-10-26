"""Exercise fixed real package transport and output preservation without loading a runtime."""
import json
from pathlib import Path
import tempfile
import unittest

import extract

REPOSITORY = Path(__file__).resolve().parents[4]


class ExtractionContracts(unittest.TestCase):
    def test_preserves_existing_output(self):
        with tempfile.TemporaryDirectory(prefix='rustdom-combined-extraction-') as temporary:
            output = Path(temporary) / 'keep'; output.mkdir()
            sentinel = output / 'sentinel'; sentinel.write_bytes(b'preserve')
            with self.assertRaisesRegex(AssertionError, 'preserve existing output'):
                extract.extract(REPOSITORY, output)
            self.assertEqual(sentinel.read_bytes(), b'preserve')

    def test_rejects_repository_overlap_before_writing(self):
        output = REPOSITORY / 'forbidden-combined-package-extraction'
        self.assertFalse(output.exists())
        with self.assertRaisesRegex(AssertionError, 'overlaps protected repository'):
            extract.extract(REPOSITORY, output)
        self.assertFalse(output.exists())

    def test_rejects_same_size_changed_archive_before_extracting(self):
        policy = json.loads((Path(__file__).parent / 'constants/archive.json').read_bytes())
        with tempfile.TemporaryDirectory(prefix='rustdom-combined-changed-transport-') as temporary:
            repository = Path(temporary) / 'data'; repository.mkdir()
            archive = repository / policy['archive']['path']; archive.parent.mkdir(parents=True)
            original = (REPOSITORY / policy['archive']['path']).read_bytes()
            archive.write_bytes(bytes([original[0] ^ 1]) + original[1:])
            output = Path(temporary) / 'output'
            with self.assertRaisesRegex(AssertionError, 'changed archive digest'):
                extract.extract(repository, output)
            self.assertFalse(output.exists())


if __name__ == '__main__':
    unittest.main()
