from pathlib import Path
import hashlib
import json
import os
import subprocess
import sys

if sys.flags.optimize:
    raise RuntimeError('Published v2 source qualification requires non-optimized Python')

repository = Path('/mnt/c/Users/guido/.codex/worktrees/native-class-ownership/rustdom')
primary = Path('/mnt/c/Users/guido/ghq/projects/rustdom')
source = Path('/dev/shm/rustdom-pilot-v2-published-525e2be6')
output = repository / '.cache/pilot-v2-published-admission-525e2be6'
resume = sys.argv[1:] == ['--resume-explicit-git-config']
assert not sys.argv[1:] or resume
if resume:
    assert (output/'hydrate.stderr').is_file()
    output = output/'resume-explicit-git-config'
output.mkdir(exist_ok=False)
expected = '525e2be66edba26846582be67d0087418d64312c'
git = ['git', '-c', 'core.autocrlf=false', '-c', 'gc.auto=0', '-c', 'maintenance.auto=false']
def command(arguments, name, cwd=None, timeout=240):
    with (output/(name+'.stdout')).open('xb') as stdout, (output/(name+'.stderr')).open('xb') as stderr:
        result = subprocess.run(arguments, cwd=cwd, stdout=stdout, stderr=stderr, timeout=timeout)
    assert result.returncode == 0, (name, result.returncode)
    return (output/(name+'.stdout')).read_bytes()
if not resume:
    command(git + ['clone', '--filter=blob:none', '--no-checkout', '--depth=1', '--single-branch',
        '--branch=feature/native-class-ownership', 'https://github.com/guidomodarelli/rustdom.git', str(source)], 'clone')
assert (source/'.git').is_dir()
assert subprocess.check_output(git+['rev-parse','HEAD'], cwd=source).decode().strip() == expected
assert subprocess.check_output(git+['remote','get-url','origin'], cwd=source).decode().strip() == 'https://github.com/guidomodarelli/rustdom.git'
assert subprocess.check_output(git+['config','--get','remote.origin.promisor'], cwd=source).decode().strip() == 'true'
command(git + ['config', 'core.autocrlf', 'false'], 'explicit-git-config', source)
command(git + ['sparse-checkout','init','--no-cone'], 'sparse-init', source)
patterns = ['/*','!/*/', '/reports/benchmarks/native-class-ownership/numeric-composed-packages/',
    '/reports/validation/range-numeric-composed-package/20261026/archive.json',
    '/reports/validation/owner-batch-capture-method/review.json',
    '/reports/benchmarks/native-class-ownership/control-precision/pilot-v2/',
    '/.github/workflows/jsdom-block-pilot-v2-capture.yml',
    '/.github/workflows/jsdom-block-pilot-v2-contracts.yml', '/.github/workflows/ci.yml',
    '/reports/validation/jsdom-block-pilot-v2/capture-method/']
(source/'.git/info/sparse-checkout').write_text('\n'.join(patterns)+'\n')
command(git+['read-tree','-mu','HEAD'], 'read-tree', source)
pilot = source/'reports/benchmarks/native-class-ownership/control-precision/pilot-v2'
command(['python3','-B',str(pilot/'capture/checkout.py'),str(source)], 'hydrate', source)
results = []
for version, relative, checksum in [
    ('22.12.0','.tools/node-22/bin/node','177208bfc4a9403121a40c72d038c670f4fd937fa16ca7df0a720e90be0fe2d9'),
    ('24.14.1','.tools/node/bin/node','bf9112eb83a827dc9f9c8d19bb7bddcbf00f7b2fedae18fdcaee05406981f20a')]:
    node = primary/relative
    assert hashlib.sha256(node.read_bytes()).hexdigest() == checksum
    data = command([str(node),str(repository/'.cache/check-v2-published-source.cjs'),str(source),expected], version, source)
    results.append(json.loads(data))
assert subprocess.check_output(git+['status','--porcelain'], cwd=source) == b''
summary = {'sourceCommit':expected, 'actualRemotePartialClone':True, 'sourceClean':True,
    'bothSdksAdmitted':True, 'missingControllerRejectedBothSdks':True, 'results':results,
    'DOMExecuted':False, 'scientificCaptureExecuted':False, 'performanceAccepted':None, 'gateReevaluated':False}
(output/'summary.json').write_bytes(json.dumps(summary, indent=2).encode()+b'\n')
print(json.dumps(summary), flush=True)
