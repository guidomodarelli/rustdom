"""Verify all complete-context evidence and describe every case without performance acceptance."""
import collections
import hashlib
import json
import math
import pathlib
import re
import statistics
import sys
import tarfile


def digest(data):
    """Return the SHA256 of exact archived bytes."""
    return hashlib.sha256(data).hexdigest()


def analyze(directory):
    """Authenticate raw files and describe all declared workers, rows and batch traces."""
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
    declaration = read_json('method-declaration.json')
    settings, original = declaration['diagnostic'], declaration['original']
    assert provenance['reviewedCommit'] == '8cc47053e048c06b39ae93c8ad9fb0eb17f9fc79'
    assert provenance['harnessSha256'] == 'c5afe557761cbfad2f8b2a72a806e481022d54b30358e47826d2cd997d87aa45'
    assert settings['revision'] == 'runner-sharing-complete-context-v1'
    assert settings['selectedPositions'] == [0, 4] and settings['workload'] is None
    assert len(original['rows']) == 8
    expected_trials = [('shared', 0), ('independent', 0), ('independent', 4), ('shared', 4)]
    output_hashes = {}
    observations, workers = [], []
    durations = resource_checks = 0
    for folder, node in zip(('node-22', 'node'), settings['nodeVersions']):
        assert read_json(f'{folder}.driver.process.json')['exitCode'] == 0
        index = read_json(f'{folder}/index.json')
        assert index['complete'] and not index['gateReevaluated'] and index['node'] == node
        assert index['revision'] == settings['revision'] and index['settings'] == settings
        assert [(entry['mode'], entry['position']) for entry in index['runs']] == expected_trials
        assert index['harness']['sha256'] == provenance['harnessSha256']
        assert digest(json.dumps(index['harness']['files'], separators=(',', ':')).encode()) == provenance['harnessSha256']
        for entry in index['harness']['files']:
            for prefix in ('harness-source', f'{folder}/harness'):
                data = files[f'{prefix}/{entry["path"]}']
                assert len(data) == entry['bytes'] and digest(data) == entry['sha256']
        for trial in index['runs']:
            assert trial['complete']
            prefix = f'{folder}/{trial["prefix"]}'
            process = read_json(prefix + '.process.json')
            report, input_record = read_json(prefix + '.json'), read_json(prefix + '.input.json')
            assert process['status'] == 0 and process['signal'] is None and process['error'] is None
            assert report['complete'] and not report['gateReevaluated'] and report['node'] == node
            assert report['revision'] == settings['revision'] and report['pid'] == process['pid']
            assert report['mode'] == input_record['mode'] == trial['mode']
            assert report['position'] == input_record['position'] == trial['position']
            assert report['factoryShared'] == (trial['mode'] == 'shared')
            assert report['execArgv'] == settings['flags']
            position = trial['position']
            assert report['schedule']['factors'] == {'reverseLoad': False, 'reverseAssignment': False, 'reverseBatches': bool(position & 4)}
            assert report['schedule']['loadOrder'] == ['A', 'B']
            assert report['schedule']['physical'] == {'A': 'J0', 'B': 'J1'}
            assert report['runnerRoots'] == input_record['runnerRoots']
            for threads in (report['affinity']['configured'], report['affinitiesAfter']):
                assert next(entry for entry in threads if entry['tid'] == report['pid'])['mask'] == str(original['cpu'])
                assert any(entry['tid'] != report['pid'] and not entry.get('disappeared') and entry['mask'] != str(original['cpu']) for entry in threads)
            assert report['runnersBefore'] == report['runnersAfter']
            assert report['distributionsBefore'] == report['distributionsAfter']
            for label, physical in (('A', 'J0'), ('B', 'J1')):
                identity = report['runnersBefore'][label]
                assert identity['sha256'] == settings['runnerSha256']
                assert digest(json.dumps(identity['files'], separators=(',', ':')).encode()) == identity['sha256']
                for entry in identity['files']:
                    data = files[f'{folder}/runners/{label}/{entry["path"]}']
                    assert len(data) == entry['bytes'] and digest(data) == entry['sha256']
                identity = report['distributionsBefore'][label]
                assert identity == input_record['manifest']['distributions'][physical]
                assert identity['sha256'] == original['distributionHashes'][physical]
                assert digest(json.dumps(identity['files'], separators=(',', ':')).encode()) == identity['sha256']
            assert len(report['batches']) == len(original['rows']) * len(settings['labels'])
            for row_index, key in enumerate(original['rows']):
                pair = report['batches'][row_index * 2:row_index * 2 + 2]
                labels = ['B', 'A'] if bool(row_index % 2) != bool(position & 4) else ['A', 'B']
                assert [batch['label'] for batch in pair] == labels
                medians = {}
                for batch in pair:
                    assert batch['complete'] and f'{batch["name"]}/{batch["rows"]}' == key
                    assert batch['size'] == batch['rows']
                    assert len(batch['samplesMs']) == len(batch['memoryAfterCleanup']) == original['measuredSamples']
                    assert all(math.isfinite(value) and value > 0 for value in batch['samplesMs'])
                    durations += len(batch['samplesMs'])
                    medians[batch['label']] = statistics.median(batch['samplesMs'])
                    if key not in output_hashes:
                        output_hashes[key] = batch['outputHash']
                    assert batch['outputHash'] == output_hashes[key]
                    assert len(batch['cleanupTrace']) == original['cleanupRounds']
                    for round_index, endpoint in enumerate(batch['cleanupTrace']):
                        for label in settings['labels']:
                            state = endpoint[label]
                            assert set(state['survivors']) == {'window', 'document'}
                            clear = all(value == 0 for value in state['survivors'].values()) and 'nativeTree' not in state
                            assert state['clear'] == clear
                            if round_index >= original['cleanupRounds'] - original['requiredClearRounds']:
                                assert clear
                                resource_checks += 1
                observations.append({'node': node, 'mode': trial['mode'], 'position': position, 'key': key,
                    'pid': process['pid'], 'batchOrder': labels, 'medianMs': medians,
                    'firstOverSecondPercent': (medians[labels[0]] / medians[labels[1]] - 1) * 100,
                    'samplesMs': {batch['label']: batch['samplesMs'] for batch in pair}})
            markers, trace, reasons = [], [], collections.Counter()
            active = {'stage': 'outside-batches'}
            next_batch = 0
            for line in files[prefix + '.stdout.log'].decode().splitlines():
                if line.startswith('{"diagnosticEvent":'):
                    event = json.loads(line)
                    markers.append((event['diagnosticEvent'], event['label']))
                    if event['diagnosticEvent'] == settings['events']['start']:
                        batch = report['batches'][next_batch]
                        assert event['label'] == batch['label']
                        active = {'stage': 'whole-batch', 'batchIndex': next_batch, 'key': f'{batch["name"]}/{batch["rows"]}', 'label': batch['label']}
                        next_batch += 1
                    elif event['diagnosticEvent'] == settings['events']['returned']:
                        active = {**active, 'stage': 'cleanup'}
                    else:
                        active = {'stage': 'outside-batches'}
                if 'benchmarks/worker.cjs' in line:
                    trace.append({**active, 'namedMeasure': '<JSFunction measure <' in line, 'line': line})
                if '[bailout (' in line and 'deoptimizing' in line:
                    reason = re.search(r'reason: (.*?): begin\. deoptimizing', line)
                    reasons[reason[1] if reason else 'unparsed'] += 1
            expected_markers = [(settings['events'][stage], batch['label']) for batch in report['batches'] for stage in ('start', 'returned', 'end')]
            assert markers == expected_markers and next_batch == len(report['batches'])
            workers.append({'node': node, 'mode': trial['mode'], 'position': position, 'pid': process['pid'],
                'workloadTrace': trace, 'namedMeasureTraceLines': sum(entry['namedMeasure'] for entry in trace),
                'deoptimizationReasons': dict(reasons)})
    assert len(workers) == 8 and len(observations) == 64 and len(output_hashes) == 8
    assert durations == 1152 and resource_checks == 512
    return {'complete': True, 'gateReevaluated': False, 'rawFilesVerified': len(files),
        'workers': workers, 'observations': observations, 'durations': durations,
        'requiredFinalResourceChecks': resource_checks,
        'weakTargetsAssertedPerKind': len(workers) * len(original['rows']) * len(settings['labels']) *
            (original['warmupSamples'] + original['measuredSamples']),
        'outputHashes': output_hashes, 'provenance': provenance, 'host': read_json('host.json'),
        'limits': ['Instrumented jsdom A/A diagnosis with two fixed positions, not a performance budget or general causal proof.',
            'Markers bracket complete batches, including setup, warmup, checks and GC; no within-timer attribution.',
            'The method declaration was exported after execution from frozen configuration only.',
            'No Rust addon or native resource measurement; post-GC observations are not peak memory or universal leak absence.']}


if __name__ == '__main__':
    sys.stdout.reconfigure(newline='\n')
    directory = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else pathlib.Path(__file__).parent
    print(json.dumps(analyze(directory), indent=2, ensure_ascii=False))
