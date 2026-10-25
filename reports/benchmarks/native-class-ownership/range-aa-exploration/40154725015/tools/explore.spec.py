"""Exercise the public offline exploration against the authenticated real AA dataset."""
import csv
import hashlib
import json
from pathlib import Path
import shutil
import statistics
import subprocess
import sys
import tempfile
import unittest

from explore import analyze, POLICY

SOURCE = Path(sys.argv[1]).resolve(strict=True)


def table(path):
    with path.open(encoding='utf-8', newline='') as stream:
        return list(csv.DictReader(stream))


class ExplorationContracts(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.workspace = tempfile.TemporaryDirectory(prefix='rustdom-aa-exploration-')
        cls.temporary = Path(cls.workspace.name)
        cls.result = cls.temporary / 'result'
        cls.digests = analyze(SOURCE, cls.result)
        cls.spans = table(SOURCE / 'spans.csv')
        cls.processes = {row['ordinal']: row for row in table(SOURCE / 'processes.csv')}

    @classmethod
    def tearDownClass(cls):
        cls.workspace.cleanup()

    def test_every_pair_preserves_original_seed_order_and_physical_assignment(self):
        pairs = table(self.result / 'pairs.csv')
        self.assertEqual(len(pairs), 128)
        seen = set()
        for pair in pairs:
            left, right = [self.processes[pair['ordinal' + label]] for label in ['A', 'B']]
            self.assertEqual((left['label'], right['label']), ('A', 'B'))
            for key in ['node', 'mode', 'engine', 'position', 'seed']:
                self.assertEqual(pair[key], left[key]); self.assertEqual(pair[key], right[key])
            self.assertEqual(pair['physicalA'], left['physical'])
            self.assertEqual(pair['physicalB'], right['physical'])
            self.assertEqual(pair['aBeforeB'], str(int(left['ordinal']) < int(right['ordinal'])))
            expected = 100 * (float(right['medianMeasuredMs']) / float(left['medianMeasuredMs']) - 1)
            self.assertEqual(float(pair['processMedianDifferencePct']), expected)
            seen.update([pair['ordinalA'], pair['ordinalB']])
        self.assertEqual(seen, set(self.processes))

    def test_pooled_description_is_unchanged_and_pair_medians_are_distinct_statistics(self):
        cohorts = table(self.result / 'cohorts.csv')
        previous = json.loads((SOURCE / 'diagnostic-description.json').read_bytes())['comparisons']
        pairs = table(self.result / 'pairs.csv')
        self.assertEqual(len(cohorts), 8)
        for row, prior in zip(cohorts, previous, strict=True):
            self.assertEqual(tuple(row[key] for key in ['node', 'mode', 'engine']), tuple(prior[key] for key in ['node', 'mode', 'engine']))
            self.assertEqual(float(row['pooledMedianDifferencePct']), prior['differencePct'])
            ratios = [float(pair['processMedianDifferencePct']) for pair in pairs if all(pair[key] == row[key] for key in ['node', 'mode', 'engine'])]
            self.assertEqual(len(ratios), 16)
            self.assertEqual(float(row['medianPairedProcessDifferencePct']), statistics.median(ratios))
        self.assertNotEqual(float(cohorts[0]['pooledMedianDifferencePct']), float(cohorts[0]['medianPairedProcessDifferencePct']))

    def test_every_warmup_and_measured_index_is_described_without_exclusion(self):
        groups = table(self.result / 'span-order.csv')
        self.assertEqual(len(groups), 192)
        count = 0
        for row in groups:
            observed = [float(span['durationMs']) for span in self.spans if all(span[key] == row[key] for key in ['node', 'mode', 'engine', 'label', 'stage', 'index'])]
            self.assertEqual(len(observed), 16)
            self.assertEqual((float(row['minMs']), float(row['medianMs']), float(row['maxMs'])), (min(observed), statistics.median(observed), max(observed)))
            count += len(observed)
        self.assertEqual(count, len(self.spans))
        self.assertEqual(sum(row['stage'] == 'warmup' for row in self.spans), 768)
        self.assertEqual(sum(row['stage'] == 'measured' for row in self.spans), 2304)

    def test_first_and_last_measured_triplets_cover_every_process(self):
        drifts = table(self.result / 'process-drift.csv')
        self.assertEqual(len(drifts), 256)
        self.assertEqual({row['ordinal'] for row in drifts}, set(self.processes))
        for row in drifts:
            original = {int(span['index']): float(span['durationMs']) for span in self.spans if span['ordinal'] == row['ordinal']}
            early = statistics.median(original[index] for index in [3, 4, 5])
            late = statistics.median(original[index] for index in [9, 10, 11])
            self.assertEqual(float(row['earlyMeasuredMedianMs']), early)
            self.assertEqual(float(row['lateMeasuredMedianMs']), late)
            self.assertEqual(float(row['lateVsEarlyPct']), 100 * (late / early - 1))

    def test_public_cli_is_deterministic_and_cannot_accept_performance(self):
        output = self.temporary / 'cli-result'
        completed = subprocess.run([sys.executable, '-B', str(Path(__file__).with_name('explore.py')), str(SOURCE), str(output)], capture_output=True, check=True)
        digests = json.loads(completed.stdout)
        self.assertEqual(digests, self.digests)
        for name, expected in digests.items():
            self.assertEqual(hashlib.sha256((output / name).read_bytes()).hexdigest(), expected)
            self.assertEqual(hashlib.sha256((Path(__file__).parent.parent / name).read_bytes()).hexdigest(), expected)
        summary = json.loads((output / 'summary.json').read_bytes())
        self.assertTrue(summary['diagnosticOnly']); self.assertTrue(summary['exploratory'])
        self.assertEqual(summary['newMeasurements'], 0)
        self.assertFalse(summary['DOMExecuted']); self.assertFalse(summary['gateReevaluated'])
        self.assertIsNone(summary['performanceAccepted'])
        self.assertFalse(summary['historicalOwnershipPerformanceAccepted'])

    def test_foreign_bytes_are_rejected_before_creating_output(self):
        altered = self.temporary / 'altered'
        altered.mkdir()
        for name in POLICY['inputs']:
            shutil.copyfile(SOURCE / name, altered / name)
        with (altered / 'spans.csv').open('ab') as stream:
            stream.write(b'foreign')
        output = self.temporary / 'rejected'
        with self.assertRaisesRegex(AssertionError, 'input digest mismatch'):
            analyze(altered, output)
        self.assertFalse(output.exists())

    def test_existing_output_and_input_overlap_are_preserved(self):
        before = {name: hashlib.sha256((SOURCE / name).read_bytes()).hexdigest() for name in POLICY['inputs']}
        for output in [SOURCE, SOURCE / 'do-not-create', self.result]:
            with self.assertRaises(AssertionError): analyze(SOURCE, output)
        self.assertFalse((SOURCE / 'do-not-create').exists())
        self.assertEqual(before, {name: hashlib.sha256((SOURCE / name).read_bytes()).hexdigest() for name in POLICY['inputs']})
        self.assertEqual(self.digests, {name: hashlib.sha256((self.result / name).read_bytes()).hexdigest() for name in POLICY['outputs']})

    def test_optimized_python_cannot_disable_the_read_only_guards(self):
        output = self.temporary / 'optimized-result'
        completed = subprocess.run([sys.executable, '-O', str(Path(__file__).with_name('explore.py')), str(SOURCE), str(output)], capture_output=True)
        self.assertNotEqual(completed.returncode, 0)
        self.assertIn(b'non-optimized Python', completed.stderr)
        self.assertFalse(output.exists())


if __name__ == '__main__':
    unittest.main(argv=[sys.argv[0]], verbosity=2)
