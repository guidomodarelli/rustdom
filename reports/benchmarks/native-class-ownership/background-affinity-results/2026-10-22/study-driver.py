"""Run the published disjoint-thread intervention once, retaining all outputs in durable Linux storage."""
import hashlib
import io
import json
import os
import pathlib
import shutil
import subprocess
import sys
import tarfile
import tempfile
import time

repository = pathlib.Path('/mnt/c/Users/guido/.codex/worktrees/native-class-ownership/rustdom')
marker = repository / '.cache/background-affinity-study.started.json'
if marker.exists():
    raise SystemExit('This study has a consumed marker; inspect its existing process and never restart it')
publication = json.loads((repository / '.cache/background-affinity-publication.json').read_bytes())
if hashlib.sha256(pathlib.Path(__file__).read_bytes()).hexdigest() != publication['launcherSha256']:
    raise ValueError('Study launcher differs from the published reviewed bytes')
raw_tar = (repository / '.cache/background-affinity-published-harness.tar').read_bytes()
if hashlib.sha256(raw_tar).hexdigest() != publication['harnessTarSha256']:
    raise ValueError('Published harness transport digest differs')
environment = dict(os.environ)
for name in ['NODE_OPTIONS', 'UV_THREADPOOL_SIZE', 'NODE_V8_COVERAGE', 'V8_FLAGS', 'LD_PRELOAD']:
    if name in environment:
        raise ValueError('Undeclared process environment is present: ' + name)
if any(name.startswith('RUSTDOM_BENCHMARK_') for name in environment):
    raise ValueError('Undeclared benchmark environment is present')
nodes = [('node-22', '/mnt/c/Users/guido/ghq/projects/rustdom/.tools/node-22/bin/node', 'v22.12.0'),
         ('node-24', '/mnt/c/Users/guido/ghq/projects/rustdom/.tools/node/bin/node', 'v24.14.1')]
node_preflight = []
for label, node, expected_version in nodes:
    result = subprocess.run([node, '--version'], env=environment, capture_output=True, text=True)
    record = {'label': label, 'command': [node, '--version'], 'exitCode': result.returncode,
              'stdout': result.stdout, 'stderr': result.stderr, 'expectedVersion': expected_version,
              'executableSha256': hashlib.sha256(pathlib.Path(node).read_bytes()).hexdigest()}
    node_preflight.append(record)
    if result.returncode != 0 or result.stdout.strip() != expected_version:
        raise ValueError('Node executable does not match its declared slot before any measurement: ' + json.dumps(record))
root = pathlib.Path(tempfile.mkdtemp(prefix='background-affinity-study-', dir='/home/guido/rustdom-validation'))
with marker.open('x') as output:
    json.dump({'root': str(root), 'driverPid': os.getpid(), 'head': publication['head'], 'startedAt': time.time(),
               'optimizationCaptureRepeated': False, 'priorStudyRepeated': False}, output, indent=2)
print('ROOT ' + str(root), flush=True)
harness = root / 'harness'
harness.mkdir()
expected = publication['qualifiedSources']['files']
with tarfile.open(fileobj=io.BytesIO(raw_tar)) as archive:
    if archive.getnames() != [entry['path'] for entry in expected]:
        raise ValueError('Published harness transport has unexpected members or order')
    for member, entry in zip(archive, expected):
        if not member.isfile():
            raise ValueError('Published harness contains a non-regular member')
        target = harness / member.name
        target.resolve().relative_to(harness.resolve())
        raw = archive.extractfile(member).read()
        if hashlib.sha256(raw).hexdigest() != entry['sha256'] or len(raw) != entry['bytes']:
            raise ValueError('Published source bytes differ: ' + member.name)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(raw)
shutil.copyfile(__file__, root / 'study-driver.py')
(root / 'publication.json').write_text(json.dumps(publication, indent=2) + '\n')
(root / 'provenance.json').write_text(json.dumps(publication['provenance'], indent=2) + '\n')
script = harness / 'reports/benchmarks/native-class-ownership/background-affinity-experiment.cjs'
receipt = {'complete': False, 'accepted': None, 'method': 'background-affinity-study-v1',
           'head': publication['head'], 'startedAt': time.time(), 'nodePreflight': node_preflight, 'commands': []}


def save():
    (root / 'execution.json').write_text(json.dumps(receipt, indent=2) + '\n')


save()
for label, node, expected_version in nodes:
    record = {'command': [node, str(script), publication['preparation'], str(root / label), str(root / 'provenance.json')],
              'cwd': str(harness), 'startedAt': time.time(), 'stdout': label + '.stdout.log', 'stderr': label + '.stderr.log'}
    receipt['commands'].append(record)
    save()
    with (root / record['stdout']).open('xb') as stdout, (root / record['stderr']).open('xb') as stderr:
        child = subprocess.Popen(record['command'], cwd=harness, env=environment, stdout=stdout, stderr=stderr)
        record['pid'] = child.pid
        save()
        print('START ' + label + ' pid=' + str(child.pid), flush=True)
        record['exitCode'] = child.wait()
        record['finishedAt'] = time.time()
        save()
    print('END ' + label + ' exit=' + str(record['exitCode']), flush=True)
    if record['exitCode'] not in [0, 1]:
        raise SystemExit('Integrity/worker failure; preserve the original output, do not retry: ' + label)
verification_command = [nodes[-1][1], str(script), '--verify-set', str(root / 'node-22'), str(root / 'node-24')]
with (root / 'verification.json').open('xb') as stdout, (root / 'verification.stderr.log').open('xb') as stderr:
    result = subprocess.run(verification_command, cwd=harness, env=environment, stdout=stdout, stderr=stderr)
(root / 'verification.process.json').write_text(json.dumps({'command': verification_command, 'exitCode': result.returncode}) + '\n')
if result.returncode != 0:
    raise SystemExit('Offline verification failed; preserve all outputs')
verification = json.loads((root / 'verification.json').read_bytes())
if verification['verified'] is not True or verification['backgroundAffinityVerified'] is not True:
    raise ValueError('Full study integrity and thread checks were not confirmed')
receipt['complete'] = True
receipt['accepted'] = verification['accepted']
receipt['finishedAt'] = time.time()
save()
print('COMPLETE verified=true accepted=' + str(receipt['accepted']).lower(), flush=True)
raise SystemExit(0 if receipt['accepted'] is True else 1)
