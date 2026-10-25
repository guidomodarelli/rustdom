"""Compare public descriptive exports with every relevant original row, without DOM or source-text tests."""
import collections
from contextlib import contextmanager
import csv
import json
from pathlib import Path
import shutil
import statistics
import sys
import tempfile
import unittest

from describe import POLICY, describe, digest

packet = Path(sys.argv.pop(1)).resolve(strict=True)


@contextmanager
def temporary_directory():
    parent = Path(tempfile.gettempdir()).resolve(strict=True)
    directory = Path(tempfile.mkdtemp(prefix=POLICY['temporaryPrefix'], dir=parent)).resolve(strict=True)
    try:
        yield directory
    finally:
        assert directory.resolve(strict=True) == directory and directory.parent == parent
        assert directory.name.startswith(POLICY['temporaryPrefix']) and not directory.is_symlink()
        shutil.rmtree(directory)


def csv_rows(filename):
    with filename.open(encoding='utf-8', newline='') as source:
        yield from csv.DictReader(source)


class RangeAaDescription(unittest.TestCase):
    def test_every_aa_pair_matches_all_measured_spans_without_a_gate_decision(self):
        with temporary_directory() as directory:
            output = directory / 'output'
            summary = describe(packet, output)
            self.assertIsNone(summary['performanceAccepted'])
            self.assertFalse(summary['gateReevaluated'])
            self.assertEqual(summary['newMeasurements'], 0)
            observed = collections.defaultdict(list)
            for row in csv_rows(packet / POLICY['inputs']['spans']['path']):
                if row['stage'] == POLICY['measuredStage']:
                    observed[tuple(row[name] for name in ['node', 'mode', 'engine', 'label'])].append(float(row['durationMs']))
            rows = list(csv_rows(output / POLICY['outputs']['comparisons']))
            self.assertEqual(len(rows) * len(POLICY['labels']), len(observed))
            for row in rows:
                first, second = [observed[(row['node'], row['mode'], row['engine'], label)] for label in POLICY['labels']]
                self.assertEqual(float(row['medianLabelAMs']), statistics.median(first))
                self.assertEqual(float(row['medianLabelBMs']), statistics.median(second))
                self.assertEqual(int(row['spansLabelA']), len(first))
                self.assertEqual(int(row['spansLabelB']), len(second))
                self.assertEqual(float(row['differencePct']), (statistics.median(second) / statistics.median(first) - 1) * 100)

    def test_native_counter_pointers_reconstruct_all_original_snapshots_and_value_types(self):
        with temporary_directory() as directory:
            output = directory / 'output'
            describe(packet, output)
            expected = {}
            with (packet / POLICY['inputs']['resources']['path']).open(encoding='utf-8') as source:
                for line in source:
                    record = json.loads(line)
                    if 'nativeBaseline' not in record:
                        continue
                    expected[(record['ordinal'], POLICY['observationTypes']['baseline'], '')] = record['nativeBaseline']
                    for ordinal, state in enumerate(record['cleanupTrace']):
                        expected[(record['ordinal'], POLICY['observationTypes']['cleanup'], str(ordinal))] = state['nativeTree']
            reconstructed = collections.defaultdict(dict)
            seen = set()
            for row in csv_rows(output / POLICY['outputs']['nativeCounters']):
                key = (int(row['ordinal']), row['observation'], row['round'])
                identity = (*key, row['pointer'])
                self.assertNotIn(identity, seen)
                seen.add(identity)
                tokens = [token.replace('~1', '/').replace('~0', '~') for token in row['pointer'].split('/')[1:]]
                original = expected[key]
                target = reconstructed[key]
                for token in tokens[:-1]:
                    original = original[token]
                    target = target.setdefault(token, {})
                value = json.loads(row['jsonValue'])
                self.assertEqual(value, original[tokens[-1]])
                self.assertIs(type(value), type(original[tokens[-1]]))
                if isinstance(value, bool):
                    self.assertEqual(row['valueType'], 'boolean')
                target[tokens[-1]] = value
            self.assertEqual(dict(reconstructed), expected)
            memory = json.loads((output / POLICY['outputs']['memory']).read_bytes())
            for family, actual in memory['nativeFamilies'].items():
                baselines = {key[0]: value[family] for key, value in reconstructed.items() if key[1] == POLICY['observationTypes']['baseline']}
                finals = {}
                final_rounds = {}
                for (ordinal, observation, round_index), snapshot in reconstructed.items():
                    if observation == POLICY['observationTypes']['cleanup'] and int(round_index) > final_rounds.get(ordinal, -1):
                        finals[ordinal] = snapshot[family]
                        final_rounds[ordinal] = int(round_index)
                self.assertEqual(actual['baselineLiveValues'], sorted({value['live'] for value in baselines.values()}))
                self.assertEqual(actual['finalLiveValues'], sorted({value['live'] for value in finals.values()}))
                for field, result in [('created', 'createdAfterBaseline'), ('released', 'releasedAfterBaseline')]:
                    self.assertEqual(actual[result], sum(value[field] - baselines[ordinal][field] for ordinal, value in finals.items()))


    def test_clock_intervals_keep_original_bounds_and_missing_modes(self):
        with temporary_directory() as directory:
            output = directory / 'output'
            describe(packet, output)
            with (packet / POLICY['inputs']['clocks']['path']).open(encoding='utf-8') as source:
                originals = [json.loads(line) for line in source]
            rows = list(csv_rows(output / POLICY['outputs']['clocks']))
            self.assertEqual(len(rows), len(originals))
            for row, original in zip(rows, originals, strict=True):
                self.assertEqual(int(row['ordinal']), original['ordinal'])
                self.assertEqual(int(row['pid']), original['pid'])
                for mode in ['cpu', 'jit']:
                    interval = original[mode + 'Offsets']
                    if interval is None:
                        for field in ['OffsetMinUs', 'OffsetMaxUs', 'IntervalWidthUs']:
                            self.assertEqual(row[mode + field], '')
                    else:
                        self.assertEqual(float(row[mode + 'OffsetMinUs']), interval['min'])
                        self.assertEqual(float(row[mode + 'OffsetMaxUs']), interval['max'])
                        self.assertEqual(float(row[mode + 'IntervalWidthUs']), interval['max'] - interval['min'])

    def test_top_frames_keep_original_urls_and_counts_and_do_not_hide_larger_guaranteed_counts(self):
        with temporary_directory() as directory:
            output = directory / 'output'
            describe(packet, output)
            observed = collections.defaultdict(lambda: collections.Counter())
            for row in csv_rows(packet / POLICY['inputs']['frames']['path']):
                if row['stage'] != POLICY['measuredStage']:
                    continue
                frame = tuple(row[name] for name in ['origin', 'functionName', 'url', 'lineNumber', 'columnNumber'])
                observed[(row['node'], row['engine'])][frame] += int(row['guaranteedTicks'])
            selected = collections.defaultdict(dict)
            for row in csv_rows(output / POLICY['outputs']['topFrames']):
                key = (row['node'], row['engine'])
                frame = tuple(row[name] for name in ['origin', 'functionName', 'url', 'lineNumber', 'columnNumber'])
                self.assertNotIn(frame, selected[key])
                self.assertEqual(int(row['guaranteedTicks']), observed[key][frame])
                selected[key][frame] = int(row['guaranteedTicks'])
            self.assertEqual(set(selected), set(observed))
            for key, frames in selected.items():
                self.assertEqual(len(frames), min(POLICY['topFrameLimit'], len(observed[key])))
                omitted = [count for frame, count in observed[key].items() if frame not in frames]
                if omitted:
                    self.assertGreaterEqual(min(frames.values()), max(omitted))

    def test_foreign_outputs_overlap_and_changed_inputs_are_preserved(self):
        with temporary_directory() as directory:
            foreign = directory / 'foreign'
            foreign.mkdir()
            sentinel = foreign / 'caller.txt'
            sentinel.write_bytes(b'caller data')
            with self.assertRaises(FileExistsError):
                describe(packet, foreign)
            self.assertEqual(sentinel.read_bytes(), b'caller data')
            with self.assertRaisesRegex(AssertionError, 'output overlaps'):
                describe(packet, packet / 'not-created')
            self.assertFalse((packet / 'not-created').exists())
            altered = directory / 'altered'
            altered.mkdir()
            for declared in POLICY['inputs'].values():
                target = altered / declared['path']
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(packet / declared['path'], target)
            filename = altered / POLICY['inputs']['analysis']['path']
            filename.write_bytes(filename.read_bytes() + b' ')
            with self.assertRaisesRegex(AssertionError, 'changed input analysis'):
                describe(altered, directory / 'not-created')
            self.assertFalse((directory / 'not-created').exists())
            for declared in POLICY['inputs'].values():
                self.assertEqual(digest(packet / declared['path']), declared['sha256'])


if __name__ == '__main__':
    unittest.main(verbosity=2)
