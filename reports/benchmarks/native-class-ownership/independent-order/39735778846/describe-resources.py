"""Describe every recorded memory endpoint, factor and sample position without measuring again."""
import json
import pathlib
import statistics
import sys

cache, source = map(pathlib.Path, sys.argv[1:3])
analysis = json.loads((cache / 'analysis/analysis.json').read_bytes())
assert all(json.loads((cache / (node + '-verification.json')).read_bytes())['verified'] for node in ['node22', 'node24'])
ranges, factors, sample_rows, machines = [], [], [], []
tracked = {'window': 0, 'document': 0}
for node in ['node-22', 'node-24']:
    index = json.loads((source / node / 'index.json').read_bytes())
    settings = index['settings']
    assert index['complete'] and settings['revision'] == 'independent-order-v1' and settings['workerCount'] == 16
    machines.append({'node': index['node'], 'v8': index['v8'], 'machine': index['machine'],
        'startedAt': index['startedAt'], 'finishedAt': index['finishedAt']})
    reports = [(entry, json.loads((source / node / entry['report']).read_bytes())) for entry in index['runs']]
    for entry, report in reports:
        for kind in tracked:
            tracked[kind] += report['batches'][-1]['trackedOwners'][kind]
        for batch in report['batches']:
            samples = batch['samplesMs']
            first, last = statistics.median(samples[:3]), statistics.median(samples[-3:])
            sample_rows.append({'node': index['node'], 'phase': entry['phase'], 'engine': entry['engine'],
                'label': entry['label'], 'position': entry['position'], 'physical': report['schedule']['physical'],
                'row': batch['name'] + '/' + str(batch['size']), 'report': entry['report'],
                'sampleCount': len(samples), 'medianMs': statistics.median(samples),
                'firstThreeMedianMs': first, 'lastThreeMedianMs': last, 'lastVersusFirstPercent': (last / first - 1) * 100,
                'rangeVersusMinimumPercent': (max(samples) / min(samples) - 1) * 100,
                'samplesMs': samples})
    for phase in ['AA', 'AB']:
        for engine in settings['engines']:
            vectors = []
            for position in range(settings['workerCount']):
                entries = [entry for entry in index['runs'] if entry['phase'] == phase and entry['position'] == position]
                engines = list(dict.fromkeys(entry['engine'] for entry in entries))
                pair = [entry for entry in entries if entry['engine'] == engine]
                assert len(pair) == 2
                report = next(report for entry, report in reports if entry == pair[0])
                plan = report['schedule']['factors']
                assert plan['reverseEngines'] == bool(position & 8)
                vector = [engines[0] == engine, plan['reversePair'], plan['reverseAssignment'], plan['reverseRows']]
                vectors.append(tuple(vector))
                factors.append({'node': index['node'], 'phase': phase, 'engine': engine, 'position': position,
                    'engineFirst': vector[0], 'reversePair': vector[1], 'reverseAssignment': vector[2], 'reverseRows': vector[3],
                    'labels': [entry['label'] for entry in pair]})
            assert len(set(vectors)) == 16
            for label in ['A', 'B']:
                selected = [report for entry, report in reports if entry['phase'] == phase and entry['engine'] == engine and entry['label'] == label]
                assert len(selected) == 16
                states = [(number, state) for report in selected for batch in report['batches'] for number, state in enumerate(batch['cleanupTrace'])]
                assert len(states) == 384
                for scope, chosen in [('all cleanup observations', states), ('required final two clear endpoints', [(number, state) for number, state in states if number >= 1])]:
                    ranges.append({'node': index['node'], 'phase': phase, 'engine': engine, 'label': label,
                        'physicalPackages': sorted({report['schedule']['physical'] for report in selected}),
                        'scope': scope, 'observations': len(chosen),
                        'memoryScope': 'Whole process after GC with one selected package; not peak memory',
                        **{name + 'RangeBytes': [min(state['memory'][name] for _, state in chosen), max(state['memory'][name] for _, state in chosen)]
                           for name in ['heapUsed', 'external', 'rss']}})
assert tracked == {'window': 24576, 'document': 24576}
assert len(ranges) == 32 and len(factors) == 128 and len(sample_rows) == 2048
cells = []
for node in ['v22.12.0', 'v24.14.1']:
    for phase in ['AA', 'AB']:
        for engine in ['jsdom', 'rustdom']:
            for label in ['A', 'B']:
                for row in sorted({record['row'] for record in sample_rows}):
                    records = [record for record in sample_rows if record['node'] == node and record['phase'] == phase and record['engine'] == engine and record['label'] == label and record['row'] == row]
                    assert len(records) == 16
                    cells.append({'node': node, 'phase': phase, 'engine': engine, 'label': label, 'row': row,
                        'sampleIndexMediansMs': [statistics.median(record['samplesMs'][number] for record in records) for number in range(9)],
                        'perProcessLastVersusFirstPercentRange': [min(record['lastVersusFirstPercent'] for record in records), max(record['lastVersusFirstPercent'] for record in records)],
                        'perProcessLastVersusFirstMedianPercent': statistics.median(record['lastVersusFirstPercent'] for record in records)})
combinations = {engine: sorted({(entry['engineFirst'], entry['reversePair']) for entry in factors if entry['engine'] == engine}) for engine in ['jsdom', 'rustdom']}
assert all(len(values) == 4 for values in combinations.values())
(cache / 'memory-ranges.json').write_text(json.dumps({'trackedOwnersPerKind': tracked, 'groups': ranges}, indent=2) + '\n')
(cache / 'order-factors.json').write_text(json.dumps({'measurementExecuted': False, 'acceptanceChanged': False,
    'pairOrderAndEngineLeadIndependent': True, 'observedCombinations': combinations, 'pairs': factors,
    'limits': 'The preregistered independent schedule was executed; this does not establish causes of timing drift.'}, indent=2) + '\n')
(cache / 'sample-position-diagnostics.json').write_text(json.dumps({'measurementExecuted': False, 'acceptanceChanged': False,
    'samplesExcluded': False, 'estimatorChanged': False, 'cells': cells,
    'limits': 'Descriptive measured-sample position summaries only. Warmup durations were not retained. These summaries do not establish JIT, GC, I/O or scheduling causes and cannot replace the preregistered decision.'}, indent=2) + '\n')
(cache / 'process-sample-diagnostics.json').write_text(json.dumps(sample_rows, indent=2) + '\n')
(cache / 'machines.json').write_text(json.dumps(machines, indent=2) + '\n')
print(json.dumps({'trackedOwners': tracked, 'memoryGroups': len(ranges), 'factorPairs': len(factors), 'sampleCells': len(cells),
    'uncalibratedRows': [{key: row[key] for key in ['node', 'phase', 'row', 'rustChangePercent', 'controlChangePercent']} for row in analysis['rows'] if not row['calibrated']],
    'machines': machines}))
