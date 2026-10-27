"""Exercise real preparation against the caller's Git store and explicit shallow/error fixtures."""
import hashlib
import json
import os
from pathlib import Path
import sys
import types

if sys.flags.optimize:
    raise RuntimeError('Owner-pair platform contracts require non-optimized Python')
repository, baseline, root = [Path(argument).resolve() for argument in sys.argv[1:4]]
assert not root.exists()
root.mkdir(parents=True)
packet = repository / 'reports/implementation/static-range-owner-batch-candidate'
policy = json.loads((packet / 'tools/constants/tooling.json').read_bytes())
manifest = json.loads((packet / 'source.json').read_bytes())
candidate_path = packet / 'tools/candidate.py'
candidate = types.ModuleType('owner_pair_platform_candidate')
candidate.__file__ = str(candidate_path)
exec(compile(candidate_path.read_bytes(), str(candidate_path), 'exec'), candidate.__dict__)
_, executor, _ = candidate.context(repository)
specification = packet / 'tools/prepare.spec.py'
receipt = {'passed': False, 'contracts': [], 'DOMExecuted': False, 'measurementExecuted': False,
           'specificationSha256': hashlib.sha256(specification.read_bytes()).hexdigest(),
           'platformSpecificationSha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest()}


def command(name, arguments, success=True):
    """Retain the actual subprocess transport and assert its expected observable outcome."""
    result = executor.run_command(name, arguments, root, os.environ.copy(), root,
                                  policy['preparationSuiteTimeoutSeconds'],
                                  policy['preparationCleanupTimeoutSeconds'])
    assert not result['timedOut'], name
    assert (result['exitCode'] == 0) == success, name
    return result


def specification_run(name, source, success=True):
    """Run the public preparation contracts as a separate real CLI process."""
    target = root / name
    command(name, [sys.executable, '-B', str(specification), str(repository), str(source), str(target)], success)
    actual = json.loads((target / 'receipt.json').read_bytes())
    if success:
        assert actual['passed'] and actual['contractsCount'] == 4
        receipt['contracts'].extend({'fixture': name, **entry} for entry in actual['contracts'])
    return actual


specification_run('original-contracts', baseline)
origin_git = baseline if (baseline / 'objects').is_dir() else baseline / '.git'
assert origin_git.is_dir() and (origin_git / 'objects').is_dir()
source = root / 'shallow-baseline'
command('shallow-init', ['git', 'init', str(source)])
(source / '.git/objects/info/alternates').write_text(
    (origin_git / 'objects').as_posix() + '\n', encoding='utf-8', newline='\n')
command('shallow-ref', ['git', '-C', str(source), 'update-ref', 'refs/heads/fixture', manifest['baseCommit']])
command('shallow-head', ['git', '-C', str(source), 'symbolic-ref', 'HEAD', 'refs/heads/fixture'])
(source / '.git/shallow').write_text(manifest['baseCommit'] + '\n', encoding='utf-8', newline='\n')
before = (source / '.git/shallow').read_bytes()
specification_run('shallow-contracts', source)
assert (source / '.git/shallow').read_bytes() == before
(source / '.git/shallow').write_bytes(b'Invalid shallow boundary\n')
actual = specification_run('invalid-boundary-contract', source, False)
failure = actual['setupFailure']
assert failure['exitCode'] != 0
stderr = (root / 'invalid-boundary-contract' / failure['stderrFile']).read_bytes()
assert stderr and not (root / 'invalid-boundary-contract/positive-proof').exists()
assert (source / '.git/shallow').read_bytes() == b'Invalid shallow boundary\n'
receipt['contracts'].append({'fixture': 'invalid-boundary-contract', 'name': 'preserve-real-git-error',
                             'exitCode': failure['exitCode'], 'expectedSuccess': False,
                             'stderrSha256': hashlib.sha256(stderr).hexdigest(), 'stderrBytes': len(stderr)})
receipt.update(passed=True, contractsCount=len(receipt['contracts']), sourceBoundaryPreserved=True)
(root / 'receipt.json').write_text(json.dumps(receipt, indent=2) + '\n', encoding='utf-8', newline='\n')
print(json.dumps({'passed': True, 'contracts': len(receipt['contracts']), 'DOMExecuted': False}))
