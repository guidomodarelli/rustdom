"""Exercise the fixed producer with a registered current-code policy and reject cross-producer reuse."""
import contextlib
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import types
import unittest

location = Path(__file__).with_name('verify.py')
reader = types.ModuleType('current_fixed_hosted_reader')
reader.__file__ = str(location)
exec(compile(location.read_bytes(), str(location), 'exec'), reader.__dict__)
dataset = location.parent.parent / '40281778101'
policy_id = '40281778101'

class FixedProducerContracts(unittest.TestCase):
    def test_fixed_producer_thirteen_contracts_and_resources(self):
        result = reader.verify(dataset, policy_id)
        self.assertEqual(result['jobsPassed'], 2)
        self.assertTrue(result['producerCanonicalIndexSealPresent'])
        linux = next(item for item in result['artifacts'] if item['platform'] == 'ubuntu-22.04')
        self.assertEqual(linux['assembly']['passed'], 13)
        self.assertEqual(sum(len(state['cycles']) for state in linux['memory']), 12)
        self.assertIsNone(result['performanceAccepted'])

    def test_previous_producer_cannot_satisfy_fixed_policy(self):
        with self.assertRaises(AssertionError):
            reader.verify(location.parent.parent / '40277876693', policy_id)

    def test_policy_selector_cannot_escape_current_code(self):
        for selector in ['../policy', '/absolute', '40281778101.json', '４０２８１７７８１０１']:
            with self.subTest(selector=selector), self.assertRaises(ValueError):
                reader.verify(dataset, selector)

    def test_missing_api_receipt_rejected(self):
        with tempfile.TemporaryDirectory(prefix='fixed-hosted-input-') as temporary:
            target = Path(temporary) / 'dataset'; shutil.copytree(dataset, target)
            (target / 'run.json').unlink()
            with self.assertRaises(FileNotFoundError):
                reader.verify(target, policy_id)

    def test_optimized_cli_rejected(self):
        result = subprocess.run([sys.executable, '-O', str(location), str(dataset), policy_id], capture_output=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn(b'non-optimized Python', result.stderr)

if __name__ == '__main__':
    unittest.main()
