"""Validate the entire actual export against original workers and both offline replays."""
import collections
import csv
import hashlib
import json
from pathlib import Path
import sys
import unittest

packet, capture, first, second = map(Path, sys.argv[1:5])
del sys.argv[1:5]
read = lambda filename: json.loads(filename.read_text(encoding='utf-8'))
index = read(capture / 'index.json')
summary = read(first / 'analysis.json')
memory = read(first / 'memory.json')


def observations():
    for ordinal, process in enumerate(index['processes']):
        directory = capture / ('node22' if ordinal < len(index['processes']) // 2 else 'node24') / f'{ordinal % (len(index["processes"]) // 2):04d}'
        yield process, read(directory / 'report.json')


class CompleteColdStudy(unittest.TestCase):
    def test_both_replays_and_all_exports_match_and_preserve_rejection(self):
        replay = (packet / 'replay-node22.json').read_bytes()
        self.assertEqual(replay, (packet / 'replay-node24.json').read_bytes())
        decision = json.loads(replay)
        self.assertTrue(decision['verified'])
        self.assertFalse(decision['accepted'])
        self.assertFalse(decision['historicalGateReevaluated'])
        self.assertEqual((decision['processes'], decision['measuredDurations'], decision['warmupDurations']), (2048, 18432, 6144))
        hashes = lambda root: {filename.name: hashlib.sha256(filename.read_bytes()).hexdigest() for filename in root.iterdir() if filename.is_file()}
        self.assertEqual(hashes(first), hashes(second))
        self.assertEqual(len(hashes(first)), 4)
        self.assertFalse(summary['performanceAccepted'])
        self.assertTrue(summary['executionComplete'])
        self.assertEqual(summary['totals'], memory['totals'])

    def test_every_warmup_and_measured_duration_matches_the_original_process(self):
        counts = collections.Counter()
        with (first / 'spans.csv').open(newline='', encoding='utf-8') as source:
            rows = iter(csv.DictReader(source))
            for process, report in observations():
                for span in report['batches'][0]['sampleTimings']:
                    row = next(rows)
                    for name in ['node', 'phase', 'engine', 'label']:
                        self.assertEqual(row[name], report[name])
                    self.assertEqual(int(row['pid']), report['pid'])
                    self.assertEqual(row['physical'], report['schedule']['physical'])
                    self.assertEqual(int(row['span']), span['index'])
                    self.assertEqual(row['stage'], span['stage'])
                    self.assertEqual(float(row['startMs']), span['startMs'])
                    self.assertEqual(float(row['durationMs']), span['durationMs'])
                    self.assertEqual(row['outputHash'], report['batches'][0]['outputHash'])
                    counts[row['stage']] += 1
            self.assertIsNone(next(rows, None))
        self.assertEqual(counts, {'warmup': 6144, 'measured': 18432})

    def test_all_resources_and_first_unclear_rounds_remain_visible(self):
        first_unclear = 0
        owners = collections.Counter()
        for process, report in observations():
            batch = report['batches'][0]
            self.assertEqual(batch['trackedOwners'], {'window': 12, 'document': 12})
            owners.update(batch['trackedOwners'])
            self.assertEqual(len(batch['cleanupTrace']), 3)
            first_unclear += not batch['cleanupTrace'][0]['clear']
            for endpoint in batch['cleanupTrace'][1:]:
                self.assertTrue(endpoint['clear'])
                self.assertEqual(endpoint['survivors'], {'window': 0, 'document': 0})
                if report['engine'] == 'rustdom':
                    self.assertEqual(endpoint['nativeTree']['napiClasses']['live'], report['nativeBaseline']['napiClasses']['live'])
        self.assertEqual(owners, {'window': 24576, 'document': 24576})
        self.assertEqual(first_unclear, 264)
        self.assertEqual(memory['totals']['firstUnclearStates'], first_unclear)
        self.assertEqual(memory['totals']['requiredFinalClearStates'], 4096)
        self.assertEqual(memory['parentSnapshots'], index['parentMemory'])
        self.assertEqual(len(memory['parentSnapshots']), 3)

    def test_every_comparison_preserves_the_published_decision(self):
        expected = []
        for profile in index['decision']['results']:
            for phase, rows in profile['summaries'].items():
                expected.extend({'node': profile['node'], 'phase': phase, **row} for row in rows)
        self.assertEqual(summary['comparisons'], expected)
        with (first / 'comparisons.csv').open(newline='', encoding='utf-8') as source:
            actual = list(csv.DictReader(source))
        self.assertEqual(len(actual), len(expected))
        for row, original in zip(actual, expected, strict=True):
            for name, value in row.items():
                if name.endswith('Percent'):
                    self.assertEqual(float(value), original[name])
                elif name in ['calibrated', 'withinBudget']:
                    self.assertEqual(value, str(original[name]).lower())
                else:
                    self.assertEqual(value, original[name])

    def test_all_unfavorable_controls_and_numeric_regressions_are_retained(self):
        controls = [row for row in summary['comparisons'] if abs(row['jsdomControlChangePercent']) > 2]
        rust = [row for row in summary['comparisons'] if
            (abs(row['rustdomChangePercent']) if row['phase'] == 'AA' else row['rustdomChangePercent']) > 5]
        self.assertEqual(summary['failures']['jsdomControls'], controls)
        self.assertEqual(summary['failures']['rustNumeric'], rust)
        self.assertEqual((len(controls), len(rust)), (8, 1))
        self.assertEqual((rust[0]['node'], rust[0]['phase'], rust[0]['key']), ('v24.14.1', 'AB', 'range-control-1000/250'))


if __name__ == '__main__':
    unittest.main(verbosity=2)
