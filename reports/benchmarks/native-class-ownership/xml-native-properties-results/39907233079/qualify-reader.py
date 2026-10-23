import json
from pathlib import Path
import shutil
import subprocess

repository = Path('/mnt/c/Users/guido/.codex/worktrees/native-class-ownership/rustdom')
state = json.loads((repository / '.cache/xml-native-properties-verification-state.json').read_text())
assert state['exitCode'] == 0
root = Path(state['root'])
study = root / 'xml-full-inputs'
reader = repository / 'reports/benchmarks/native-class-ownership/verify-xml-current-capture.py'
expected_head = 'a5a1379d2d59827f557c44b94e7660db43619b04'
expected_source = '5ef668c47a78bb73ef5b0881fbf20e6d36c4d4cc9686198c26e722d8fc9c6806'
execution = json.loads((study / 'capture/execution.json').read_text())
assert execution['before']['sources']['B']['sourceCommit'] == expected_head
assert execution['before']['inputs']['sources']['B'] == expected_source
summary = {'readerExecutedMeasurement': False, 'runs': []}
for profile, node in [('node22', '/mnt/c/Users/guido/ghq/projects/rustdom/.tools/node-22/bin/node'),
                      ('node24', '/mnt/c/Users/guido/ghq/projects/rustdom/.tools/node/bin/node')]:
    command = ['python3', str(reader), str(study / 'capture'), str(study / 'preparation'), node]
    result = subprocess.run(command, capture_output=True)
    (root / f'verification-{profile}.json').write_bytes(result.stdout)
    (root / f'verification-{profile}.stderr.log').write_bytes(result.stderr)
    summary['runs'].append({'profile': profile, 'command': command, 'exitCode': result.returncode})
    assert result.returncode == 0, result.stderr.decode()
    report = json.loads(result.stdout)
    assert report['verified'] and report['recordedInputsVerified']
    assert report['recordedSources']['B'] == expected_source
    assert report['accepted'] is execution['performanceAccepted']
    assert report['currentInputEligibilityVerified'] is False
    print(profile, result.returncode, flush=True)
assert (root / 'verification-node22.json').read_bytes() == (root / 'verification-node24.json').read_bytes()

# Bind the complete physical source/build graph independently from the timing decision.
script = "const m=require(process.argv[1]);process.stdout.write(JSON.stringify(m.captureXmlBuildInputs(process.argv[2],process.argv[3])));"
command = [node, '-e', script, str(repository / 'reports/benchmarks/native-class-ownership/xml-build-inputs.cjs'),
           str(study / 'preparation/baseline-sources'), str(repository)]
current = subprocess.run(command, capture_output=True)
assert current.returncode == 0, current.stderr.decode()
current_inputs = json.loads(current.stdout)
assert current_inputs == execution['before']['inputs']
(root / 'current-inputs-binding.json').write_text(json.dumps({
    'measuredHead': expected_head, 'recordedSourceAndBuildInputsMatchCurrent': True,
    'inputs': current_inputs, 'readerExecutedMeasurement': False,
    'performanceAccepted': execution['performanceAccepted'],
    'scope': 'Fuentes e inputs de build actuales coinciden con el entorno Linux/Node24 registrado; no es aprobación de otro entorno o binario local.'
}, indent=2, ensure_ascii=False) + '\n')

negative = root / 'negative-reader-capture'
shutil.copytree(study / 'capture', negative / 'capture')
shutil.copyfile(study / 'functional.json', negative / 'functional.json')
original = (negative / 'capture/execution.json').read_bytes()
for name in ['changed-after-inputs', 'mutated-acceptance']:
    record = json.loads(original)
    if name == 'changed-after-inputs':
        record['after']['inputs']['sources']['B'] = 'altered'
    else:
        record['performanceAccepted'] = False if record['performanceAccepted'] is True else True
    (negative / 'capture/execution.json').write_text(json.dumps(record) + '\n')
    command = ['python3', str(reader), str(negative / 'capture'), str(study / 'preparation'), node]
    result = subprocess.run(command, capture_output=True)
    (root / f'{name}.stdout.log').write_bytes(result.stdout)
    (root / f'{name}.stderr.log').write_bytes(result.stderr)
    assert result.returncode != 0 and b'AssertionError' in result.stderr
    summary['runs'].append({'profile': name, 'command': command, 'exitCode': result.returncode, 'expectedRejection': True})
    print(name, result.returncode, flush=True)
(root / 'reader-qualification.json').write_text(json.dumps(summary, indent=2) + '\n')
print(json.dumps(summary), flush=True)
