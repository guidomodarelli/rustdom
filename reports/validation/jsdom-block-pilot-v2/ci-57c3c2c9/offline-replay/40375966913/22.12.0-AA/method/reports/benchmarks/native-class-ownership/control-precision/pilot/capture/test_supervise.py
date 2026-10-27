"""Atomic publication contracts on the real filesystem; no process/platform mocks."""
import importlib.util
from pathlib import Path
import tempfile
import unittest

SOURCE = Path(__file__).resolve().parent
specification = importlib.util.spec_from_file_location('current_pilot_supervisor', SOURCE / 'supervise.py')
supervisor = importlib.util.module_from_spec(specification)
specification.loader.exec_module(supervisor)


class ReceiptPublication(unittest.TestCase):
    def test_acquisition_preserves_a_destination_created_before_the_atomic_link(self):
        with tempfile.TemporaryDirectory(prefix='rustdom-pilot-receipt-') as temporary:
            root = Path(temporary); pending = root / '.receipt.next'; target = root / 'receipt.json'
            pending.write_bytes(b'owned pending evidence'); target.write_bytes(b'concurrent foreign evidence')
            with self.assertRaises(FileExistsError):
                supervisor.publish_initial(pending, target)
            self.assertEqual(target.read_bytes(), b'concurrent foreign evidence')
            self.assertEqual(pending.read_bytes(), b'owned pending evidence')

    def test_acquisition_publishes_one_independent_file_without_leaving_a_hardlink(self):
        with tempfile.TemporaryDirectory(prefix='rustdom-pilot-receipt-') as temporary:
            root = Path(temporary); pending = root / '.receipt.next'; target = root / 'receipt.json'
            pending.write_bytes(b'owned evidence')
            supervisor.publish_initial(pending, target)
            self.assertEqual(target.read_bytes(), b'owned evidence')
            self.assertEqual(target.stat().st_nlink, 1)
            self.assertFalse(pending.exists())


if __name__ == '__main__':
    unittest.main()
