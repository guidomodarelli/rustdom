"""Recount the preserved real contract evidence without running DOM or collecting new samples."""
import hashlib
import json
import pathlib
import sys
import tarfile

directory = pathlib.Path(sys.argv[1])
summary = json.loads((directory / 'validation.json').read_bytes())
archive = directory / summary['archive']['path']
assert archive.stat().st_size == summary['archive']['bytes']
assert hashlib.sha256(archive.read_bytes()).hexdigest() == summary['archive']['sha256']
with tarfile.open(archive) as evidence:
    def read_json(name):
        return json.load(evidence.extractfile(name))

    harness = read_json('frozen-harness.json')
    assert harness['sha256'] == summary['harnessSha256']
    assert len(harness['files']) == summary['harnessFiles'] == 387
    for entry in harness['files']:
        data = evidence.extractfile('source/' + entry['path']).read()
        assert len(data) == entry['bytes']
        assert hashlib.sha256(data).hexdigest() == entry['sha256']
    processes = read_json('validation/processes.json')
    assert len(processes) == 2 and all(process['exitCode'] == 0 for process in processes)
    assert read_json('validation/preflight.json')['exitCode'] == 0
    reports = []
    for name in evidence.getnames():
        if name.endswith('.process.json') and name.startswith('validation/'):
            process = read_json(name)
            assert process['exitCode'] == 0
            report = read_json(name.replace('.process.json', '.json'))
            assert report['complete']
            assert sum(bool(paths) for paths in report['loadedAfter'].values()) == 1
            reports.append((name, report))
    assert len(reports) == 16
    batches = [batch for _, report in reports for batch in report['batches']]
    endpoints = [endpoint for batch in batches for endpoint in batch['cleanupTrace']]
    counts = {'workers': len(reports), 'publicBatches': len(batches),
        'measuredDurations': sum(len(batch['samplesMs']) for batch in batches),
        'trackedWindowReferences': sum(report['batches'][-1]['trackedOwners']['window'] for _, report in reports),
        'trackedDocumentReferences': sum(report['batches'][-1]['trackedOwners']['document'] for _, report in reports),
        'cleanupObservations': len(endpoints),
        'requiredClearEndpoints': sum(len(batch['cleanupTrace'][-2:]) for batch in batches),
        'initialNotClearObservationsPreserved': sum(not endpoint['clear'] for endpoint in endpoints)}
    for batch in batches:
        assert batch['complete'] and len(batch['samplesMs']) == 9 and len(batch['cleanupTrace']) == 3
        for endpoint in batch['cleanupTrace'][-2:]:
            assert endpoint['clear'] and endpoint['survivors'] == {'window': 0, 'document': 0}
    outputs = {}
    for batch in batches:
        outputs.setdefault(batch['name'] + '/' + str(batch['size']), set()).add(batch['outputHash'])
    assert len(outputs) == 8 and all(len(hashes) == 1 for hashes in outputs.values())
    memory = []
    for filename, report in reports:
        states = [state for batch in report['batches'] for state in batch['cleanupTrace']]
        final = [state for batch in report['batches'] for state in batch['cleanupTrace'][-2:]]
        for scope, selected in [('all cleanup observations', states), ('required final two clear endpoints', final)]:
            memory.append({'report': filename, 'node': report['node'], 'engine': report['engine'],
                'phase': report['phase'], 'label': report['label'], 'physical': report['schedule']['physical'],
                'scope': scope, 'observations': len(selected),
                **{key + 'RangeBytes': [min(state['memory'][key] for state in selected),
                                       max(state['memory'][key] for state in selected)]
                   for key in ['heapUsed', 'external', 'rss']}})
    result = {'verified': True, 'fullStudyExecuted': False, 'performanceAcceptanceEvaluated': False,
        'counts': counts, 'memoryScope': 'Whole process after GC; one package per process, not peak memory.',
        'memory': memory}
    print(json.dumps(result, indent=2))
