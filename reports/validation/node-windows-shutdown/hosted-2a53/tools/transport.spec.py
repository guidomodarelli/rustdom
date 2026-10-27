"""Real child processes exercise successful, partial and damaged transport lifecycle."""
import hashlib
import importlib.util
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
import types

location = Path(__file__).with_name('transport.py')
transport = types.ModuleType('current_transport')
transport.__file__ = str(location)
exec(compile(location.read_bytes(), str(location), 'exec'), transport.__dict__)

class TransportContracts(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.target = Path(self.temporary.name) / 'bytes.dat'

    def test_success_and_authenticated_reuse_without_second_process(self):
        raw = transport.fetch('local-success', self.target, [sys.executable, '-c', 'print("complete")'])
        self.assertEqual(transport.fetch('local-success', self.target, ['invalid-do-not-execute']), raw)

    def test_failed_process_preserves_partial_and_cannot_be_promoted_on_resume(self):
        command = [sys.executable, '-c', 'import sys;print("partial",flush=True);sys.exit(9)']
        with self.assertRaises(RuntimeError):
            transport.fetch('local-failure', self.target, command)
        self.assertFalse(self.target.exists())
        self.assertEqual(self.target.with_name('bytes.dat.partial').read_bytes().strip(), b'partial')
        with self.assertRaises(FileExistsError):
            transport.fetch('local-failure', self.target, command)

    def test_unreceipted_log_is_rejected(self):
        self.target.write_bytes(b'partial')
        with self.assertRaises(RuntimeError):
            transport.fetch('untrusted', self.target, ['invalid-do-not-execute'])

    def test_independently_pinned_archive_can_be_authenticated_without_download(self):
        raw = b'complete artifact data'
        self.target.write_bytes(raw)
        expected = {'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()}
        self.assertEqual(transport.fetch('pinned', self.target, ['invalid-do-not-execute'], expected), raw)

    def test_changed_receipted_bytes_are_rejected(self):
        transport.fetch('local', self.target, [sys.executable, '-c', 'print("complete")'])
        self.target.write_bytes(b'corrupt')
        with self.assertRaises(AssertionError):
            transport.fetch('local', self.target, ['invalid-do-not-execute'])

    def test_wrong_endpoint_and_wrong_expected_digest_are_rejected(self):
        transport.fetch('local', self.target, [sys.executable, '-c', 'print("complete")'])
        with self.assertRaises(AssertionError):
            transport.fetch('different', self.target, ['invalid-do-not-execute'])
        with self.assertRaises(AssertionError):
            transport.fetch('local', self.target, ['invalid-do-not-execute'], {'bytes': 9, 'sha256': '0' * 64})

    def test_optimized_import_is_rejected(self):
        result = subprocess.run([sys.executable, '-O', str(Path(transport.__file__))], capture_output=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn(b'non-optimized Python', result.stderr)

    def test_dangling_symlink_is_preserved_and_rejected(self):
        try:
            self.target.symlink_to(Path(self.temporary.name) / 'absent')
        except OSError as error:
            self.skipTest('Symlink creation unavailable on this platform: ' + str(error))
        with self.assertRaises(RuntimeError):
            transport.fetch('symlink', self.target, ['invalid-do-not-execute'])
        self.assertTrue(self.target.is_symlink())

    def test_destination_created_during_transport_is_not_overwritten(self):
        command = [sys.executable, '-c', 'from pathlib import Path;import sys;Path(sys.argv[1]).write_bytes(b"foreign");print("download")', str(self.target)]
        with self.assertRaises(FileExistsError):
            transport.fetch('race', self.target, command)
        self.assertEqual(self.target.read_bytes(), b'foreign')
        self.assertEqual(self.target.with_name('bytes.dat.partial').read_bytes().strip(), b'download')

if __name__ == '__main__':
    unittest.main()
