"""Describe all recorded nine-sample trajectories without new measurements or acceptance changes."""
import importlib.util
import json
import pathlib
import statistics
import sys

root = pathlib.Path(__file__).resolve().parents[2]
archive = root / 'paired-inline/2026-10-22'
previous = root / 'paired-inline-diagnostics/2026-10-22/analyze.py'
specification = importlib.util.spec_from_file_location('recorded_order_analysis', previous)
module = importlib.util.module_from_spec(specification)
specification.loader.exec_module(module)
baseline = module.analyze(archive)
batches = []
rows = []
for row in baseline['rows']:
    observations = []
    for process in row['processes']:
        report = json.loads((archive / process['report']).read_text())
        for batch_index in process['batchPositions']:
            batch = report['batches'][batch_index]
            samples = batch['samplesMs']
            assert len(samples) == 9 and statistics.median(samples) == process['medianMs'][batch['label']]
            blocks = [statistics.median(samples[start:start + 3]) for start in (0, 3, 6)]
            observation = {'node': row['node'], 'phase': row['phase'], 'engine': row['engine'], 'key': row['key'],
                'position': process['position'], 'pid': process['pid'], 'report': process['report'],
                'batchPosition': batch_index, 'label': batch['label'], 'firstBatch': batch['label'] == process['firstLabel'],
                'samplesMs': samples, 'medianMs': statistics.median(samples), 'tertileMediansMs': blocks,
                'earlyOverLatePercent': (blocks[0] / blocks[2] - 1) * 100,
                'maxOverMinPercent': (max(samples) / min(samples) - 1) * 100}
            batches.append(observation)
            observations.append(observation)
    groups = {}
    for order, first in (('first', True), ('second', False)):
        group = [entry for entry in observations if entry['firstBatch'] == first]
        assert len(group) == 8
        groups[order] = {'batches': len(group), 'earlySlowerCount': sum(entry['earlyOverLatePercent'] > 0 for entry in group),
            'medianEarlyOverLatePercent': statistics.median(entry['earlyOverLatePercent'] for entry in group),
            'minEarlyOverLatePercent': min(entry['earlyOverLatePercent'] for entry in group),
            'maxEarlyOverLatePercent': max(entry['earlyOverLatePercent'] for entry in group),
            'medianMaxOverMinPercent': statistics.median(entry['maxOverMinPercent'] for entry in group)}
    rows.append({'node': row['node'], 'phase': row['phase'], 'engine': row['engine'], 'key': row['key'],
        'originalPooledMedianDeltaPercent': row['originalPooledMedianDeltaPercent'],
        'originalRowCalibrated': row['originalRowCalibrated'], 'originalRowWithinBudget': row['originalRowWithinBudget'],
        'originalFirstBatchSlowerProcesses': row['firstBatchSlowerProcesses'],
        'withinBatch': groups})
assert len(batches) == 1024 and sum(len(entry['samplesMs']) for entry in batches) == 9216
result = {'scope': 'Offline descriptive trajectories of all 9,216 recorded durations. No workload run, warmup durations, causal claim or acceptance reevaluation.',
    'archiveFilesVerified': baseline['archiveFilesVerified'], 'batches': batches, 'rows': rows}
output = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else pathlib.Path(__file__).with_name('analysis.json')
with output.open('w', encoding='utf-8', newline='\n') as stream:
    stream.write(json.dumps(result, indent=2) + '\n')
focus = next(row for row in rows if row['node'] == 'v22.12.0' and row['phase'] == 'AA'
    and row['engine'] == 'jsdom' and row['key'] == 'range-control-1000/250')
print(json.dumps({'rows': len(rows), 'batches': len(batches), 'durations': 9216, 'focus': focus}))
