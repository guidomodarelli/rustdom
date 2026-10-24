"""Test qualified historical transport without relabeling it, and reject the unqualified new artifact before writes."""
from contextlib import contextmanager
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
import extract as adapter

repository, historical_collection = map(lambda value: Path(value).resolve(strict=True), sys.argv[1:3])
del sys.argv[1:3]
historical_policy = json.loads((repository / 'reports/benchmarks/native-class-ownership/cold-cleanup-study-results/40113188886/tools/constants/transport.json').read_bytes())


@contextmanager
def owned_directory():
    parent = Path(tempfile.gettempdir()).resolve(strict=True)
    directory = Path(tempfile.mkdtemp(prefix='range-extraction-owned-', dir=parent)).resolve(strict=True)
    try:
        yield directory
    finally:
        assert directory.resolve(strict=True) == directory and directory.parent == parent
        assert directory.name.startswith('range-extraction-owned-') and not directory.is_symlink()
        shutil.rmtree(directory)


class RangeExtraction(unittest.TestCase):
    def test_unqualified_new_pins_refuse_before_any_collection_read_or_write(self):
        with owned_directory() as directory:
            output = directory / 'not-created'
            with self.assertRaises(RuntimeError):
                adapter.extract(repository, directory / 'nonexistent-input', output)
            self.assertFalse(output.exists())

    def test_qualified_historical_archive_keeps_its_actual_identity_and_rejection(self):
        with owned_directory() as directory:
            if os.name == 'nt':
                target = directory / 'link-probe-target'
                target.mkdir()
                probe = directory / 'link-probe'
                try:
                    probe.symlink_to(target, target_is_directory=True)
                except OSError as error:
                    self.skipTest('The qualified archive needs links unavailable on this host: ' + str(error))
                probe.unlink()
                target.rmdir()
            reader = adapter.current_extractor(repository, historical_policy)
            result = reader.extract(repository, historical_collection, directory / 'archive')
            index = json.loads((Path(result['root']) / 'capture/index.json').read_bytes())
            self.assertTrue(result['transportAuthenticated'])
            self.assertFalse(result['extractorExecutedDOM'])
            self.assertEqual(index['sourceCommit'], historical_policy['head'])
            self.assertNotEqual(index['sourceCommit'], adapter.POLICY['head'])
            self.assertFalse(index['performanceAccepted'])
            self.assertEqual(len(index['processes']), 2048)

    def test_wrong_historical_source_refuses_before_creating_output(self):
        with owned_directory() as directory:
            source = directory / 'changed-identity'
            source.mkdir()
            state = json.loads((historical_collection / 'collection.json').read_bytes())
            state['head'] = '0' * 40
            (source / 'collection.json').write_bytes(json.dumps(state).encode())
            reader = adapter.current_extractor(repository, historical_policy)
            with self.assertRaises(AssertionError):
                reader.extract(repository, source, directory / 'not-created')
            self.assertFalse((directory / 'not-created').exists())

    def test_existing_destination_and_its_files_are_preserved(self):
        with owned_directory() as directory:
            output = directory / 'foreign'
            output.mkdir()
            sentinel = output / 'user-data'
            sentinel.write_bytes(b'preserve original')
            reader = adapter.current_extractor(repository, historical_policy)
            with self.assertRaises(FileExistsError):
                reader.extract(repository, historical_collection, output)
            self.assertEqual(sentinel.read_bytes(), b'preserve original')
            self.assertEqual([path.name for path in output.iterdir()], ['user-data'])

    def test_changed_current_reader_bytes_are_rejected_before_loading(self):
        with owned_directory() as directory:
            original = repository / adapter.POLICY['sourceExtractionReaderPath']
            replacement = directory / adapter.POLICY['sourceExtractionReaderPath']
            replacement.parent.mkdir(parents=True)
            content = bytearray(original.read_bytes())
            content[-1] ^= 1
            replacement.write_bytes(content)
            with self.assertRaises(AssertionError):
                adapter.current_extractor(directory)

    def test_optimized_cli_refuses_before_output_creation(self):
        with owned_directory() as directory:
            output = directory / 'not-created'
            result = subprocess.run([sys.executable, '-O', '-B', str(Path(adapter.__file__)), str(repository), str(historical_collection), str(output)], capture_output=True, text=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn('requires non-optimized Python', result.stderr)
            self.assertFalse(output.exists())


if __name__ == '__main__':
    unittest.main(verbosity=2)
