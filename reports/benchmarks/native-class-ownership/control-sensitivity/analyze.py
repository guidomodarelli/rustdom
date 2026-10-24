"""Describe deletion sensitivity of stored controls without changing acceptance."""
import collections
import hashlib
import json
import math
import pathlib
import statistics
import sys


def pooled_change(positions, omitted=None):
    """Use the original ratio of pooled medians, retaining within-process samples."""
    samples = {label: [sample for position, pair in enumerate(positions)
                       if position != omitted for sample in pair[label]]
               for label in ['A', 'B']}
    return (statistics.median(samples['B']) / statistics.median(samples['A']) - 1) * 100


def sensitivity(positions, budget_percent):
    """Omit each complete A/B process pair in turn; never select an accepted subset."""
    if len(positions) < 2:
        raise ValueError('Control sensitivity requires at least two complete paired positions')
    for position, pair in enumerate(positions):
        for label in ['A', 'B']:
            values = pair[label]
            if not values or any(not math.isfinite(value) or value <= 0 for value in values):
                raise ValueError(f'Control sensitivity position {position}, label {label}: durations must be finite and positive')
    nominal = pooled_change(positions)
    scenarios = [{'omittedPosition': position, 'changePercent': pooled_change(positions, position)}
                 for position in range(len(positions))]
    return {'nominalChangePercent': nominal, 'nominalCalibrated': abs(nominal) <= budget_percent,
            'leaveOnePositionOut': scenarios,
            'leaveOnePositionOutCalibrated': sum(abs(item['changePercent']) <= budget_percent for item in scenarios),
            'minimumChangePercent': min(item['changePercent'] for item in scenarios),
            'maximumChangePercent': max(item['changePercent'] for item in scenarios)}


def analyze(source):
    """Cross-check every control row against the already verified frozen result."""
    study = json.loads((pathlib.Path(__file__).parent / 'constants/study.json').read_bytes())
    inputs = [source / name for name in ['process-sample-diagnostics.json', 'analysis/analysis.json', 'constants/profiles.json']]
    observations, official, configuration = [json.loads(path.read_bytes()) for path in inputs]
    settings = configuration['profiles'][official['readerProfile']]
    assert official['readerProfile'] == study['readerProfile'] and official['accepted'] is False
    expected_processes = (len(settings['nodeVersions']) * len(settings['phases']) * len(settings['engines'])
                          * settings['workerCount'] * len(settings['labels']))
    assert official['processes'] == expected_processes
    assert official['durations'] == expected_processes * len(settings['rows']) * settings['measuredSamples']
    groups = collections.defaultdict(dict)
    for item in observations:
        if item['engine'] != 'jsdom':
            continue
        key = (item['node'], item['phase'], item['row'])
        identity = (item['position'], item['label'])
        assert identity not in groups[key]
        assert len(item['samplesMs']) == settings['measuredSamples']
        groups[key][identity] = item['samplesMs']
    expected_keys = {(node, phase, row) for node in settings['nodeVersions']
                     for phase in settings['phases'] for row in settings['rows']}
    assert set(groups) == expected_keys
    assert len(official['rows']) == len(expected_keys)
    assert {(item['node'], item['phase'], item['row']) for item in official['rows']} == expected_keys
    identities = {(position, label) for position in range(settings['workerCount']) for label in settings['labels']}
    rows = []
    for reference in official['rows']:
        key = (reference['node'], reference['phase'], reference['row'])
        group = groups[key]
        assert set(group) == identities
        positions = [{label: group[(position, label)] for label in settings['labels']}
                     for position in range(settings['workerCount'])]
        result = sensitivity(positions, settings['controlBudgetPercent'])
        assert math.isclose(result['nominalChangePercent'], reference['controlChangePercent'], rel_tol=0, abs_tol=1e-12)
        rows.append({'node': key[0], 'phase': key[1], 'row': key[2], **result})
    return {'diagnosticOnly': True, 'measurementsExecuted': False, 'gateReevaluated': False,
            'accepted': None, 'officialAccepted': official['accepted'], 'acceptanceChanged': False,
            'sourceRunId': study['sourceRunId'], 'readerProfile': official['readerProfile'],
            'inputFiles': [{'path': path.relative_to(source).as_posix(), 'bytes': path.stat().st_size,
                            'sha256': hashlib.sha256(path.read_bytes()).hexdigest()} for path in inputs],
            'controlBudgetPercent': settings['controlBudgetPercent'],
            'controlProcesses': len(settings['nodeVersions']) * len(settings['phases']) * settings['workerCount'] * len(settings['labels']),
            'controlDurations': sum(len(samples) for group in groups.values() for samples in group.values()),
            'controlRows': len(rows), 'omissionScenarios': len(rows) * settings['workerCount'],
            'nominalFailures': sum(not row['nominalCalibrated'] for row in rows),
            'nominalFailuresOutsideBudgetInEveryScenario': sum(not row['nominalCalibrated'] and row['leaveOnePositionOutCalibrated'] == 0 for row in rows),
            'nominalPassingRowsWithFailingScenarios': sum(row['nominalCalibrated'] and row['leaveOnePositionOutCalibrated'] < settings['workerCount'] for row in rows),
            'limits': 'Exploratory deletion sensitivity, not new samples, confidence intervals, a power calculation or an alternative acceptance estimator. All original data and the rejected official decision remain unchanged. No position may be dropped for acceptance. No cause or required replication count is inferred.',
            'rows': rows}


if __name__ == '__main__':
    source, output = map(pathlib.Path, sys.argv[1:3])
    result = analyze(source)
    with output.open('x', encoding='utf-8', newline='\n') as stream:
        json.dump(result, stream, indent=2)
        stream.write('\n')
    print(json.dumps({key: value for key, value in result.items() if key not in ['rows', 'inputFiles', 'limits']}))
