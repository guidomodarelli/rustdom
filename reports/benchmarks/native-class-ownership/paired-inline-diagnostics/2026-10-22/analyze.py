"""Describe all recorded batch orders; never measure workloads or change acceptance."""
import argparse
import hashlib
import json
import math
import statistics
from pathlib import Path


def analyze(archive):
    """Reproduce original medians before describing order associations for every row."""
    verified_files = 0
    for entry in json.loads((archive / 'files.json').read_text()):
        raw = (archive / entry['path']).read_bytes()
        assert len(raw) == entry['bytes']
        assert hashlib.sha256(raw).hexdigest() == entry['sha256'], entry['path']
        verified_files += 1
    result = {'scope': 'Offline descriptive analysis of every recorded row; not a new estimator, causal proof or acceptance.',
        'archive': 'paired-inline/2026-10-22', 'archiveFilesVerified': verified_files,
        'measuredDurations': 0, 'rows': []}
    for label in ('node-22', 'node-24'):
        index = json.loads((archive / label / 'index.json').read_text())
        assert index['complete'] and index['accepted'] is False
        reports = {entry['report']: json.loads((archive / label / entry['report']).read_text()) for entry in index['runs']}
        for phase, original_rows in index['summaries'].items():
            for engine in ('jsdom', 'rustdom'):
                workers = [entry for entry in index['runs'] if entry['phase'] == phase and entry['engine'] == engine]
                assert len(workers) == 8
                for original in original_rows:
                    pooled = {'A': [], 'B': []}
                    medians = {'A': [], 'B': []}
                    processes = []
                    for entry in workers:
                        worker = reports[entry['report']]
                        batches = [(position, batch) for position, batch in enumerate(worker['batches'])
                            if f"{batch['name']}/{batch['rows']}" == original['key']]
                        assert len(batches) == 2
                        values = {}
                        for batch_position, batch in batches:
                            samples = batch['samplesMs']
                            assert len(samples) == 9 and all(math.isfinite(sample) and sample > 0 for sample in samples)
                            pooled[batch['label']].extend(samples)
                            medians[batch['label']].append(statistics.median(samples))
                            values[batch['label']] = statistics.median(samples)
                            result['measuredDurations'] += len(samples)
                        first = batches[0][1]['label']
                        second = batches[1][1]['label']
                        processes.append({'position': entry['position'], 'pid': entry['pid'],
                            'report': f"{label}/{entry['report']}", 'batchPositions': [position for position, batch in batches],
                            'loadOrder': worker['schedule']['loadOrder'], 'physical': worker['schedule']['physical'],
                            'firstLabel': first, 'secondLabel': second, 'medianMs': values,
                            'labelMedianDeltaPercent': (values['B'] / values['A'] - 1) * 100,
                            'firstToSecondMedianDeltaPercent': (values[first] / values[second] - 1) * 100})
                    for runtime in ('A', 'B'):
                        assert len(pooled[runtime]) == 72
                        assert medians[runtime] == original[runtime][engine]['processMediansMs']
                        assert statistics.median(pooled[runtime]) == original[runtime][engine]['medianMs']
                    delta = (statistics.median(pooled['B']) / statistics.median(pooled['A']) - 1) * 100
                    field = 'jsdomControlChangePercent' if engine == 'jsdom' else 'rustdomChangePercent'
                    assert math.isclose(delta, original[field], rel_tol=1e-12, abs_tol=1e-12)
                    order_changes = [process['firstToSecondMedianDeltaPercent'] for process in processes]
                    result['rows'].append({'node': index['node'], 'phase': phase, 'engine': engine, 'key': original['key'],
                        'originalPooledMedianDeltaPercent': delta,
                        'originalRowCalibrated': original['calibrated'], 'originalRowWithinBudget': original['withinBudget'],
                        'processes': processes, 'firstBatchSlowerProcesses': sum(change > 0 for change in order_changes),
                        'firstToSecondProcessMedianDeltaPercent': {'min': min(order_changes),
                            'median': statistics.median(order_changes), 'max': max(order_changes)},
                        'byFirstLabel': {runtime: {'processes': sum(process['firstLabel'] == runtime for process in processes),
                            'medianFirstToSecondDeltaPercent': statistics.median(process['firstToSecondMedianDeltaPercent']
                                for process in processes if process['firstLabel'] == runtime)} for runtime in ('A', 'B')}})
    assert len(result['rows']) == 64 and result['measuredDurations'] == 9216
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    arguments = parser.parse_args()
    archive = Path(__file__).resolve().parents[2] / 'paired-inline/2026-10-22'
    result = analyze(archive)
    with arguments.output.open('w', encoding='utf-8', newline='\n') as stream:
        stream.write(json.dumps(result, indent=2) + '\n')
    focus = next(row for row in result['rows'] if row['node'] == 'v22.12.0' and row['phase'] == 'AA'
        and row['engine'] == 'jsdom' and row['key'] == 'range-control-1000/250')
    print(json.dumps({'rows': len(result['rows']), 'measuredDurations': result['measuredDurations'],
        'focusFirstBatchSlowerProcesses': focus['firstBatchSlowerProcesses'],
        'focusOrderDeltaPercent': focus['firstToSecondProcessMedianDeltaPercent'],
        'focusByFirstLabel': focus['byFirstLabel']}))
