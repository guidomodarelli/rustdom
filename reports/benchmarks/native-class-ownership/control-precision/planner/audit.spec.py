"""Exercise complete real synthetic output and corrupted independent copies; no DOM or archived code execution."""
import contextlib
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

location = Path(__file__).with_name('audit.py')
specification = importlib.util.spec_from_file_location('current_planning_audit', location)
reader = importlib.util.module_from_spec(specification)
specification.loader.exec_module(reader)
fixtures = [Path(argument).resolve(strict=True) for argument in sys.argv[1:3]]
assert len(fixtures) == 2

class PlanningAuditContracts(unittest.TestCase):
    def test_all_pairs_and_quadratics_in_both_sdk_outputs(self):
        for fixture in fixtures:
            result = reader.audit(fixture)
            self.assertEqual(result['cases'], 11)
            self.assertEqual(result['syntheticTrialsChecked'], 22000)
            self.assertIsNone(result['performanceAccepted'])
            self.assertFalse(result['DOMExecuted'])

    @contextlib.contextmanager
    def independent_copy(self):
        parent = reader.repository / '.cache'
        with tempfile.TemporaryDirectory(prefix='planner-audit-contract-', dir=parent) as temporary:
            target = Path(temporary).resolve(strict=True)
            self.assertTrue(target.is_relative_to(parent.resolve(strict=True)))
            shutil.copyfile(fixtures[0] / 'summary.json', target / 'summary.json')
            for filename in fixtures[0].glob('*.json.gz'):
                os.link(filename, target / filename.name)
            yield target

    def test_changed_summary_counts_are_rejected(self):
        with self.independent_copy() as target:
            filename = target / 'summary.json'
            data = json.loads(filename.read_bytes())
            data['cases'][0]['withinBudgetTrials'] -= 1
            filename.write_text(json.dumps(data), encoding='utf-8')
            with self.assertRaises(AssertionError):
                reader.audit(target)

    def test_missing_or_changed_producer_source_bindings_are_rejected(self):
        for remove in [True, False]:
            with self.independent_copy() as target:
                filename = target / 'summary.json'
                data = json.loads(filename.read_bytes())
                key = next(iter(data['sourceFiles']))
                if remove:
                    data['sourceFiles'].pop(key)
                else:
                    data['sourceFiles'][key] = '0' * 64
                filename.write_text(json.dumps(data), encoding='utf-8')
                with self.assertRaises(AssertionError):
                    reader.audit(target)

    def test_changed_compressed_pairs_are_rejected(self):
        with self.independent_copy() as target:
            filename = next(target.glob('*.json.gz'))
            raw = bytearray(filename.read_bytes())
            raw[-1] ^= 1
            filename.unlink()
            filename.write_bytes(raw)
            with self.assertRaises(AssertionError):
                reader.audit(target)

    def test_optimized_cli_cannot_disable_integrity_checks(self):
        result = subprocess.run([sys.executable, '-O', str(location), str(fixtures[0])], capture_output=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn(b'non-optimized Python', result.stderr)

if __name__ == '__main__':
    unittest.main(argv=[sys.argv[0]])
