"""Exercise the real data transport, preservation and corruption boundaries."""
import importlib.util
import json
from pathlib import Path
import shutil
import subprocess
import sys
from tempfile import TemporaryDirectory
import unittest

repository = Path(sys.argv.pop(1)).resolve(strict=True)
spec = importlib.util.spec_from_file_location('current_range_historical_reader', Path(__file__).with_name('historical-fixtures.py'))
reader = importlib.util.module_from_spec(spec)
spec.loader.exec_module(reader)


class HistoricalReader(unittest.TestCase):
    def test_original_index_and_every_member_are_preserved(self):
        with TemporaryDirectory() as temporary:
            destination = Path(temporary) / 'subset'
            result = reader.extract(repository, destination)
            manifest = json.loads((repository / reader.FIXTURES['archiveManifest']['path']).read_bytes())
            self.assertEqual(result['includedOrdinals'], reader.FIXTURES['ordinals'])
            self.assertEqual(result['originalIndexProcesses'], manifest['originalIndexProcesses'])
            self.assertEqual((destination / 'index.json').read_bytes(), (repository / reader.FIXTURES['index']['path']).read_bytes())
            self.assertEqual({filename.relative_to(destination).as_posix() for filename in destination.rglob('*') if filename.is_file()}, set(manifest['members']))
            for name, expected in manifest['members'].items():
                self.assertEqual(reader.digest(destination / name), expected['sha256'], name)
                self.assertEqual((destination / name).stat().st_size, expected['bytes'], name)
            self.assertFalse(result['DOMExecuted'])
            self.assertEqual(result['newMeasurements'], 0)
            self.assertIsNone(result['performanceAccepted'])

    def test_existing_destination_is_untouched(self):
        with TemporaryDirectory() as temporary:
            destination = Path(temporary) / 'existing'
            destination.mkdir()
            marker = destination / 'user-data.txt'
            marker.write_bytes(b'Preserve existing data\n')
            with self.assertRaises(FileExistsError):
                reader.extract(repository, destination)
            self.assertEqual(marker.read_bytes(), b'Preserve existing data\n')

    def test_symlink_destination_is_untouched(self):
        with TemporaryDirectory() as temporary:
            directory = Path(temporary)
            link = directory / 'link'
            try:
                link.symlink_to(directory / 'missing', target_is_directory=True)
            except OSError as error:
                self.skipTest(f'Creating symlinks is unavailable: {error}')
            with self.assertRaises(FileExistsError):
                reader.extract(repository, link)
            self.assertTrue(link.is_symlink())

    def test_changed_archive_is_rejected_before_output(self):
        with TemporaryDirectory() as temporary:
            directory = Path(temporary)
            archive = directory / 'changed.zip'
            shutil.copyfile(repository / reader.FIXTURES['archive']['path'], archive)
            with archive.open('r+b') as output:
                output.seek(-1, 2)
                original = output.read(1)
                output.seek(-1, 2)
                output.write(bytes([original[0] ^ 1]))
            destination = directory / 'not-created'
            with self.assertRaisesRegex(ValueError, 'ZIP size or SHA256'):
                reader.extract(repository, destination, archive)
            self.assertFalse(destination.exists())

    def test_source_overlap_is_rejected_before_output(self):
        destination = repository / 'uncreated-range-historical-output'
        self.assertFalse(destination.exists())
        with self.assertRaisesRegex(ValueError, 'disjoint'):
            reader.extract(repository, destination)
        self.assertFalse(destination.exists())

    def test_optimized_python_does_not_disable_guards(self):
        result = subprocess.run([sys.executable, '-B', '-O', reader.__file__], capture_output=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn(b'non-optimized Python is required', result.stderr)


if __name__ == '__main__':
    unittest.main()
