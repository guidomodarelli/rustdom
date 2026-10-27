"""Check exported analysis against every original measured/warmup span, without executing archived code."""
import csv
import json
from pathlib import Path
import sys
import unittest

evidence = Path(sys.argv.pop(1)).resolve()
capture = Path(sys.argv.pop(1)).resolve()
read = lambda filename: json.loads(filename.read_text())
index = read(capture / 'index.json')
analysis = read(evidence / 'analysis.json')


class CompleteArtifact(unittest.TestCase):
    def test_replays_preserve_the_original_complete_negative_decision(self):
        self.assertTrue(index['complete'])
        self.assertEqual(len(index['processes']), 2048)
        first = (evidence / 'replay-node22.json').read_bytes()
        self.assertEqual(first, (evidence / 'replay-node24.json').read_bytes())
        replay = json.loads(first)
        self.assertTrue(replay['verified'])
        self.assertFalse(replay['accepted'])
        self.assertEqual(replay['results'], index['decision']['results'])
        self.assertFalse(analysis['performanceAccepted'])

    def test_every_csv_span_matches_its_original_worker_in_order_including_warmup(self):
        count = 0
        stages = {}
        with (evidence / 'spans.csv').open(newline='') as source:
            rows = iter(csv.DictReader(source))
            for ordinal, process in enumerate(index['processes']):
                report = read(capture / ('node22' if ordinal < 1024 else 'node24') / f'{ordinal % 1024:04d}' / 'report.json')
                batch = report['batches'][0]
                for span in batch['sampleTimings']:
                    row = next(rows)
                    self.assertEqual(row['node'], process['node'])
                    self.assertEqual(int(row['pid']), report['pid'])
                    self.assertEqual(row['physical'], report['schedule']['physical'])
                    self.assertEqual(int(row['seed']), report['v8Seed'])
                    self.assertEqual(row['stage'], span['stage'])
                    self.assertEqual(float(row['startMs']), span['startMs'])
                    self.assertEqual(float(row['durationMs']), span['durationMs'])
                    self.assertEqual(row['outputHash'], batch['outputHash'])
                    stages[row['stage']] = stages.get(row['stage'], 0) + 1
                    count += 1
            self.assertIsNone(next(rows, None))
        self.assertEqual(count, 24576)
        self.assertEqual(stages, {'warmup': 6144, 'measured': 18432})

    def test_csv_includes_all_comparisons_and_the_failed_controls(self):
        with (evidence / 'comparisons.csv').open(newline='') as source:
            rows = list(csv.DictReader(source))
        self.assertEqual(len(rows), 32)
        for actual, expected in zip(rows, analysis['comparisons'], strict=True):
            for name in ['node', 'phase', 'key', 'outputHash']:
                self.assertEqual(actual[name], expected[name])
            for name in ['rustdomChangePercent', 'jsdomControlChangePercent']:
                self.assertEqual(float(actual[name]), expected[name])
        self.assertEqual(sum(abs(float(row['jsdomControlChangePercent'])) > 2 for row in rows), 11)
        self.assertEqual(len(analysis['failures']['rustNumeric']), 1)


if __name__ == '__main__':
    unittest.main(verbosity=2)
