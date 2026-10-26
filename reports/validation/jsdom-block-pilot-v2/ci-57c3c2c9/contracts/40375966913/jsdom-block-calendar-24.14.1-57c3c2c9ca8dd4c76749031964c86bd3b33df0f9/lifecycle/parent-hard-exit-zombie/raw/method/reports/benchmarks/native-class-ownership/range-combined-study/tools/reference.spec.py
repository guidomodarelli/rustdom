"""Exercise the actual SciPy producer and its CLI preservation contract, without mocks or DOM."""
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

PRODUCER = Path(__file__).with_name('generate-numerical-reference.py')
POLICY = json.loads((Path(__file__).parent.parent / 'constants/reference.json').read_bytes())


class NumericalReferenceContracts(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix=POLICY['temporaryPrefix'])
        self.root = Path(self.temporary.name).resolve()
        self.environment = dict(os.environ, PYTHONPATH=os.pathsep.join(sys.path))

    def tearDown(self):
        self.assertEqual(self.root.parent, Path(tempfile.gettempdir()).resolve())
        self.assertTrue(self.root.name.startswith(POLICY['temporaryPrefix']))
        self.temporary.cleanup()

    def run_producer(self, output, optimized=False):
        flags = ['-O'] if optimized else ['-B']
        return subprocess.run([sys.executable, *flags, str(PRODUCER), str(output)],
                              env=self.environment, capture_output=True, timeout=POLICY['producerTimeoutSeconds'])

    def test_public_cli_reproduces_all_five_references_and_metadata(self):
        outputs = [self.root / 'first.json', self.root / 'second.json']
        for output in outputs:
            result = self.run_producer(output)
            self.assertEqual(result.returncode, 0, result.stderr)
            record = json.loads(output.read_bytes())
            self.assertEqual(len(record['cases']), 5)
            self.assertEqual(record['scipy'], POLICY['scipyVersion'])
            self.assertEqual(record['numpy'], POLICY['numpyVersion'])
            self.assertFalse(record['domExecuted']); self.assertFalse(record['benchmarkExecuted'])
            self.assertIsNone(record['performanceAccepted'])
            self.assertEqual(record['producer']['platform'], sys.platform)
            self.assertEqual(record['cases'][-1]['expected']['status'], 'unbounded')
        self.assertEqual(outputs[0].read_bytes(), outputs[1].read_bytes())

    def test_existing_reference_is_not_overwritten(self):
        output = self.root / 'existing.json'; output.write_bytes(b'preserved original reference\n')
        result = self.run_producer(output)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(output.read_bytes(), b'preserved original reference\n')

    def test_optimized_python_cannot_bypass_producer_guards(self):
        output = self.root / 'optimized.json'
        result = self.run_producer(output, optimized=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse(output.exists())
        self.assertIn(b'non-optimized Python', result.stderr)


if __name__ == '__main__':
    unittest.main(verbosity=2)
