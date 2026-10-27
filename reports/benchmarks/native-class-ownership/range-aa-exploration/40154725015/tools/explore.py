"""Describe existing AA pairs and within-process time order; never capture or accept performance."""
import collections
import csv
import hashlib
import json
from pathlib import Path
import statistics
import sys

if sys.flags.optimize:
    raise RuntimeError('Range AA exploration requires non-optimized Python')

POLICY = json.loads((Path(__file__).parent / 'constants/exploration.json').read_bytes())


def digest(path):
    """Return the original file SHA256, without normalizing bytes."""
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read_csv(path):
    """Read a complete authenticated analytical export using the standard CSV parser."""
    with path.open(encoding='utf-8', newline='') as stream:
        return list(csv.DictReader(stream))


def difference_percent(before, after):
    """Describe a positive-duration ratio; this function has no acceptance threshold."""
    assert before > 0 and after > 0, 'Range AA exploration: require positive durations'
    return 100 * (after / before - 1)


def write_csv(path, rows):
    """Write all rows in deterministic encounter order, preserving explicit identities."""
    assert rows, 'Range AA exploration: empty result table'
    with path.open('x', encoding='utf-8', newline='') as stream:
        writer = csv.DictWriter(stream, fieldnames=list(rows[0]), lineterminator='\n')
        writer.writeheader()
        writer.writerows(rows)


def analyze(source, output):
    """Authenticate published inputs, describe every process/pair/index and preserve cohort differences."""
    source = source.resolve(strict=True)
    output = output.parent.resolve(strict=True) / output.name
    assert output != source and not output.is_relative_to(source) and not source.is_relative_to(output), \
        'Range AA exploration: output overlaps input'
    assert not output.exists() and not output.is_symlink(), 'Range AA exploration: preserve existing output'
    for name, expected in POLICY['inputs'].items():
        assert digest(source / name) == expected, 'Range AA exploration: input digest mismatch ' + name
    replay = json.loads((source / 'replay-node22.json').read_bytes())
    assert replay['complete'] and replay['verified']
    assert replay['sourceCommit'] == POLICY['sourceCommit']
    processes = read_csv(source / 'processes.csv')
    spans = read_csv(source / 'spans.csv')
    assert len(processes) == POLICY['expectedProcesses']
    by_ordinal = {process['ordinal']: process for process in processes}
    assert len(by_ordinal) == len(processes)
    per_process = collections.defaultdict(dict)
    per_index = collections.defaultdict(list)
    per_cohort_label = collections.defaultdict(list)
    cohort_fields = POLICY['cohortFields']
    for span in spans:
        process = by_ordinal[span['ordinal']]
        assert all(span[field] == process[field] for field in POLICY['processFields'])
        index = int(span['index'])
        expected_stage = 'warmup' if index in POLICY['warmupIndexes'] else 'measured'
        assert span['stage'] == expected_stage
        assert index not in per_process[process['ordinal']]
        duration = float(span['durationMs'])
        assert duration > 0
        per_process[process['ordinal']][index] = duration
        cohort = tuple(process[field] for field in cohort_fields)
        per_index[(*cohort, process['label'], span['stage'], index)].append(duration)
        if span['stage'] == 'measured':
            per_cohort_label[(*cohort, process['label'])].append(duration)
    pairs = collections.defaultdict(dict)
    drifts = []
    expected_indexes = set(POLICY['warmupIndexes'] + POLICY['measuredIndexes'])
    for process in processes:
        observed = per_process[process['ordinal']]
        assert set(observed) == expected_indexes
        measured = [observed[index] for index in POLICY['measuredIndexes']]
        assert statistics.median(measured) == float(process['medianMeasuredMs'])
        cohort = tuple(process[field] for field in cohort_fields)
        key = (*cohort, process['position'])
        assert process['label'] in POLICY['labels'] and process['label'] not in pairs[key]
        pairs[key][process['label']] = process
        early = statistics.median(observed[index] for index in POLICY['earlyIndexes'])
        late = statistics.median(observed[index] for index in POLICY['lateIndexes'])
        drifts.append({field: process[field] for field in POLICY['processFields']} |
                      {'earlyMeasuredMedianMs': early, 'lateMeasuredMedianMs': late,
                       'lateVsEarlyPct': difference_percent(early, late)})
    pair_rows = []
    by_cohort = collections.defaultdict(list)
    for key, pair in pairs.items():
        assert set(pair) == set(POLICY['labels'])
        left, right = pair['A'], pair['B']
        assert left['seed'] == right['seed'] and left['physical'] != right['physical']
        median_a, median_b = float(left['medianMeasuredMs']), float(right['medianMeasuredMs'])
        row = dict(zip([*cohort_fields, 'position'], key)) | {
            'seed': left['seed'], 'ordinalA': left['ordinal'], 'ordinalB': right['ordinal'],
            'physicalA': left['physical'], 'physicalB': right['physical'],
            'aBeforeB': int(left['ordinal']) < int(right['ordinal']),
            'processMedianAMs': median_a, 'processMedianBMs': median_b,
            'processMedianDifferencePct': difference_percent(median_a, median_b)}
        pair_rows.append(row)
        by_cohort[key[:-1]].append(row)
    assert len(by_cohort) == POLICY['expectedCohorts']
    cohort_rows = []
    for key, rows in by_cohort.items():
        assert len(rows) == POLICY['positionsPerCohort']
        ratios = [row['processMedianDifferencePct'] for row in rows]
        median_a = statistics.median(per_cohort_label[(*key, 'A')])
        median_b = statistics.median(per_cohort_label[(*key, 'B')])
        cohort_drifts = [row['lateVsEarlyPct'] for row in drifts if tuple(row[field] for field in cohort_fields) == key]
        cohort_rows.append(dict(zip(cohort_fields, key)) | {
            'pairs': len(rows), 'pooledMeasuredMedianAMs': median_a, 'pooledMeasuredMedianBMs': median_b,
            'pooledMedianDifferencePct': difference_percent(median_a, median_b),
            'medianPairedProcessDifferencePct': statistics.median(ratios),
            'minPairDifferencePct': min(ratios), 'maxPairDifferencePct': max(ratios),
            'pairsBSlower': sum(ratio > 0 for ratio in ratios),
            'medianLateVsEarlyPct': statistics.median(cohort_drifts),
            'minLateVsEarlyPct': min(cohort_drifts), 'maxLateVsEarlyPct': max(cohort_drifts)})
    span_rows = []
    for key, durations in per_index.items():
        assert len(durations) == POLICY['positionsPerCohort']
        span_rows.append(dict(zip([*cohort_fields, 'label', 'stage', 'index'], key)) |
                         {'processes': len(durations), 'medianMs': statistics.median(durations),
                          'minMs': min(durations), 'maxMs': max(durations)})
    description = json.loads((source / 'diagnostic-description.json').read_bytes())
    for row, prior in zip(cohort_rows, description['comparisons'], strict=True):
        assert all(row[field] == prior[field] for field in cohort_fields)
        assert row['pooledMedianDifferencePct'] == prior['differencePct']
    summary = {'revision': POLICY['revision'], 'diagnosticOnly': True, 'exploratory': True,
               'sourceCommit': POLICY['sourceCommit'], 'runId': POLICY['runId'], 'inputs': POLICY['inputs'],
               'processes': len(processes), 'pairs': len(pair_rows), 'cohorts': len(cohort_rows),
               'warmupSpans': len(processes) * len(POLICY['warmupIndexes']),
               'measuredSpans': len(processes) * len(POLICY['measuredIndexes']),
               'spanIndexGroups': len(span_rows), 'processDrifts': len(drifts),
               'earlyMeasuredIndexes': POLICY['earlyIndexes'], 'lateMeasuredIndexes': POLICY['lateIndexes'],
               'newMeasurements': 0, 'DOMExecuted': False, 'performanceAccepted': None,
               'gateReevaluated': False, 'historicalOwnershipPerformanceAccepted': False,
               'scope': 'Descriptive post-hoc contrasts of existing paired medians and time order. No threshold, inference of stationarity, causal attribution or replacement of the historical estimator.'}
    output.mkdir()
    for name, rows in [('pairs.csv', pair_rows), ('cohorts.csv', cohort_rows),
                       ('span-order.csv', span_rows), ('process-drift.csv', drifts)]:
        write_csv(output / name, rows)
    (output / 'summary.json').write_text(json.dumps(summary, indent=2) + '\n', encoding='utf-8', newline='\n')
    return {name: digest(output / name) for name in POLICY['outputs']}


if __name__ == '__main__':
    assert len(sys.argv) == 3, 'Provide original published packet and fresh output directory'
    print(json.dumps(analyze(Path(sys.argv[1]), Path(sys.argv[2]))))
