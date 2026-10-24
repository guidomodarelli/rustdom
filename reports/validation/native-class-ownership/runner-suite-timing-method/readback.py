"""Check every archived byte and the real exercise reports without launching runners."""
import hashlib
import json
import pathlib
import tarfile


directory = pathlib.Path(__file__).resolve().parent
repository = directory.parents[3]
load = lambda name: json.loads((directory / name).read_bytes())
receipt, expected, summary = [load(name) for name in ['receipt.json', 'raw-files.json', 'summary.json']]
archive = directory / 'qualification-and-history.tar.gz'
assert archive.stat().st_size == receipt['archiveBytes']
assert hashlib.sha256(archive.read_bytes()).hexdigest() == receipt['archiveSha256']
prefix = receipt['prefix'] + '/'
actual, retained, names = {}, {}, set()
with tarfile.open(archive, 'r|gz') as stream:
    for member in stream:
        assert member.name not in names
        names.add(member.name)
        assert member.name == receipt['prefix'] or member.name.startswith(prefix)
        assert not pathlib.PurePosixPath(member.name).is_absolute()
        assert '..' not in pathlib.PurePosixPath(member.name).parts
        assert member.isfile() or member.isdir(), 'Unexpected archive link or device'
        if not member.isfile():
            continue
        relative = member.name[len(prefix):]
        payload = stream.extractfile(member).read()
        actual[relative] = {'bytes': len(payload), 'sha256': hashlib.sha256(payload).hexdigest()}
        if relative.startswith('exercise-portability/') or relative == 'portability-summary.json':
            retained[relative] = payload
assert len(names) == receipt['entries']
assert len(actual) == receipt['rawFiles']
assert actual == expected
assert json.loads(retained['portability-summary.json']) == summary
index_bytes = retained['exercise-portability/index.json']
assert index_bytes == (directory / 'exercise-index.json').read_bytes()
index = json.loads(index_bytes)
assert index['complete'] and index['qualificationOnly'] and not index['formalMeasurementExecuted']
assert index['sources'] == summary['sourceFiles']
for name, digest in index['sources'].items():
    assert hashlib.sha256((repository / name).read_bytes()).hexdigest() == digest, name
    assert actual['exercise-portability/sources/' + name]['sha256'] == digest
tests = 0
for position, record in enumerate(index['processes']):
    root = f'exercise-portability/processes/{position:04d}/'
    assert record['complete'] and record['exitCode'] == 0 and record['signal'] is None
    assert int(record['elapsedNs']) > 0
    for name, digest in record['files'].items():
        assert actual[root + name]['sha256'] == digest
    report = json.loads(retained[root + 'report.json'])
    assertions = [case for result in report['testResults'] for case in result['assertionResults']]
    assert report['success'] and all(case['status'] == 'passed' for case in assertions)
    assert len(assertions) == report['numTotalTests'] == report['numPassedTests'] == record['result']['tests']
    tests += len(assertions)
assert len(index['processes']) == 18 and tests == 558
print(json.dumps({'verified': True, 'archiveSha256': receipt['archiveSha256'],
                  'entries': len(names), 'rawFilesChecked': len(actual), 'sourceFilesMatched': len(index['sources']),
                  'cliInvocations': 18, 'passedTests': tests, 'formalMeasurementExecuted': False,
                  'suiteTimingAccepted': None, 'ownershipAcceptanceChanged': False}, indent=2))
