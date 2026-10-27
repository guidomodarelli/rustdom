import json
from pathlib import Path
import shutil
import subprocess

repository = Path('/mnt/c/Users/guido/.codex/worktrees/native-class-ownership/rustdom')
root = Path('/home/guido/rustdom-validation/xml-full-inputs-39896591561-l9mvub2r')
study = root / 'xml-full-inputs'
reader = repository / 'reports/benchmarks/native-class-ownership/verify-xml-current-capture.py'
summary = {'measurementExecuted': False, 'runs': []}
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
    assert report['accepted'] is False and report['calibrated'] is True
    assert report['currentInputEligibilityVerified'] is False
    print(profile, result.returncode, flush=True)
assert (root / 'verification-node22.json').read_bytes() == (root / 'verification-node24.json').read_bytes()
negative = root / 'negative-reader-capture'
shutil.copytree(study / 'capture', negative / 'capture')
shutil.copyfile(study / 'functional.json', negative / 'functional.json')
original = (negative / 'capture/execution.json').read_bytes()
for name in ['changed-after-inputs', 'falsified-acceptance']:
    record = json.loads(original)
    if name == 'changed-after-inputs': record['after']['inputs']['sources']['B'] = 'altered'
    else: record['performanceAccepted'] = True
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
