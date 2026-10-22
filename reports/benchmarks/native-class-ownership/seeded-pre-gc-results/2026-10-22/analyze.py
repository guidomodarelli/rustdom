"""Derive deterministic reports from the complete original study without collecting new timings."""
import argparse
import hashlib
import json
import pathlib
import statistics


def write_json(filename, value):
    """Create a report or require an existing report to have exactly the same bytes."""
    raw = (json.dumps(value, indent=2) + '\n').encode('utf-8')
    filename.parent.mkdir(parents=True, exist_ok=True)
    if filename.exists():
        assert filename.read_bytes() == raw, f'Preserve changed report instead of overwriting it: {filename}'
    else:
        with filename.open('xb') as output:
            output.write(raw)


parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--study', required=True, type=pathlib.Path)
parser.add_argument('--output', required=True, type=pathlib.Path)
parser.add_argument('--memory', required=True, type=pathlib.Path)
arguments = parser.parse_args()
verification = json.loads((arguments.study / 'verification.json').read_bytes())
receipt = json.loads((arguments.output / 'receipt.json').read_bytes())
assert verification == receipt['result'] and verification['verified'] is True
assert receipt['archiveReadbackMatched'] is True and receipt['verificationOriginalAndRelocatedIdentical'] is True
publication = json.loads((arguments.study / 'publication.json').read_bytes())
results = []
memory_groups = []
owner_observations = {'window': 0, 'document': 0}
warmup_observations = {'window': 0, 'document': 0}
for label, node in zip(['node-22', 'node-24'], verification['results']):
    index = json.loads((arguments.study / label / 'index.json').read_bytes())
    assert index['complete'] is True and len(index['runs']) == 128
    assert all(entry['exitCode'] == 0 and entry['signal'] is None and entry['error'] is None for entry in index['runs'])
    rows = [{'phase': phase, 'key': row['key'], 'jsdomControlChangePercent': row['jsdomControlChangePercent'],
             'rustdomChangePercent': row['rustdomChangePercent'], 'calibrated': row['calibrated'],
             'withinBudget': row['withinBudget']}
            for phase, group in node['summaries'].items() for row in group]
    controls = [row for row in rows if abs(row['jsdomControlChangePercent']) > index['settings']['controlBudgetPercent']]
    rust = [row for row in rows if (abs(row['rustdomChangePercent']) if row['phase'] == 'AA'
                                  else row['rustdomChangePercent']) > index['settings']['rustBudgetPercent']]
    results.append({'node': node['node'], 'complete': True, 'accepted': node['accepted'],
                    'workers': node['processes'], 'workerFailures': 0,
                    'measuredDurations': node['measuredDurations'], 'rows': rows,
                    'jsdomControlFailures': controls, 'numericRustBudgetFailures': rust,
                    'machine': index['machine'], 'nodeProcess': json.loads((arguments.study / f'{label}.process.json').read_bytes())})
    for engine in ['jsdom', 'rustdom']:
        reports = [json.loads((arguments.study / label / entry['report']).read_bytes())
                   for entry in index['runs'] if entry['engine'] == engine]
        assert len(reports) == 64
        endpoints = []
        deltas = {field: [] for field in ['rss', 'heapTotal', 'heapUsed', 'external', 'arrayBuffers']}
        for report in reports:
            assert report['complete'] is True and len(report['batches']) == 8
            first = report['batches'][0]['cleanupTrace'][-1]
            last = report['batches'][-1]['cleanupTrace'][-1]
            assert last['clear'] is True and last['survivors'] == {'window': 0, 'document': 0}
            assert all(endpoint['clear'] is True for batch in report['batches']
                       for endpoint in batch['cleanupTrace'][-index['settings']['requiredClearRounds']:])
            for kind in owner_observations:
                owner_observations[kind] += report['batches'][-1]['trackedOwners'][kind]
                warmup_observations[kind] += len(report['batches']) * index['settings']['warmupSamples']
            endpoints.append(last['memory'])
            for field in deltas:
                deltas[field].append(last['memory'][field] - first['memory'][field])
        memory_groups.append({'node': node['node'], 'engine': engine, 'workers': len(reports),
            'finalSurvivors': {'window': 0, 'document': 0},
            'finalCleanupMemoryBytes': {field: {'minimum': min(endpoint[field] for endpoint in endpoints),
                'median': statistics.median(endpoint[field] for endpoint in endpoints),
                'maximum': max(endpoint[field] for endpoint in endpoints)} for field in deltas},
            'lastMinusFirstBatchCleanupBytes': {field: {'minimum': min(values),
                'median': statistics.median(values), 'maximum': max(values)} for field, values in deltas.items()}})

assert sum(result['workers'] for result in results) == 256
assert sum(result['measuredDurations'] for result in results) == 18432
assert owner_observations == {'window': 24576, 'document': 24576}
assert warmup_observations == {'window': 6144, 'document': 6144}
summary = {'complete': True, 'verified': True, 'accepted': verification['accepted'],
           'methodSourceCommit': publication['head'], 'harnessSha256': receipt['harnessSha256'],
           'sourceFiles': receipt['sourceFiles'], 'rawFiles': receipt['rawFiles'],
           'archiveBytes': receipt['archiveBytes'], 'archiveSha256': receipt['archiveSha256'],
           'originalAndRelocatedVerificationIdentical': True, 'measurementRepeated': False,
           'results': results, 'scope': 'Complete original seeded Linux study; failed calibration is not accepted performance or new Rust implementation.'}
memory = {'complete': True, 'sourceStudyArchiveSha256': receipt['archiveSha256'],
          'observedOwnersByKind': owner_observations, 'includingOuterWarmupByKind': warmup_observations,
          'finalSurvivorsByKind': {'window': 0, 'document': 0},
          'nativeEndpointScope': 'The original verified isReleased checks lifetime fields against each Rust worker baseline and bounded reserved handles, not every cumulative native statistic.',
          'groups': memory_groups,
          'limits': 'Finite owner observations and recorded cleanup snapshots only. These are not process peaks, allocator reclamation guarantees, failed-construction coverage, absolute leak freedom, or performance acceptance.'}
write_json(arguments.output / 'summary.json', summary)
write_json(arguments.memory, memory)
print(json.dumps({'accepted': summary['accepted'], 'controlFailures': [len(result['jsdomControlFailures']) for result in results],
                  'numericRustBudgetFailures': [len(result['numericRustBudgetFailures']) for result in results],
                  'ownerObservations': owner_observations, 'rawFiles': receipt['rawFiles']}))
