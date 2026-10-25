"""Compare every exported record with the authenticated workers; no DOM, mocks or source-text assertions."""
import collections
import csv
import hashlib
import json
from pathlib import Path
import statistics
import sys
import unittest

packet, capture, first, second = map(Path, sys.argv[1:5])
del sys.argv[1:5]
read = lambda filename: json.loads(filename.read_text(encoding='utf-8'))
expected = read(Path(__file__).parent / 'constants/validation.json')
index = read(capture / 'index.json')
summary = read(first / 'analysis.json')


def observations():
    for ordinal, process in enumerate(index['processes']):
        directory = capture / f'{ordinal:04d}'
        yield ordinal, process, read(directory / 'analysis.json'), read(directory / 'report.json'), directory


class CompleteRangeAaDiagnostic(unittest.TestCase):
    def test_both_strict_replays_and_all_exported_files_are_identical_without_accepting_performance(self):
        replay_bytes = (packet / 'replay-node22.json').read_bytes()
        self.assertEqual(replay_bytes, (packet / 'replay-node24.json').read_bytes())
        replay = json.loads(replay_bytes)
        self.assertTrue(replay['verified'] and replay['complete'])
        self.assertIsNone(replay['performanceAccepted'])
        self.assertFalse(replay['gateReevaluated'])
        self.assertEqual(replay['processes'], expected['processes'])
        self.assertEqual((replay['warmupSpans'], replay['measuredSpans']), (expected['warmupSpans'], expected['measuredSpans']))
        self.assertEqual((replay['windows'], replay['documents']), (expected['windows'], expected['documents']))
        self.assertEqual((replay['cpuProfiles'], replay['jitLogs']), (expected['cpuProfiles'], expected['jitLogs']))
        self.assertEqual(replay['firstUnclearStates'], expected['firstUnclearStates'])
        self.assertEqual(replay['finalClearStates'], expected['finalClearStates'])
        hashes = lambda root: {filename.name: hashlib.sha256(filename.read_bytes()).hexdigest() for filename in root.iterdir() if filename.is_file()}
        self.assertEqual(hashes(first), hashes(second))
        self.assertEqual(len(hashes(first)), expected['exportedFiles'])
        self.assertIsNone(summary['performanceAccepted'])
        self.assertFalse(summary['gateReevaluated'])
        self.assertEqual(summary['counts'], replay)
        with (first / 'processes.csv').open(newline='', encoding='utf-8') as source:
            for row in csv.DictReader(source):
                if row['mode'] == 'jit':
                    self.assertEqual(row['negativeCpuDeltas'], '')
                    self.assertEqual(row['cpuProfileTicks'], '')

    def test_every_measured_and_warmup_span_matches_the_original_worker(self):
        counts = collections.Counter()
        with (first / 'spans.csv').open(newline='', encoding='utf-8') as source:
            rows = iter(csv.DictReader(source))
            for ordinal, process, analysis, report, _ in observations():
                for span, original in zip(analysis['spans'], report['batches'][0]['sampleTimings'], strict=True):
                    row = next(rows)
                    self.assertEqual(int(row['ordinal']), ordinal)
                    for name in ['node', 'mode', 'engine', 'label', 'physical']:
                        self.assertEqual(row[name], analysis[name])
                    self.assertEqual(row['phase'], process['input']['phase'])
                    self.assertEqual(int(row['pid']), report['pid'])
                    self.assertEqual(row['stage'], original['stage'])
                    self.assertEqual(float(row['startMs']), original['startMs'])
                    self.assertEqual(float(row['durationMs']), original['durationMs'])
                    for name in ['cpuUserUs', 'cpuSystemUs']:
                        self.assertEqual(int(row[name]), original[name])
                    self.assertEqual(int(row['gcIntersections']), len(span['gcEvents']))
                    self.assertEqual(row['outputHash'], report['batches'][0]['outputHash'])
                    counts[row['stage']] += 1
            self.assertIsNone(next(rows, None))
        self.assertEqual(counts, {'warmup': expected['warmupSpans'], 'measured': expected['measuredSpans']})

    def test_all_three_resource_rounds_preserve_separate_owners_and_constructor_reference_counts(self):
        initial_unclear = 0
        with (first / 'resources.csv').open(newline='', encoding='utf-8') as source:
            rows = iter(csv.DictReader(source))
            for ordinal, _, analysis, report, _ in observations():
                baseline = report.get('nativeBaseline', {}).get('napiClasses')
                for round_index, state in enumerate(analysis['cleanupTrace']):
                    row = next(rows)
                    self.assertEqual(int(row['ordinal']), ordinal)
                    self.assertEqual(int(row['round']), round_index)
                    self.assertEqual(row['clear'], str(state['clear']).lower())
                    for target in ['window', 'document']:
                        self.assertEqual(int(row[target + 'Survivors']), state['survivors'][target])
                    for name, value in state['memory'].items():
                        self.assertEqual(int(row[name]), value)
                    if baseline is None:
                        self.assertEqual(row['constructorReferencesLive'], '')
                    else:
                        native = state['nativeTree']['napiClasses']
                        for field in ['Live', 'Created', 'Released']:
                            self.assertEqual(int(row['constructorReferences' + field]), native[field.lower()])
                            self.assertEqual(int(row['baselineConstructorReferences' + field]), baseline[field.lower()])
                    if round_index > 0:
                        self.assertTrue(state['clear'])
                        self.assertEqual((state['survivors']['window'], state['survivors']['document']), (0, 0))
                initial_unclear += not analysis['cleanupTrace'][0]['clear']
            self.assertIsNone(next(rows, None))
        self.assertEqual(initial_unclear, summary['counts']['firstUnclearStates'])
        self.assertEqual(summary['parentMemory'], index['parentMemory'])

    def test_all_native_families_endpoints_and_owners_are_preserved_in_the_jsonl(self):
        with (first / 'resources-native.jsonl').open(encoding='utf-8') as source:
            rows = (json.loads(line) for line in source)
            for ordinal, process, analysis, report, _ in observations():
                row = next(rows)
                self.assertEqual(row['ordinal'], ordinal)
                self.assertEqual(row['node'], process['node'])
                self.assertEqual(row['pid'], process['pid'])
                self.assertEqual(row['phase'], process['input']['phase'])
                for field in ['mode', 'engine', 'label', 'physical', 'position', 'seed']:
                    self.assertEqual(row[field], analysis[field])
                self.assertEqual('nativeBaseline' in row, 'nativeBaseline' in report)
                if 'nativeBaseline' in report:
                    self.assertEqual(row['nativeBaseline'], report['nativeBaseline'])
                self.assertEqual(row['trackedOwners'], report['batches'][0]['trackedOwners'])
                self.assertEqual(row['memoryAfterCleanup'], report['batches'][0]['memoryAfterCleanup'])
                self.assertEqual(row['cleanupTrace'], report['batches'][0]['cleanupTrace'])
                self.assertEqual(row['cleanupTrace'], analysis['cleanupTrace'])
            self.assertIsNone(next(rows, None))

    def test_clock_evidence_keeps_every_original_offset_bracket_and_process_identity(self):
        description = read(Path(__file__).parent / 'constants/description.json')
        with (packet / description['inputs']['clocks']['path']).open(encoding='utf-8') as source:
            rows = (json.loads(line) for line in source)
            for ordinal, process, analysis, _, _ in observations():
                row = next(rows)
                self.assertEqual(row['ordinal'], ordinal)
                self.assertEqual(row['sourceAnalysisSha256'], process['files']['analysis.json'])
                for name in ['pid', 'node', 'mode', 'engine', 'label', 'physical', 'position', 'seed', 'jitBrackets', 'jitOffsets', 'cpuOffsets']:
                    self.assertEqual(row[name], analysis[name])
            self.assertIsNone(next(rows, None))

    def test_every_cpu_frame_keeps_its_original_url_script_id_and_both_membership_counts(self):
        count = 0
        with (first / 'cpu-frames.csv').open(newline='', encoding='utf-8') as source:
            rows = iter(csv.DictReader(source))
            for ordinal, _, analysis, _, _ in observations():
                for span in analysis['spans']:
                    for counted in span['cpuFrames'] or []:
                        row = next(rows)
                        self.assertEqual(int(row['ordinal']), ordinal)
                        self.assertEqual(int(row['index']), span['index'])
                        self.assertEqual(row['stage'], span['stage'])
                        for name, value in counted['frame'].items():
                            self.assertEqual(row[name], str(value))
                        for name in ['possibleTicks', 'guaranteedTicks']:
                            self.assertEqual(int(row[name]), counted[name])
                        if '/dist/vendor-jsdom/' in row['url']:
                            self.assertEqual(row['origin'], 'compatibility-jsdom')
                        elif row['url'].startswith('node:'):
                            self.assertEqual(row['origin'], 'node')
                        elif row['url'] == '':
                            self.assertEqual(row['origin'], 'unknown')
                        count += 1
            self.assertIsNone(next(rows, None))
        self.assertEqual(count, summary['cpuFrameRows'])

    def test_all_attributed_jit_functions_match_logged_records_and_original_clock_membership(self):
        count = 0
        with (first / 'jit-operation-functions.csv').open(newline='', encoding='utf-8') as source:
            rows = iter(csv.DictReader(source))
            for ordinal, _, analysis, _, directory in observations():
                if analysis['mode'] != 'jit':
                    continue
                lines = (directory / 'v8.log').read_text(encoding='utf-8').split('\n')
                scripts = {}
                for line in lines:
                    if line.startswith('script-details,'):
                        fields = line.split(',')
                        scripts[fields[1]] = fields[2]
                for span in analysis['spans']:
                    for event in span['jitEvents']:
                        if event['kind'] != 'function':
                            continue
                        row = next(rows)
                        self.assertEqual(int(row['ordinal']), ordinal)
                        self.assertEqual(int(row['index']), span['index'])
                        self.assertEqual(row['action'], event['action'])
                        self.assertEqual(row['name'], event['name'])
                        self.assertEqual(float(row['timestampUs']), event['timestampUs'])
                        self.assertEqual(row['guaranteed'], str(event['guaranteed']).lower())
                        fields = lines[int(row['lineNumber']) - 1].split(',')
                        self.assertEqual(fields[0], 'function')
                        self.assertEqual(row['action'], fields[1])
                        self.assertEqual(row['scriptId'], fields[2])
                        self.assertEqual(row['source'], scripts.get(fields[2]) or '')
                        self.assertEqual(row['name'], ','.join(fields[7:]))
                        for field, position in [('startPosition', 3), ('endPosition', 4), ('loggedTimeDelta', 5), ('timestampUs', 6)]:
                            self.assertEqual(float(row[field]), float(fields[position]))
                        lower = float(row['timestampUs']) + analysis['jitOffsets']['min']
                        upper = float(row['timestampUs']) + analysis['jitOffsets']['max']
                        start = span['startMs'] * 1000
                        end = (span['startMs'] + span['durationMs']) * 1000
                        self.assertTrue(upper >= start and lower < end)
                        self.assertEqual(row['guaranteed'] == 'true', lower >= start and upper < end)
                        count += 1
            self.assertIsNone(next(rows, None))
        self.assertEqual(count, summary['attributedOperationFunctionRecords'])

    def test_negative_cpu_deltas_are_preserved_in_original_process_order(self):
        count = 0
        with (first / 'cpu-clock-anomalies.csv').open(newline='', encoding='utf-8') as source:
            rows = iter(csv.DictReader(source))
            for ordinal, _, analysis, _, _ in observations():
                for event in analysis['outOfOrderCpuSamples'] or []:
                    row = next(rows)
                    self.assertEqual(int(row['ordinal']), ordinal)
                    for name, value in event.items():
                        self.assertEqual(float(row[name]), value)
                    self.assertLess(float(row['deltaUs']), 0)
                    count += 1
            self.assertIsNone(next(rows, None))
        self.assertEqual(count, expected['negativeCpuDeltas'])
        self.assertEqual(count, summary['negativeCpuDeltas'])

    def test_all_cells_are_descriptive_and_keep_gc_jit_records_and_reference_lifetimes(self):
        durations = collections.defaultdict(list)
        gc_spans = collections.Counter()
        jit_records = collections.Counter()
        created = released = mutation_created = mutation_released = 0
        for _, process, analysis, report, _ in observations():
            jit_records.update(analysis['jitRecordCounts'] or {})
            for span in analysis['spans']:
                key = (analysis['node'], analysis['mode'], process['input']['phase'], analysis['engine'], analysis['label'], span['stage'])
                durations[key].append(span['durationMs'])
                gc_spans[key] += bool(span['gcEvents'])
            if 'nativeBaseline' in report:
                baseline = report['nativeBaseline']
                final = analysis['cleanupTrace'][-1]['nativeTree']
                created += final['napiClasses']['created'] - baseline['napiClasses']['created']
                released += final['napiClasses']['released'] - baseline['napiClasses']['released']
                mutation_created += final['mutationRecords']['created'] - baseline['mutationRecords']['created']
                mutation_released += final['mutationRecords']['released'] - baseline['mutationRecords']['released']
        self.assertEqual(len(summary['cells']), len(durations))
        self.assertEqual(len(durations), expected['cells'])
        for cell in summary['cells']:
            if cell['mode'] == 'jit':
                for field in ['cpuTicksPossible', 'cpuTicksGuaranteed', 'cpuOrigins']:
                    self.assertIsNone(cell[field])
            else:
                for field in ['jitEvents', 'jitFunctionOrigins']:
                    self.assertIsNone(cell[field])
            key = tuple(cell[name] for name in ['node', 'mode', 'phase', 'engine', 'label', 'stage'])
            self.assertEqual(cell['spans'], len(durations[key]))
            self.assertEqual(cell['medianDurationMs'], statistics.median(durations[key]))
            self.assertEqual(cell['minDurationMs'], min(durations[key]))
            self.assertEqual(cell['maxDurationMs'], max(durations[key]))
            self.assertEqual(cell['spansWithGc'], gc_spans[key])
        self.assertEqual(summary['jitRecordCounts'], jit_records)
        self.assertEqual(summary['constructorReferencesCreatedAfterBaseline'], created)
        self.assertEqual(summary['constructorReferencesReleasedAfterBaseline'], released)
        self.assertEqual(summary['mutationRecordsCreatedAfterBaseline'], mutation_created)
        self.assertEqual(summary['mutationRecordsReleasedAfterBaseline'], mutation_released)


if __name__ == '__main__':
    unittest.main(verbosity=2)
