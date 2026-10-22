"""Exercise actual readers with the complete prior study and controlled malformed archives."""
import hashlib
import io
import json
import pathlib
import shutil
import subprocess
import sys
import tarfile
import tempfile

cache = pathlib.Path('/mnt/c/Users/guido/ghq/projects/rustdom/.cache')
root = pathlib.Path(tempfile.mkdtemp(prefix='rustdom-independent-order-readers-'))
shutil.copytree(cache / 'independent-order-readers', root / 'source')
shutil.copyfile(__file__, root / 'test-readers.py')
raw = root / 'raw'
raw.mkdir()
prior = pathlib.Path('/tmp/rustdom-ownership-results-0yjp1eeo/single-package')
published = pathlib.Path('/mnt/c/Users/guido/.codex/worktrees/native-class-ownership/rustdom/reports/benchmarks/native-class-ownership/single-package/39727878290/analysis.json')
reader = root / 'source/analyze.py'
extractor = root / 'source/extract.py'
original_index_hashes = {node: hashlib.sha256((prior / node / 'index.json').read_bytes()).hexdigest() for node in ['node-22', 'node-24']}
original_reports = {str(prior / node / entry['report']): hashlib.sha256((prior / node / entry['report']).read_bytes()).hexdigest()
    for node in ['node-22', 'node-24'] for entry in json.loads((prior / node / 'index.json').read_bytes())['runs']}
processes = []
def execute(name, arguments, expected_success):
    child = subprocess.run([sys.executable, '-B', *map(str, arguments)], capture_output=True)
    (raw / (name + '.stdout.log')).write_bytes(child.stdout)
    (raw / (name + '.stderr.log')).write_bytes(child.stderr)
    processes.append({'name': name, 'command': [sys.executable, '-B', *map(str, arguments)], 'exitCode': child.returncode})
    (root / 'processes.json').write_text(json.dumps(processes, indent=2) + '\n')
    assert (child.returncode == 0) == expected_success, (name, child.stderr[-1000:])
    return child

output = root / 'legacy-recalculation'
execute('actual-complete-prior-study', [reader, prior, output, 'single-package-v1'], True)
actual = json.loads((output / 'analysis.json').read_bytes())
expected = json.loads(published.read_bytes())
for key in ['accepted', 'processes', 'durations', 'rows', 'groups', 'expectedTrackedOwnersPerKindValidatedByWorker',
            'cleanupEndpoints', 'requiredClearEndpoints', 'initialNotClearEndpointsRetained']:
    assert actual[key] == expected[key], key
assert actual['accepted'] is False and actual['processes'] == 128 and actual['durations'] == 9216
wrong_profile = root / 'wrong-profile'
execute('prior-cannot-be-relabeled', [reader, prior, wrong_profile, 'independent-order-v1'], False)
assert not wrong_profile.exists()
execute('source-cannot-be-output', [reader, prior, prior / 'reader-output', 'single-package-v1'], False)
assert not (prior / 'reader-output').exists()
existing = root / 'existing-output'
existing.mkdir()
(existing / 'keep.txt').write_bytes(b'preserve this evidence')
execute('existing-output-is-preserved', [reader, prior, existing, 'single-package-v1'], False)
assert (existing / 'keep.txt').read_bytes() == b'preserve this evidence'
negative = root / 'invalid-sample'
for node in ['node-22', 'node-24']:
    destination = negative / node
    destination.mkdir(parents=True)
    shutil.copyfile(prior / node / 'index.json', destination / 'index.json')
    index = json.loads((destination / 'index.json').read_bytes())
    for number, entry in enumerate(index['runs']):
        report = destination / entry['report']
        if node == 'node-22' and number == 0:
            data = json.loads((prior / node / entry['report']).read_bytes())
            data['batches'][0]['samplesMs'][0] = -1
            report.write_text(json.dumps(data))
        else:
            report.symlink_to(prior / node / entry['report'])
execute('negative-duration-is-rejected', [reader, negative, root / 'invalid-result', 'single-package-v1'], False)

prefix = 'independent-order'
allowed = {prefix + '/prepared/ownership-build/packages/' + label + '/node_modules': '../../node_modules'
           for label in ['A0', 'A1', 'B', 'J0', 'J1']}
allowed[prefix + '/prepared/ownership-build/node_modules/.bin/tldts'] = '../tldts/bin/cli.js'
def make_archive(name, entries):
    filename = root / (name + '.tar.gz')
    with tarfile.open(filename, 'w:gz') as archive:
        for path, kind, value in entries:
            member = tarfile.TarInfo(path)
            if kind == 'file':
                data = value.encode()
                member.size = len(data)
                archive.addfile(member, io.BytesIO(data))
            else:
                member.type = tarfile.SYMTYPE if kind == 'symlink' else tarfile.LNKTYPE
                member.linkname = value
                archive.addfile(member)
    return filename

legitimate = make_archive('legitimate-layout', [(prefix + '/provenance.json', 'file', '{"fixture":true}'),
    (prefix + '/prepared/ownership-build/node_modules/tldts/bin/cli.js', 'file', 'fixture only'),
    *[(name, 'symlink', target) for name, target in allowed.items()]])
child = execute('six-declared-links-are-preserved', [extractor, legitimate, prefix], True)
extracted = json.loads(child.stdout)
destination = pathlib.Path(extracted['root'])
assert len(extracted['links']) == 6 and not extracted['partialPreparationLinks']
assert (destination / prefix / 'provenance.json').read_bytes() == b'{"fixture":true}'
for name, target in allowed.items():
    assert (destination / name).is_symlink() and str((destination / name).readlink()) == target
bad_archives = {
    'path-traversal': [(prefix + '/../escape', 'file', 'no')],
    'absolute-path': [(str(root / 'forbidden-reader-write'), 'file', 'no')],
    'duplicate-normalized-path': [(prefix + '/same', 'file', 'one'), (prefix + '/./same', 'file', 'two')],
    'undeclared-symlink': [(prefix + '/unexpected', 'symlink', '/tmp/escape')],
    'changed-declared-link': [(next(iter(allowed)), 'symlink', '../../../escape')],
    'member-below-declared-link': [(next(iter(allowed)), 'symlink', '../../node_modules'),
        (next(iter(allowed)) + '/payload', 'file', 'no')],
    'hard-link': [(prefix + '/hard', 'hardlink', prefix + '/provenance.json')],
    'wrong-prefix': [('single-package/file', 'file', 'no')],
}
for name, entries in bad_archives.items():
    execute('extract-' + name, [extractor, make_archive(name, entries), prefix], False)
for node, digest in original_index_hashes.items():
    assert hashlib.sha256((prior / node / 'index.json').read_bytes()).hexdigest() == digest
for filename, digest in original_reports.items():
    assert hashlib.sha256(pathlib.Path(filename).read_bytes()).hexdigest() == digest
assert not (root / 'forbidden-reader-write').exists()
receipt = {'root': str(root), 'python': sys.version, 'contracts': len(processes), 'allPassed': True,
    'priorArchiveDecisionPreserved': True, 'priorAccepted': actual['accepted'],
    'priorWorkers': actual['processes'], 'priorDurations': actual['durations'],
    'priorRowsRecalculated': len(actual['rows']), 'newMeasurements': False, 'fullIndependentStudyVerified': False,
    'limits': 'Prior complete eight-position data validates arithmetic and rejection. The full sixteen-position positive CLI path remains pending its real artifact. Frozen original verification and artifact authentication are prerequisites.',
    'testProgramSha256': hashlib.sha256((root / 'test-readers.py').read_bytes()).hexdigest(),
    'sourceFiles': [{'path': path.relative_to(root / 'source').as_posix(), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
                     'bytes': path.stat().st_size} for path in sorted((root / 'source').rglob('*')) if path.is_file()]}
(root / 'receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
(cache / 'independent-order-reader-validation-root.txt').write_text(str(root) + '\n')
print(json.dumps(receipt))
