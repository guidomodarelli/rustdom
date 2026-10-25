"""Describe every original process pair without selecting acceptance evidence."""
from datetime import datetime
from statistics import median


def percent_change(before, after):
    """Return a descriptive relative difference, retaining its sign."""
    return (after / before - 1) * 100


def distribution(values):
    """Retain sample count, median and endpoints; no observations are removed."""
    values = list(values)
    return {'count': len(values), 'min': min(values), 'median': median(values), 'max': max(values)}


def wall_time(text):
    """Parse the parent's ISO wall clock; this is not a monotonic measurement."""
    return datetime.fromisoformat(text.replace('Z', '+00:00'))


def diagnose(declaration, analysis, processes):
    """Reproduce all pooled medians and expose the complete paired dispersion."""
    grouped = {}
    for process in processes:
        identity = process['identity']
        spans = process['spans']
        measured = [float(span['durationMs']) for span in spans if span['stage'] == declaration['measuredStage']]
        warmup = [span for span in spans if span['stage'] == declaration['warmupStage']]
        if len(measured) != declaration['measuredSamples'] or len(warmup) != declaration['warmupSamples']:
            raise ValueError('Calibration metrics: incomplete measured or warmup spans')
        segment = declaration['segmentSamples']
        process.update(samples=measured, medianMs=median(measured), physical=spans[0]['physical'],
            segmentChangePercent=percent_change(median(measured[:segment]), median(measured[-segment:])))
        key = tuple(identity[name] for name in declaration['comparisonFields'])
        grouped.setdefault(key, []).append(process)
    original = {(row['node'], row['phase'], str(row_index)): row
        for node in sorted({row['node'] for row in analysis['comparisons']})
        for phase in declaration['phases']
        for row_index, row in enumerate(row for row in analysis['comparisons'] if row['node'] == node and row['phase'] == phase)}
    rows = []
    pairs = []
    for key, workers in sorted(grouped.items()):
        identity = dict(zip(declaration['comparisonFields'], key))
        reference = original[(identity['node'], identity['phase'], identity['rowIndex'])]
        cells = {label: [worker for worker in workers if worker['identity']['label'] == label] for label in declaration['labels']}
        pooled = {label: median(sample for worker in cell for sample in worker['samples']) for label, cell in cells.items()}
        for label, actual in pooled.items():
            expected = reference[label][identity['engine']]['medianMs']
            if actual != expected:
                raise ValueError(f'Calibration metrics: pooled median differs for {identity}/{label}: {actual} != {expected}')
        indexed = {(worker['identity']['position'], worker['identity']['label']): worker for worker in workers}
        row_pairs = []
        for position in sorted({worker['identity']['position'] for worker in workers}, key=int):
            before = indexed[(position, declaration['labels'][0])]
            after = indexed[(position, declaration['labels'][1])]
            first, second = sorted([before, after], key=lambda worker: worker['ordinal'])
            pair = dict(identity, position=int(position), physicalA=before['physical'], physicalB=after['physical'],
                medianAMs=before['medianMs'], medianBMs=after['medianMs'],
                changePercent=percent_change(before['medianMs'], after['medianMs']),
                firstLabel=first['identity']['label'], ordinalDistance=second['ordinal'] - first['ordinal'],
                startGapWallSeconds=(wall_time(second['startedAt']) - wall_time(first['startedAt'])).total_seconds(),
                idleGapWallSeconds=(wall_time(second['startedAt']) - wall_time(first['finishedAt'])).total_seconds(),
                segmentChangeAPercent=before['segmentChangePercent'], segmentChangeBPercent=after['segmentChangePercent'])
            pair['factors'] = {name: bool(int(position) & mask) for name, mask in declaration['factorMasks'].items()}
            row_pairs.append(pair)
        partitions = {name: {str(value).lower(): distribution(pair['changePercent'] for pair in row_pairs if pair['factors'][name] == value)
            for value in [False, True]} for name in declaration['factorMasks']}
        rows.append(dict(identity, task=reference['key'], pooledMedianMs=pooled,
            originalChangePercent=reference['jsdomControlChangePercent' if identity['engine'] == declaration['controlEngine'] else 'rustdomChangePercent'],
            pairedChangePercent=distribution(pair['changePercent'] for pair in row_pairs), partitions=partitions,
            segmentChangeAPercent=distribution(pair['segmentChangeAPercent'] for pair in row_pairs),
            segmentChangeBPercent=distribution(pair['segmentChangeBPercent'] for pair in row_pairs)))
        pairs.extend(row_pairs)
    return {'runId': declaration['runId'], 'sourceCommit': analysis['sourceCommit'],
        'performanceAccepted': analysis['performanceAccepted'], 'historicalGateReevaluated': False,
        'acceptanceRecomputed': False, 'DOMExecuted': False, 'studyRepeated': False,
        'processes': len(processes), 'pairs': len(pairs), 'rows': rows}, pairs
