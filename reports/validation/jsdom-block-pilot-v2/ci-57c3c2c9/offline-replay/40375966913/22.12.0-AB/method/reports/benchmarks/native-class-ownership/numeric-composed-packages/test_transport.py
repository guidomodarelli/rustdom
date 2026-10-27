"""Exercise the actual bound numeric archive and independent damage/extraction paths."""
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import types
import unittest

location = Path(__file__).with_name('transport.py')
reader = types.ModuleType('current_numeric_transport')
reader.__file__ = str(location)
exec(compile(location.read_bytes(), str(location), 'exec'), reader.__dict__)
manifest = json.loads((reader.REPOSITORY / reader.POLICY['archivePolicy']['manifestPath']).read_bytes())
archive = reader.REPOSITORY / Path(reader.POLICY['archivePolicy']['manifestPath']).parent / manifest['archive']['path']

class NumericTransportContracts(unittest.TestCase):
    def temporary(self):
        temporary = tempfile.TemporaryDirectory(prefix='numeric-transport-', dir='/dev/shm' if sys.platform == 'linux' else None)
        self.addCleanup(temporary.cleanup)
        return Path(temporary.name)

    def test_complete_bound_archive(self):
        result = reader.verify(archive)
        self.assertTrue(result['verified'])
        self.assertEqual(result['archiveSha256'], manifest['archive']['sha256'])
        self.assertEqual(result['members'], len(manifest['members']))
        self.assertEqual(result['links'], 6)
        self.assertIsNone(result['performanceAccepted'])

    def test_corrupted_compressed_bytes_rejected(self):
        target = self.temporary() / 'changed.tar.xz'
        raw = archive.read_bytes(); target.write_bytes(raw[:-8] + b'changed!')
        with self.assertRaises(AssertionError):
            reader.verify(target)

    def test_existing_destination_preserved(self):
        if sys.platform != 'linux':
            self.skipTest('Relative Linux runtime link extraction is intentionally Linux-only')
        target = self.temporary() / 'existing'; target.mkdir()
        (target / 'foreign.txt').write_bytes(b'preserve me')
        with self.assertRaises(AssertionError):
            reader.extract(archive, target)
        self.assertEqual((target / 'foreign.txt').read_bytes(), b'preserve me')
        self.assertEqual([member.name for member in target.iterdir()], ['foreign.txt'])

    def test_actual_roundtrip_links_and_physical_bytes(self):
        if sys.platform != 'linux':
            self.skipTest('Relative Linux runtime link extraction is intentionally Linux-only')
        target = self.temporary() / 'extracted'
        result = reader.extract(archive, target)
        self.assertTrue(result['extracted'])
        for entry in manifest['members']:
            member = target / entry['path']
            if entry['kind'] == 'symlink':
                self.assertTrue(member.is_symlink())
                self.assertEqual(member.readlink().as_posix(), entry['target'])
                self.assertTrue(member.resolve(strict=True).is_relative_to(target))
            elif entry['kind'] == 'file':
                self.assertFalse(member.is_symlink())
                self.assertEqual(member.stat().st_nlink, 1)
                self.assertEqual(member.stat().st_size, entry['bytes'])
            else:
                self.assertTrue(member.is_dir())

    def test_optimized_cli_rejected(self):
        result = subprocess.run([sys.executable, '-O', str(location), '--verify', str(archive)], capture_output=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn(b'non-optimized Python', result.stderr)

if __name__ == '__main__':
    unittest.main()
