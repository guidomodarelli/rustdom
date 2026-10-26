from pathlib import Path
import json
import os
import subprocess
import sys

if sys.flags.optimize:
    raise RuntimeError('Transport CLI guard qualification requires non-optimized Python')

repository = Path(__file__).resolve().parent.parent
output = repository/'.cache/pilot-v2-transport-cli-guards'/sys.platform
output.mkdir(parents=True, exist_ok=False)
cases = []
for script, expected in [
    ('qualify-partial-git-storage.py', 'Partial Git storage qualification requires non-optimized Python'),
    ('qualify-v2-published-source.py', 'Published v2 source qualification requires non-optimized Python')]:
    for mode in ['option', 'environment']:
        environment = dict(os.environ)
        arguments = [sys.executable, '-B']
        if mode == 'option':
            arguments.append('-O')
        else:
            environment['PYTHONOPTIMIZE'] = '1'
        arguments.append(str(repository/'.cache'/script))
        result = subprocess.run(arguments, env=environment, capture_output=True, timeout=30)
        if result.returncode == 0 or expected.encode() not in result.stderr or result.stdout:
            raise RuntimeError('Transport guard did not reject optimized Python: '+script+'/'+mode)
        name = script+'-'+mode
        (output/(name+'.stdout')).write_bytes(result.stdout)
        (output/(name+'.stderr')).write_bytes(result.stderr)
        cases.append({'script':script,'mode':mode,'exitCode':result.returncode,'rejected':True})
(output/'summary.json').write_bytes(json.dumps({'cases':cases,'casesPassed':len(cases),
    'DOMExecuted':False,'scientificCaptureExecuted':False},indent=2).encode()+b'\n')
print(json.dumps({'casesPassed':len(cases)}))
