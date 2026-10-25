"""Real Git preparation contracts for the owner-pair candidate, with preserved dirty sources and outputs."""
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys

if sys.flags.optimize:
    raise RuntimeError('Owner-pair preparation contracts require non-optimized Python')

repository, baseline, root = [Path(argument).resolve() for argument in sys.argv[1:4]]
assert not root.exists()
root.mkdir(parents=True)
packet = repository / 'reports/implementation/static-range-owner-batch-candidate'
policy = json.loads((packet / 'tools/constants/tooling.json').read_bytes())
manifest = json.loads((packet / 'source.json').read_bytes())
receipt = {'contracts': [], 'measurementExecuted': False, 'DOMExecuted': False,
           'candidateToolSha256': hashlib.sha256((packet / 'tools/candidate.py').read_bytes()).hexdigest(),
           'toolingPolicySha256': hashlib.sha256((packet / 'tools/constants/tooling.json').read_bytes()).hexdigest()}


def clone(name):
    """Create a real clean Git checkout of the pinned base, with only consumed source paths materialized."""
    source = root / name
    subprocess.run(['git', 'clone', '--shared', '--no-checkout', str(baseline), str(source)], check=True, capture_output=True)
    subprocess.run(['git', 'sparse-checkout', 'init', '--no-cone'], cwd=source, check=True, capture_output=True)
    patterns = ['/*', '!/*/'] + ['/' + name for name in manifest['sources']]
    subprocess.run(['git', 'sparse-checkout', 'set', '--no-cone', '--stdin'], cwd=source,
                   input='\n'.join(patterns) + '\n', text=True, check=True, capture_output=True)
    subprocess.run(['git', 'checkout', '--detach', manifest['baseCommit']], cwd=source, check=True, capture_output=True)
    assert not subprocess.check_output(['git', 'status', '--porcelain'], cwd=source)
    return source


def run(name, current, source, output, success):
    """Invoke the actual public CLI, retaining complete stdout/stderr and its observable result."""
    child = subprocess.run([sys.executable, '-B', str(packet / 'tools/candidate.py'), '--prepare',
                            str(current), str(source), str(output)], capture_output=True)
    (root / (name + '.stdout.log')).write_bytes(child.stdout)
    (root / (name + '.stderr.log')).write_bytes(child.stderr)
    receipt['contracts'].append({'name': name, 'exitCode': child.returncode, 'expectedSuccess': success})
    (root / 'receipt.json').write_text(json.dumps(receipt, indent=2) + '\n', encoding='utf-8')
    assert (child.returncode == 0) == success, name
    return json.loads(child.stdout) if success else None


source = clone('positive-source')
result = run('apply-and-copy-real-contracts', repository, source, root / 'positive-proof', True)
assert result['prepared'] and result['sourceBeforeChangesRaw'] == '' and not result['sourceGitErrors']
for name, checksum in manifest['sources'].items():
    assert hashlib.sha256((source / name).read_bytes()).hexdigest() == checksum, name
for entry in policy['extraFiles']:
    assert hashlib.sha256((source / entry['target']).read_bytes()).hexdigest() == manifest['tests'][entry['source']]

source = clone('dirty-source')
(source / 'foreign-work.txt').write_bytes(b'Preserve this caller-owned fixture')
before = subprocess.check_output(['git', 'status', '--porcelain', '--untracked-files=all'], cwd=source)
run('preserve-dirty-source', repository, source, root / 'dirty-proof', False)
assert subprocess.check_output(['git', 'status', '--porcelain', '--untracked-files=all'], cwd=source) == before
assert (source / 'foreign-work.txt').read_bytes() == b'Preserve this caller-owned fixture'

source = clone('existing-output-source')
output = root / 'existing-output'; output.mkdir(); (output / 'sentinel').write_bytes(b'Preserve output')
run('preserve-existing-output', repository, source, output, False)
assert (output / 'sentinel').read_bytes() == b'Preserve output'
assert not subprocess.check_output(['git', 'status', '--porcelain'], cwd=source)

source = clone('dependency-source')
corrupt = root / 'corrupt-current'; corrupt.mkdir()
for identity in policy['sharedModules'].values():
    for descriptor in [identity, *identity['dependencies']]:
        original = repository / descriptor['path']; target = corrupt / descriptor['path']
        target.parent.mkdir(parents=True, exist_ok=True); shutil.copyfile(original, target)
changed = corrupt / policy['sharedModules']['prepare']['dependencies'][0]['path']
changed.write_bytes(changed.read_bytes() + b' ')
run('reject-transitive-configuration-before-apply', corrupt, source, root / 'dependency-proof', False)
assert not (root / 'dependency-proof').exists()
assert not subprocess.check_output(['git', 'status', '--porcelain'], cwd=source)
receipt.update(passed=True, contractsCount=len(receipt['contracts']), sourceGraph=manifest['sources'],
               helperTransitiveInputsChecked=True)
(root / 'receipt.json').write_text(json.dumps(receipt, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'passed': True, 'contracts': len(receipt['contracts']), 'DOMExecuted': False}))
