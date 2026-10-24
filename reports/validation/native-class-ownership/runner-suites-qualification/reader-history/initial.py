"""Read the packaged qualification once, verifying inputs and reports without running suites."""
import hashlib
import json
import pathlib
import posixpath
import sys
import tarfile


directory = pathlib.Path(__file__).resolve().parent
repository = directory.parents[3]
receipt = json.loads((directory / 'receipt.json').read_bytes())
archive = directory / 'qualification-and-inputs.tar.gz'
assert archive.stat().st_size == receipt['archiveBytes']
assert hashlib.sha256(archive.read_bytes()).hexdigest() == receipt['archiveSha256']
prefix = receipt['prefix'] + '/'
metadata, digests, sizes, links, names = {}, {}, {}, {}, set()
with tarfile.open(archive, 'r|gz') as stream:
    for member in stream:
        assert member.name not in names
        names.add(member.name)
        assert member.name == receipt['prefix'] or member.name.startswith(prefix)
        assert not pathlib.PurePosixPath(member.name).is_absolute()
        assert '..' not in pathlib.PurePosixPath(member.name).parts
        if member.issym() or member.islnk():
            assert not posixpath.isabs(member.linkname)
            target = posixpath.normpath(posixpath.join(posixpath.dirname(member.name), member.linkname)) if member.issym() else member.linkname
            assert target.startswith(prefix)
            links[member.name] = target
        if not member.isfile():
            continue
        relative = member.name[len(prefix):]
        retained = (relative in ['qualification-summary.json', 'dependency-deduplication.json',
                                 'static-prepared/index.json', 'static-contracts/index.json',
                                 'static-qualification/index.json', 'qualification/index.json', 'final-qualification/index.json']
                    or relative.startswith('qualified-method/')
                    or relative.startswith('static-qualification/') and relative.endswith(('report.json', 'suite.stdout.log', 'suite.stderr.log')))
        digest = hashlib.sha256()
        payload = bytearray() if retained else None
        with stream.extractfile(member) as source:
            while chunk := source.read(1024 * 1024):
                digest.update(chunk)
                if payload is not None:
                    payload.extend(chunk)
        digests[member.name], sizes[member.name] = digest.hexdigest(), member.size
        if payload is not None:
            metadata[relative] = bytes(payload)
assert len(names) == receipt['entries']


def load(name):
    return json.loads(metadata[name])


for archived, sidecar in [('qualification-summary.json', 'summary.json'),
                          ('dependency-deduplication.json', 'dependency-deduplication.json'),
                          ('static-prepared/index.json', 'preparation-index.json'),
                          ('static-contracts/index.json', 'contracts-index.json'),
                          ('static-qualification/index.json', 'qualification-index.json')]:
    assert metadata[archived] == (directory / sidecar).read_bytes(), sidecar
prepared, qualification, contracts = [load(name) for name in ['static-prepared/index.json', 'static-qualification/index.json', 'static-contracts/index.json']]
assert prepared['complete'] and qualification['complete'] and contracts['complete']
assert not qualification['measurementExecuted'] and qualification['accepted'] is None
assert qualification['preparationBefore'] == qualification['preparationAfter']
method = repository / 'reports/benchmarks/native-class-ownership/runner-suites'
for entry in qualification['method']['files']:
    actual = metadata['qualified-method/' + entry['path']]
    assert hashlib.sha256(actual).hexdigest() == entry['sha256']
    assert actual == (method / entry['path']).read_bytes()
checked_inputs = 0
for root, expected in [(prefix + 'static-prepared/', prepared['dependencies'])] + [
        (prefix + 'static-prepared/packages/' + physical + '/', value) for physical, value in prepared['packages'].items()]:
    for entry in expected['files']:
        name = root + entry['path']
        target = links.get(name, name)
        assert digests[target] == entry['sha256'] and sizes[target] == entry['bytes'], name
        checked_inputs += 1
tests, proofs = 0, 0
for suite in qualification['suites']:
    relative = f"static-qualification/{suite['version']}/{suite['physical']}/{suite['runner']}/"
    report = load(relative + 'report.json')
    assertions = [case for result in report['testResults'] for case in result['assertionResults']]
    assert suite['complete'] and report['success']
    assert report['numTotalTests'] == report['numPassedTests'] == len(assertions) == suite['result']['tests']
    assert all(case['status'] == 'passed' for case in assertions)
    captured = []
    marker = prepared['settings']['probePrefix']
    for suffix in ['suite.stdout.log', 'suite.stderr.log']:
        for line in metadata[relative + suffix].decode().splitlines():
            if marker in line:
                captured.append(json.loads(line.split(marker, 1)[1]))
    assert captured == suite['result']['proofs']
    tests += len(assertions)
    proofs += len(captured)
assert tests == 372 and proofs == 16 and len(qualification['suites']) == 12
assert len(contracts['cases']) == 8 and all(case['passed'] for case in contracts['cases'])
assert not load('qualification/index.json')['complete'] and not load('final-qualification/index.json')['complete']
for previous in ['prepared', 'final-prepared']:
    assert prefix + previous + '/node_modules' not in names
result = {'archiveSha256': receipt['archiveSha256'], 'entries': len(names), 'inputFilesChecked': checked_inputs,
          'methodFilesMatched': len(qualification['method']['files']), 'suites': 12, 'passedTests': tests,
          'positiveProvenanceProbes': proofs, 'contracts': 8, 'historicalFailuresPreserved': 2,
          'measurementsExecuted': False, 'accepted': None}
if len(sys.argv) > 1:
    with pathlib.Path(sys.argv[1]).open('x', encoding='utf-8', newline='\n') as output:
        json.dump(result, output, indent=2)
        output.write('\n')
print(json.dumps(result))
