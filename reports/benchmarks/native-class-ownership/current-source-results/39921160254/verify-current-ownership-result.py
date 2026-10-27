"""Consume the authenticated original result through existing readers; never run a sampler."""
import json
from pathlib import Path
import subprocess
import sys

if sys.flags.optimize:
    raise RuntimeError('Ownership result verification requires Python assertions; disable Python optimization')

repository = Path('/mnt/c/Users/guido/.codex/worktrees/native-class-ownership/rustdom')
state = json.loads((repository / '.cache/current-ownership-results-extraction-state.json').read_text())
assert state['transportAuthenticated'] is True
root = Path(state['root'])
output = root.parent.parent / 'verification'
output.mkdir(exist_ok=True)
script = repository / 'reports/benchmarks/native-class-ownership/current-ownership-experiment.cjs'
indices = {}
for label in ['node-22', 'node-24']:
    filename = root / label / 'index.json'
    indices[label] = json.loads(filename.read_text()) if filename.exists() else None
original_path = root / 'verification.json'
original = json.loads(original_path.read_text()) if original_path.exists() and original_path.stat().st_size else None
results = {}
commands = []
for profile, binary in [('node22', 'node-22'), ('node24', 'node')]:
    executable = '/mnt/c/Users/guido/ghq/projects/rustdom/.tools/' + binary + '/bin/node'
    for mode, arguments in [('preparation', ['--inspect', str(root / 'preparation/ownership-build')]),
                            ('observations', ['--verify-set', str(root / 'node-22'), str(root / 'node-24')])]:
        command = [executable, str(script), *arguments]
        child = subprocess.run(command, cwd=repository, capture_output=True)
        name = profile + '-' + mode
        (output / (name + '.stdout.json')).write_bytes(child.stdout)
        (output / (name + '.stderr.log')).write_bytes(child.stderr)
        commands.append({'profile': profile, 'mode': mode, 'command': command, 'exitCode': child.returncode})
        if child.returncode == 0:
            results[name] = json.loads(child.stdout)
all_readers_passed = len(results) == 4
original_decision_matched = (all_readers_passed and original is not None and
    results['node22-observations'] == results['node24-observations'] == original)
execution_complete = all(index and index.get('complete') is True for index in indices.values())
scientifically_verified = all_readers_passed and original_decision_matched and execution_complete
record = {'runId': 39921160254, 'transportAuthenticated': True,
    'executionComplete': execution_complete, 'allExistingReadersPassed': all_readers_passed,
    'originalDecisionMatched': original_decision_matched, 'verified': scientifically_verified,
    'accepted': original['accepted'] if scientifically_verified else None,
    'nodeStates': {label: None if index is None else {name: index.get(name) for name in ['complete', 'accepted', 'failure']}
                   for label, index in indices.items()},
    'commands': commands, 'samplerExecuted': False}
(output / 'verification-state.json').write_text(json.dumps(record, indent=2) + '\n')
(repository / '.cache/current-ownership-results-verification-state.json').write_text(json.dumps({
    'root': str(output), 'verified': record['verified'], 'accepted': record['accepted'],
    'executionComplete': record['executionComplete'], 'samplerExecuted': False}, indent=2) + '\n')
print(json.dumps(record))
raise SystemExit(0 if scientifically_verified else 1)
