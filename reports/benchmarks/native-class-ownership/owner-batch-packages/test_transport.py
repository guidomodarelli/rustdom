"""Read the real complete tar and its changed bytes; archived implementations are never invoked."""
import os
from pathlib import Path
import shutil
import tempfile
import unittest

import transport

ARCHIVE = transport.REPOSITORY / 'reports/validation/owner-batch-package/20261025/packages.tar.xz'


class TransportContracts(unittest.TestCase):
    def test_complete_actual_archive_verifies_every_file_and_link(self):
        result = transport.verify(ARCHIVE)
        self.assertTrue(result['verified'])
        self.assertEqual(result['members'], 7823)
        self.assertEqual(result['links'], 6)
        self.assertFalse(result['runtimeExecuted'])
        self.assertIsNone(result['performanceAccepted'])
        self.assertFalse(result['gateReevaluated'])

    def test_corrupted_archive_is_rejected_before_any_extract(self):
        with tempfile.TemporaryDirectory(prefix='owner-batch-corrupt-') as directory:
            filename = Path(directory) / 'archive.tar.xz'; shutil.copyfile(ARCHIVE, filename)
            with filename.open('r+b') as stream:
                stream.seek(-1, os.SEEK_END)
                value = stream.read(1); stream.seek(-1, os.SEEK_END)
                stream.write(bytes([value[0] ^ 1]))
            with self.assertRaises(AssertionError):
                transport.verify(filename)

    @unittest.skipUnless(os.name == 'posix', 'Extraction creates Linux relative links; Windows still verifies all transport bytes')
    def test_existing_extraction_is_preserved(self):
        with tempfile.TemporaryDirectory(prefix='owner-batch-existing-') as directory:
            output = Path(directory) / 'existing'; output.mkdir()
            marker = output / 'partial'; marker.write_bytes(b'preserve partial')
            with self.assertRaises(AssertionError):
                transport.extract(ARCHIVE, output)
            self.assertEqual(marker.read_bytes(), b'preserve partial')


if __name__ == '__main__':
    unittest.main()
