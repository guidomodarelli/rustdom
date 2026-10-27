"""Authenticate the archive and independently recompute every predeclared timing row."""
import hashlib
import json
import pathlib
import sys
import tarfile


script_directory = pathlib.Path(__file__).resolve().parent
directory = pathlib.Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else script_directory
repository = script_directory.parents[3]
benchmark = repository / 'reports/benchmarks/native-class-ownership/runner-suite-timing-results'
load = lambda name: json.loads((directory / name).read_bytes())
receipt, expected = [load(name) for name in ['receipt.json', 'raw-files.json']]
archive = directory / 'complete-study.tar.gz'
assert archive.stat().st_size == receipt['archiveBytes'], 'Study readback: archive size mismatch'
assert hashlib.sha256(archive.read_bytes()).hexdigest() == receipt['archiveSha256'], 'Study readback: archive checksum mismatch'
prefix = receipt['prefix'] + '/'
actual, payloads, names = {}, {}, set()
with tarfile.open(archive, 'r|gz') as stream:
    for member in stream:
        assert member.name not in names, 'Study readback: duplicate archive path'
        names.add(member.name)
        assert member.name == receipt['prefix'] or member.name.startswith(prefix)
        assert not pathlib.PurePosixPath(member.name).is_absolute()
        assert '..' not in pathlib.PurePosixPath(member.name).parts
        assert member.isfile() or member.isdir(), 'Study readback: unexpected link or device'
        if not member.isfile():
            continue
        relative = member.name[len(prefix):]
        payload = stream.extractfile(member).read()
        actual[relative] = {'bytes': len(payload), 'sha256': hashlib.sha256(payload).hexdigest()}
        if relative.endswith('.json') or relative == 'replay-summary.json':
            payloads[relative] = payload
assert len(names) == receipt['entries'] and len(actual) == receipt['rawFiles']
assert actual == expected, 'Study readback: raw inventory mismatch'
index_bytes = payloads['results/index.json']
assert index_bytes == (directory / 'study-index.json').read_bytes()
index = json.loads(index_bytes)
assert index['complete'] and index['formalMeasurementExecuted'] and not index['qualificationOnly']
assert index['preparationBefore'] == index['preparationAfter']
assert index['toolsBefore'] == index['toolsAfter']
assert index['publication']['files'] == index['sources']
qualified_sources = json.loads((repository / 'reports/validation/native-class-ownership/runner-suite-timing-method/summary.json').read_bytes())['sourceFiles']
assert index['sources'] == qualified_sources, 'Study readback: incomplete or changed source inventory'
for name, digest in index['sources'].items():
    assert hashlib.sha256((repository / name).read_bytes()).hexdigest() == digest, name
    assert actual['results/sources/' + name]['sha256'] == digest
settings = json.loads(payloads['results/sources/reports/benchmarks/native-class-ownership/runner-suite-timing/constants/study.json'])
assert settings == index['settings']
assert actual['results/preparation-index.json']['sha256'] == settings['preparationIndexSha256']
records = index['processes']
assert len(records) == 342, 'Study readback: incomplete process ledger'
assert sum(record['selection']['stage'] == 'warmup' for record in records) == 54
assert sum(record['selection']['stage'] == 'measured' for record in records) == 288
tests, probes, allocations, observations = 0, 0, 0, []
for sequence, record in enumerate(records):
    root = f'results/processes/{sequence:04d}/'
    assert record['complete'] and record['exitCode'] == 0 and record['signal'] is None
    assert int(record['elapsedNs']) > 0, 'Study readback: non-positive timing'
    assert record['elapsedMs'] == int(record['elapsedNs']) / 1e6
    timing = json.loads(payloads[root + 'timing.json'])
    assert sorted(timing) == sorted(settings['timingFields'])
    assert all(record[name] == value for name, value in timing.items())
    assert json.loads(payloads[root + 'resources.json']) == record['resources']
    assert record['resources']['exitStatus'] == 0 and record['resources']['maxRssKiB'] > 0
    for name, digest in record['files'].items():
        assert actual[root + name]['sha256'] == digest
    report = json.loads(payloads[root + 'report.json'])
    assertions = [case for result in report['testResults'] for case in result['assertionResults']]
    assert report['success'] and all(case['status'] == 'passed' for case in assertions)
    assert len(assertions) == report['numTotalTests'] == report['numPassedTests'] == record['result']['tests']
    tests += len(assertions)
    probes += len(record['result']['proofs'])
    allocations += sum(proof['created'] for proof in record['result']['proofs'])
    observations.append({'sequence': sequence, 'selection': record['selection'], 'elapsedNs': record['elapsedNs'],
                         'elapsedMs': record['elapsedMs'], 'resources': record['resources'],
                         'tests': record['result']['tests'], 'proofs': len(record['result']['proofs'])})
assert tests == 10602 and probes == 456 and allocations == 912
assert observations == json.loads((benchmark / 'observations.json').read_bytes())
rows = []
for node in settings['nodeVersions']:
    for phase in settings['phases']:
        for runner in settings['runners']:
            cells = {}
            for label in ['A', 'B']:
                own = [record for record in records if record['selection']['stage'] == 'measured'
                       and record['selection']['node'] == node and record['selection']['phase'] == phase
                       and record['selection']['runner'] == runner and record['selection']['label'] == label]
                assert len(own) == 12 and len({record['selection']['position'] for record in own}) == 12
                cells[label] = own
            medians = {}
            for label, own in cells.items():
                sorted_ns = sorted(int(record['elapsedNs']) for record in own)
                medians[label] = sorted_ns[5] + sorted_ns[6]
            baseline, candidate = medians['A'], medians['B']
            upper = candidate * 100 <= baseline * (100 + settings['budgetPercent'])
            lower = candidate * 100 >= baseline * (100 - settings['budgetPercent'])
            calibrated = lower and upper if phase == 'AA' else next(
                row['withinBudget'] for row in rows if row['node'] == node and row['phase'] == 'AA' and row['runner'] == runner)
            baseline_ms, candidate_ms = baseline / 2e6, candidate / 2e6
            rows.append({'node': node, 'phase': phase, 'runner': runner,
                         'samples': {label: [record['elapsedMs'] for record in own] for label, own in cells.items()},
                         'baselineMs': baseline_ms, 'candidateMs': candidate_ms,
                         'changePercent': (candidate_ms / baseline_ms - 1) * 100,
                         'calibrated': calibrated, 'baselineMedianNsTwice': str(baseline),
                         'candidateMedianNsTwice': str(candidate), 'withinBudget': calibrated and upper})
decision = {'suiteTimingAccepted': all(row['withinBudget'] for row in rows),
            'ownershipAcceptanceChanged': False, 'rows': rows}
assert decision == index['decision'], 'Study readback: stored decision differs from independent calculation'
replay = json.loads(payloads['replay-summary.json'])
assert replay['sameDecisionAcrossAllReaders']
assert replay['verified'] == {'verified': True, 'qualificationOnly': False, 'cliInvocations': 342, 'tests': tests, **decision}
summary = json.loads((benchmark / 'summary.json').read_bytes())
assert all(summary[name] == value for name, value in replay['verified'].items())
print(json.dumps({'verified': True, 'archiveSha256': receipt['archiveSha256'], 'rawFilesChecked': len(actual),
                  'sourceFilesMatched': len(index['sources']), 'cliInvocations': 342, 'warmups': 54,
                  'measuredCliInvocations': 288, 'passedTestExecutions': tests, 'positiveProvenanceProbes': probes,
                  'rangeAllocationsObserved': allocations, 'independentRowsMatched': len(rows), **decision}, indent=2))
