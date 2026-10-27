"""Exercise complete real exports, corruption rejection and output protection."""
import csv
import hashlib
import json
from pathlib import Path
import shutil
import sys
from tempfile import TemporaryDirectory
import unittest

from source import load_exports, policy
from metrics import diagnose
from run import run


SOURCE = Path(sys.argv.pop(1)).resolve()


class CalibrationContracts(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.declaration, cls.index, cls.analysis, cls.processes = load_exports(SOURCE)
        cls.summary, cls.pairs = diagnose(cls.declaration, cls.analysis, cls.processes)

    def test_complete_coverage_and_pooled_medians(self):
        self.assertEqual(self.summary['processes'], 2048)
        self.assertEqual(self.summary['pairs'], 1024)
        self.assertEqual(len(self.summary['rows']), 64)
        self.assertEqual(len(self.pairs), 1024)
        self.assertEqual(sum(len(process['samples']) for process in self.processes), 18432)
        self.assertEqual(sum(len(process['spans']) for process in self.processes), 24576)
        self.assertEqual(sum(len(row['pooledMedianMs']) for row in self.summary['rows']), 128)

    def test_every_factor_preserves_all_positions(self):
        for row in self.summary['rows']:
            for groups in row['partitions'].values():
                self.assertEqual(groups['false']['count'], 8)
                self.assertEqual(groups['true']['count'], 8)
                self.assertEqual(row['pairedChangePercent']['count'], 16)
        for pair in self.pairs:
            self.assertEqual(pair['ordinalDistance'], 1)
            self.assertEqual(pair['firstLabel'], 'B' if pair['position'] & 1 else 'A')
            if pair['engine'] == 'jsdom':
                self.assertEqual((pair['physicalA'], pair['physicalB']),
                    ('J1', 'J0') if pair['position'] & 2 else ('J0', 'J1'))

    def test_official_rejection_is_not_redecided(self):
        self.assertFalse(self.summary['performanceAccepted'])
        self.assertFalse(self.summary['acceptanceRecomputed'])
        self.assertFalse(self.summary['historicalGateReevaluated'])
        self.assertFalse(self.summary['DOMExecuted'])
        self.assertFalse(self.summary['studyRepeated'])
        self.assertEqual(self.summary['sourceCommit'], '02291d6b7a234a26ffaf364a1f377766e2338e7a')

    def test_cli_preserves_inputs_and_is_deterministic(self):
        before = {name: hashlib.sha256((SOURCE / name).read_bytes()).hexdigest() for name in policy()['files']}
        with TemporaryDirectory() as directory:
            first, second = Path(directory) / 'first', Path(directory) / 'second'
            run(SOURCE, first)
            run(SOURCE, second)
            for name in ['diagnostic.json', 'pairs.csv']:
                self.assertEqual((first / name).read_bytes(), (second / name).read_bytes())
            with (first / 'pairs.csv').open(encoding='utf-8', newline='') as stream:
                pairs = list(csv.DictReader(stream))
            self.assertEqual(len(pairs), 1024)
            self.assertEqual(json.loads((first / 'diagnostic.json').read_bytes()), self.summary)
        self.assertEqual(before, {name: hashlib.sha256((SOURCE / name).read_bytes()).hexdigest() for name in before})

    def test_existing_output_is_not_modified(self):
        with TemporaryDirectory() as directory:
            target = Path(directory) / 'existing'
            target.mkdir()
            sentinel = target / 'diagnostic.json'
            sentinel.write_bytes(b'owned by another invocation')
            with self.assertRaises(FileExistsError):
                run(SOURCE, target)
            self.assertEqual(sentinel.read_bytes(), b'owned by another invocation')
            self.assertEqual(list(target.iterdir()), [sentinel])

    def test_corrupted_input_rejected_before_output(self):
        with TemporaryDirectory() as directory:
            copied = Path(directory) / 'source'
            copied.mkdir()
            for name in policy()['files']:
                shutil.copyfile(SOURCE / name, copied / name)
            spans = copied / policy()['spans']
            with spans.open('ab') as stream:
                stream.write(b'\n')
            output = Path(directory) / 'output'
            with self.assertRaisesRegex(ValueError, 'SHA256 mismatch for spans.csv'):
                run(copied, output)
            self.assertFalse(output.exists())

    def test_output_cannot_be_inside_original_inputs(self):
        target = SOURCE / 'uncreated-calibration-output'
        self.assertFalse(target.exists())
        with self.assertRaisesRegex(ValueError, 'source and output must be disjoint'):
            run(SOURCE, target)
        self.assertFalse(target.exists())


if __name__ == '__main__':
    unittest.main()
