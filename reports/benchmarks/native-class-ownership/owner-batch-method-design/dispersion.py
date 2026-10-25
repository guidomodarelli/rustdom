"""Describe archived span dispersion without measuring DOM, changing estimators, or accepting performance."""
import csv
import hashlib
import io
import itertools
import json
import math
from pathlib import Path
import statistics
import sys

if sys.flags.optimize:
    raise RuntimeError('Dispersion requires non-optimized Python')

POLICY = json.loads((Path(__file__).parent / 'constants/diagnostic.json').read_bytes())


def process_statistics(samples):
    """Return finite sample moments and a descriptive first/last-third contrast in original order."""
    if not isinstance(samples, list) or len(samples) < 3 or len(samples) % 3:
        raise ValueError('Dispersion: supply at least three durations in equal thirds')
    if any(isinstance(value, bool) or not isinstance(value, (int, float)) or
           not math.isfinite(value) or value <= 0 for value in samples):
        raise ValueError('Dispersion: every duration must be positive and finite')
    average = statistics.mean(samples)
    try:
        variance = statistics.variance(samples)
    except OverflowError as error:
        raise ValueError('Dispersion: sample variance is not representable') from error
    width = len(samples) // 3
    change = 100 * (statistics.mean(samples[-width:]) / statistics.mean(samples[:width]) - 1)
    if not all(math.isfinite(value) for value in [average, variance, change]):
        raise ValueError('Dispersion: sample moments are not representable')
    return {'meanMs': average, 'sampleVarianceMsSquared': variance,
            'firstLastThirdChangePercent': change}


def group_statistics(processes):
    """Keep a signed descriptive moment contrast; it is not a nonnegative variance-component estimate."""
    if len(processes) < 2 or len({len(samples) for samples in processes}) != 1:
        raise ValueError('Dispersion: require two or more equally sized process observations')
    records = [process_statistics(samples) for samples in processes]
    average = statistics.mean(record['meanMs'] for record in records)
    within = statistics.mean(record['sampleVarianceMsSquared'] for record in records)
    try:
        between = statistics.variance(record['meanMs'] for record in records)
    except OverflowError as error:
        raise ValueError('Dispersion: process means variance is not representable') from error
    contribution = within / len(processes[0])
    return {'processes': len(processes), 'spansPerProcess': len(processes[0]),
            'meanMs': average, 'meanWithinProcessVarianceMsSquared': within,
            'processMeansVarianceMsSquared': between,
            'withinVarianceDividedBySpanCountMsSquared': contribution,
            'signedMomentContrastMsSquared': between - contribution,
            'withinToMeansVarianceRatio': contribution / between if between else None,
            'pooledWithinCVPercent': 100 * math.sqrt(within) / average,
            'processMeansCVPercent': 100 * math.sqrt(between) / average,
            'meanFirstLastThirdChangePercent': statistics.mean(
                record['firstLastThirdChangePercent'] for record in records)}


def read_verified(repository, descriptor):
    """Read one bounded, independent regular data file after exact byte authentication."""
    filename = repository / descriptor['path']
    status = filename.lstat()
    if filename.is_symlink() or not filename.is_file() or status.st_nlink != 1:
        raise ValueError('Dispersion: expected independent regular input ' + descriptor['path'])
    if status.st_size != descriptor['bytes'] or status.st_size > POLICY['inputLimitBytes']:
        raise ValueError('Dispersion: unexpected input size ' + descriptor['path'])
    content = filename.read_bytes()
    if hashlib.sha256(content).hexdigest() != descriptor['sha256']:
        raise ValueError('Dispersion: input checksum changed ' + descriptor['path'])
    return content


def analyze(repository):
    """Validate the complete historical matrix and describe every process without resampling or filtering."""
    assert POLICY['executionReady'] is False
    inputs = {name: read_verified(repository, identity) for name, identity in POLICY['inputs'].items()}
    decision = json.loads(inputs['decision'])
    historical = json.loads(inputs['analysis'])
    assert decision['complete'] and decision['captureAuthenticated']
    assert decision['performanceAccepted'] is False and decision['gateReevaluated'] is True
    assert decision['transport']['runId'] == POLICY['sourceRunId']
    assert decision['transport']['head'] == POLICY['sourceCommit']
    comparison = decision['payload']['comparison']['results']
    assert len(comparison) == POLICY['comparisons'] == len(historical['results'])
    reader = csv.DictReader(io.StringIO(inputs['spans'].decode('utf-8')))
    assert reader.fieldnames == POLICY['spanColumns']
    processes = {}
    for row in reader:
        assert set(row) == set(POLICY['spanColumns'])
        node, phase, engine, label = [row[name] for name in ['node', 'phase', 'engine', 'label']]
        position, row_index, span = [int(row[name]) for name in ['position', 'rowIndex', 'span']]
        assert node in POLICY['nodes'] and phase in POLICY['phases']
        assert engine in POLICY['engines'] and label in POLICY['labels']
        assert 0 <= position < POLICY['pairsPerComparison'] and int(row['seed']) == position + 1
        assert 0 <= row_index < len(POLICY['rows'])
        assert row['name'] + '/' + row['size'] == POLICY['rows'][row_index]
        assert row['physical'] in POLICY['physicalPackages']
        key = (node, phase, engine, label, row_index, position)
        process = processes.setdefault(key, {'pid': int(row['pid']), 'physical': row['physical'],
                                             'outputHash': row['outputHash'], 'spans': []})
        assert process['pid'] == int(row['pid']) and process['physical'] == row['physical']
        assert process['outputHash'] == row['outputHash'] and span == len(process['spans'])
        assert row['stage'] == ('warmup' if span < POLICY['warmupSpansPerProcess'] else 'measured')
        duration = float(row['durationMs'])
        assert math.isfinite(duration) and duration > 0
        process['spans'].append(duration)
    expected = list(itertools.product(POLICY['nodes'], POLICY['phases'], POLICY['engines'], POLICY['labels'],
                                      range(len(POLICY['rows'])), range(POLICY['pairsPerComparison'])))
    assert set(processes) == set(expected) and len(processes) == POLICY['processes']
    rows = []
    for node, phase, engine, label, row_index, position in expected:
        process = processes[(node, phase, engine, label, row_index, position)]
        assert len(process['spans']) == POLICY['warmupSpansPerProcess'] + POLICY['measuredSpansPerProcess']
        warmup = process['spans'][:POLICY['warmupSpansPerProcess']]
        samples = process['spans'][POLICY['warmupSpansPerProcess']:]
        reference = next(result for result in comparison if result['node'] == node and
                         result['phase'] == phase and result['engine'] == engine and
                         result['key'] == POLICY['rows'][row_index])
        statistics_record = process_statistics(samples)
        original_mean = reference['processPairs'][position]['baselineMeanMs' if label == 'A' else 'candidateMeanMs']
        assert math.isclose(statistics_record['meanMs'], original_mean,
                            rel_tol=POLICY['numericVerificationTolerance'], abs_tol=POLICY['numericVerificationTolerance'])
        rows.append({'node': node, 'phase': phase, 'engine': engine, 'label': label,
                     'row': POLICY['rows'][row_index], 'position': position,
                     'pid': process['pid'], 'physical': process['physical'], 'outputHash': process['outputHash'],
                     'warmupMs': warmup, 'samplesMs': samples, **statistics_record})
    groups = []
    for node, phase, engine, label, row in itertools.product(POLICY['nodes'], POLICY['phases'],
            POLICY['engines'], POLICY['labels'], POLICY['rows']):
        selected = [record for record in rows if (record['node'], record['phase'], record['engine'],
                    record['label'], record['row']) == (node, phase, engine, label, row)]
        groups.append({'node': node, 'phase': phase, 'engine': engine, 'label': label, 'row': row,
                       **group_statistics([record['samplesMs'] for record in selected])})
    assert len(groups) == POLICY['groups']
    controls = [result for result in historical['results'] if result['engine'] == 'jsdom']
    jsdom_groups = [group for group in groups if group['engine'] == 'jsdom']
    summary = {'jsdomCriteria': len(controls), 'jsdomCriteriaRejected': sum(not result['passesBudget'] for result in controls),
               'jsdomPointsOutsideBudget': sum(abs(result['pointChangePercent']) > POLICY['controlBudgetPercent'] for result in controls),
               'medianJsdomIntervalWidthPercent': statistics.median(result['upperChangePercent'] - result['lowerChangePercent'] for result in controls),
               'medianJsdomPooledWithinCVPercent': statistics.median(group['pooledWithinCVPercent'] for group in jsdom_groups),
               'medianJsdomProcessMeansCVPercent': statistics.median(group['processMeansCVPercent'] for group in jsdom_groups),
               'negativeSignedMomentContrasts': sum(group['signedMomentContrastMsSquared'] < 0 for group in groups)}
    return {'revision': POLICY['revision'], 'purpose': POLICY['purpose'], 'inputs': POLICY['inputs'],
            'processCount': len(rows), 'measuredSpans': sum(len(row['samplesMs']) for row in rows),
            'warmupSpans': sum(len(row['warmupMs']) for row in rows), 'groups': groups, 'processes': rows,
            'summary': summary, 'historicalPerformanceAccepted': False,
            'historicalCriteriaPassed': historical['passed'], 'historicalCriteriaFailed': historical['failed'],
            'measurementExecuted': False, 'DOMExecuted': False, 'archivedCodeExecuted': False,
            'resampled': False, 'performanceAccepted': None, 'gateReevaluated': False, 'executionReady': False}


if __name__ == '__main__':
    if sys.flags.optimize:
        raise RuntimeError('Dispersion requires non-optimized Python')
    repository, output = [Path(argument).resolve() for argument in sys.argv[1:3]]
    result = analyze(repository)
    with output.open('x', encoding='utf-8', newline='\n') as stream:
        json.dump(result, stream, indent=2, ensure_ascii=False, allow_nan=False)
        stream.write('\n')
    print(json.dumps(result['summary'], ensure_ascii=False))
