"""Real filesystem regressions for the evidence byte reader; no archived code is executed."""
import hashlib
import importlib.util
from pathlib import Path
import tempfile
import unittest

specification = importlib.util.spec_from_file_location('current_preservation', Path(__file__).with_name('verify-preservation.py'))
reader = importlib.util.module_from_spec(specification)
specification.loader.exec_module(reader)


class PreservationTests(unittest.TestCase):
    def test_accepts_original_binary_and_rejects_changed_or_truncated_bytes(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            original = bytes([0, 255, 13, 10, 128])
            file = root / 'original.bin'
            file.write_bytes(original)
            entry = {'path': 'original.bin', 'bytes': len(original), 'sha256': hashlib.sha256(original).hexdigest()}
            reader.verify_file(root, entry)
            file.write_bytes(bytes([0, 255, 13, 10, 129]))
            with self.assertRaisesRegex(ValueError, 'digest differs'):
                reader.verify_file(root, entry)
            file.write_bytes(original[:-1])
            with self.assertRaisesRegex(ValueError, 'size differs'):
                reader.verify_file(root, entry)

    def test_rejects_path_escape_and_noncanonical_paths(self):
        with tempfile.TemporaryDirectory() as directory:
            for path in ['../outside', '/absolute', 'folder/../outside', 'folder//file', 'C:/outside', 'folder\\file', '']:
                with self.subTest(path=path), self.assertRaises(ValueError):
                    reader.verify_file(Path(directory), {'path': path, 'bytes': 0, 'sha256': hashlib.sha256(b'').hexdigest()})

    @unittest.skipUnless(__import__('sys').platform == 'linux', 'Symlink creation tested on the actual Linux reader host')
    def test_rejects_linked_evidence(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'target').write_bytes(b'original')
            (root / 'linked').symlink_to(root / 'target')
            with self.assertRaisesRegex(ValueError, 'linked path'):
                reader.verify_file(root, {'path': 'linked', 'bytes': 8, 'sha256': hashlib.sha256(b'original').hexdigest()})


if __name__ == '__main__':
    unittest.main()
