"""Verify the complete diagnostic archive and describe batch order without budget acceptance."""
import collections
import hashlib
import json
import pathlib
import re
import statistics
import sys
import tarfile


def digest(data):
    """Return the SHA256 of exact archived bytes."""
    return hashlib.sha256(data).hexdigest()


def analyze(directory):
    """Authenticate every raw file and describe all 32 completed diagnostic workers."""
    manifest = json.loads((directory / 'raw-files.json').read_text())
    with tarfile.open(directory / 'raw.tar.gz', 'r:gz') as archive:
        members = archive.getmembers()
        assert len({member.name for member in members}) == len(members) == len(manifest['files'])
        files = {}
        for entry in manifest['files']:
            data = archive.extractfile(entry['path']).read()
            assert len(data) == entry['bytes'] and digest(data) == entry['sha256'], entry['path']
            files[entry['path']] = data
    read_json = lambda name: json.loads(files[name])
    provenance = read_json('provenance.json')
    assert provenance['reviewedCommit'] == '4b76fe2a550c3c979e7412fe7400d02e81d0cf3c'
    assert provenance['harnessSha256'] == '026cc8a5ef06026e1ffb8c1798fa49e87fec857fe7bc9b918d7a75cbb3b14b86'
    observations = []
    output_hashes = set()
    required_resource_checks = 0
    for folder, node in (('node-22', 'v22.12.0'), ('node', 'v24.14.1')):
        assert read_json(f'{folder}.driver.process.json')['exitCode'] == 0
        index = read_json(f'{folder}/index.json')
        assert index['complete'] and not index['gateReevaluated'] and index['node'] == node
        assert len(index['runs']) == 16
        assert index['harness']['sha256'] == provenance['harnessSha256']
        assert index['harness']['files'] == read_json('node-22/index.json')['harness']['files']
        for entry in index['harness']['files']:
            for prefix in ('harness-source', f'{folder}/harness'):
                data = files[f'{prefix}/{entry["path"]}']
                assert len(data) == entry['bytes'] and digest(data) == entry['sha256']
        assert digest(json.dumps(index['harness']['files'], separators=(',', ':')).encode()) == provenance['harnessSha256']
        for position in range(8):
            reverse = (position ^ (position >> 1) ^ (position >> 2)) & 1
            modes = ['independent', 'shared'] if reverse else ['shared', 'independent']
            assert [entry['mode'] for entry in index['runs'][position * 2:position * 2 + 2]] == modes
        for trial in index['runs']:
            assert trial['complete']
            prefix = f'{folder}/{trial["prefix"]}'
            process = read_json(prefix + '.process.json')
            assert process['status'] == 0 and process['signal'] is None and process['error'] is None
            report = read_json(prefix + '.json')
            input_record = read_json(prefix + '.input.json')
            assert report['complete'] and not report['gateReevaluated'] and report['node'] == node
            assert report['pid'] == process['pid']
            assert report['execArgv'] == index['settings']['flags']
            assert report['factoryShared'] == (trial['mode'] == 'shared')
            assert report['position'] == trial['position'] and report['mode'] == trial['mode']
            position = trial['position']
            assert report['schedule']['factors'] == {'reverseLoad': bool(position & 1),
                'reverseAssignment': bool(position & 2), 'reverseBatches': bool(position & 4)}
            assert report['schedule']['loadOrder'] == (['B', 'A'] if position & 1 else ['A', 'B'])
            assert report['schedule']['physical'] == ({'A': 'J1', 'B': 'J0'} if position & 2 else {'A': 'J0', 'B': 'J1'})
            for threads in (report['affinity']['configured'], report['affinitiesAfter']):
                assert next(entry for entry in threads if entry['tid'] == report['pid'])['mask'] == '2'
                assert any(entry['tid'] != report['pid'] and not entry.get('disappeared') and entry['mask'] != '2' for entry in threads)
            assert report['runnersBefore'] == report['runnersAfter']
            assert report['distributionsBefore'] == report['distributionsAfter']
            for label in ('A', 'B'):
                identity = report['runnersBefore'][label]
                assert identity['sha256'] == 'c3708ad1f9d18e92d9fd384621dbdb0b7dd46eb5ba66d9753e856ca9153c6fec'
                assert digest(json.dumps(identity['files'], separators=(',', ':')).encode()) == identity['sha256']
                for entry in identity['files']:
                    data = files[f'{folder}/runners/{label}/{entry["path"]}']
                    assert len(data) == entry['bytes'] and digest(data) == entry['sha256']
                physical = report['schedule']['physical'][label]
                identity = report['distributionsBefore'][label]
                assert identity == input_record['manifest']['distributions'][physical]
                assert identity['sha256'] == 'c458b9e9ca38d2f0af6fdf0d7277f7d6499c723ffab361216bfdc119386d9078'
                assert digest(json.dumps(identity['files'], separators=(',', ':')).encode()) == identity['sha256']
            assert len(report['batches']) == 2
            medians = {}
            for batch, expected in zip(report['batches'], report['schedule']['batches']):
                assert all(batch[key] == expected[key] for key in ('label', 'name', 'size'))
                assert batch['complete'] and batch['name'] == 'range-control-1000' and batch['size'] == 250
                assert len(batch['samplesMs']) == len(batch['memoryAfterCleanup']) == 9
                assert all(isinstance(value, (float, int)) and value > 0 for value in batch['samplesMs'])
                medians[batch['label']] = statistics.median(batch['samplesMs'])
                output_hashes.add(batch['outputHash'])
                assert len(batch['cleanupTrace']) == 3
                for round_index, endpoint in enumerate(batch['cleanupTrace']):
                    for label in ('A', 'B'):
                        state = endpoint[label]
                        clear = all(value == 0 for value in state['survivors'].values()) and 'nativeTree' not in state
                        assert state['clear'] == clear
                        if round_index >= 1:
                            assert clear
                            required_resource_checks += 1
            stages = collections.Counter()
            reasons = collections.Counter()
            functions = collections.Counter()
            marker_events = []
            active = 'outside-batches'
            workload_events = 0
            workload_lines = []
            for line in files[prefix + '.stdout.log'].decode().splitlines():
                if line.startswith('{"diagnosticEvent":'):
                    event = json.loads(line)
                    marker_events.append((event['diagnosticEvent'], event['label']))
                    active = ('batch-' + event['label']) if event['diagnosticEvent'] == 'batch-start' else (
                        'cleanup-' + event['label'] if event['diagnosticEvent'] == 'measurement-returned' else 'outside-batches')
                if 'benchmarks/worker.cjs' in line:
                    workload_events += 1
                    workload_lines.append({'stage': active, 'line': line})
                if '[bailout (' in line and 'deoptimizing' in line:
                    stages[active] += 1
                    reason = re.search(r'reason: (.*?): begin\. deoptimizing', line)
                    function = re.search(r'<JSFunction (.*?) <', line)
                    reasons[reason[1] if reason else 'unparsed'] += 1
                    functions[function[1] if function else 'anonymous-or-unparsed'] += 1
            labels = [batch['label'] for batch in report['batches']]
            assert marker_events == [(stage, label) for label in labels for stage in
                ('batch-start', 'measurement-returned', 'batch-end')]
            observations.append({'node': node, 'mode': trial['mode'], 'position': trial['position'],
                'pid': process['pid'], 'physical': report['schedule']['physical'], 'loadOrder': report['schedule']['loadOrder'],
                'batchOrder': labels, 'medianMs': medians,
                'firstOverSecondPercent': (medians[labels[0]] / medians[labels[1]] - 1) * 100,
                'rawDurations': {batch['label']: batch['samplesMs'] for batch in report['batches']},
                'deoptimizationStages': dict(stages), 'deoptimizationReasons': dict(reasons),
                'deoptimizationFunctions': dict(functions), 'workloadScriptTraceLines': workload_events,
                'workloadTrace': workload_lines})
    assert len(output_hashes) == 1
    assert required_resource_checks == 256
    summaries = []
    for node in ('v22.12.0', 'v24.14.1'):
        for mode in ('shared', 'independent'):
            rows = [row for row in observations if row['node'] == node and row['mode'] == mode]
            assert sorted(row['position'] for row in rows) == list(range(8))
            summaries.append({'node': node, 'mode': mode, 'workers': len(rows),
                'firstSlowerCount': sum(row['firstOverSecondPercent'] > 0 for row in rows),
                'medianFirstOverSecondPercent': statistics.median(row['firstOverSecondPercent'] for row in rows),
                'minFirstOverSecondPercent': min(row['firstOverSecondPercent'] for row in rows),
                'maxFirstOverSecondPercent': max(row['firstOverSecondPercent'] for row in rows),
                'workloadScriptTraceLines': sum(row['workloadScriptTraceLines'] for row in rows),
                'deoptimizations': sum(sum(row['deoptimizationStages'].values()) for row in rows),
                'wrongCallTargetEvents': sum(row['deoptimizationReasons'].get('wrong call target', 0) for row in rows)})
    return {'complete': True, 'gateReevaluated': False, 'rawFilesVerified': len(files),
        'workers': len(observations), 'durations': sum(len(values) for row in observations for values in row['rawDurations'].values()),
        'requiredResourceChecks': required_resource_checks,
        'weakTargetsAssertedPerKind': len(observations) * 2 * 12,
        'provenance': provenance, 'host': read_json('host.json'), 'outputHash': next(iter(output_hashes)),
        'summaries': summaries, 'observations': observations,
        'limits': ['Instrumented diagnostic; no performance budget decision.',
            'Whole-batch markers include setup, warmup, checks and collection; events cannot be placed inside timed samples.',
            'A trace-line count is an observation, not proof of absent optimization or causal attribution.',
            'Only one jsdom A/A workload; Rust candidate and the remaining acceptance rows were not exercised.']}


if __name__ == '__main__':
    sys.stdout.reconfigure(newline='\n')
    target = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else pathlib.Path(__file__).parent
    print(json.dumps(analyze(target), indent=2, ensure_ascii=False))
