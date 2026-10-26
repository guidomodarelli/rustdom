"""Check actual maintained entry guards before collecting any credentials or bytes."""
import json
import os
from pathlib import Path
import subprocess
import sys

if sys.flags.optimize or sys.platform != 'linux':
    raise RuntimeError('Current stream guards require non-optimized Linux Python')
root = Path('/run/rustdom-stream-entry-guards-20261026')
root.mkdir(exist_ok=False)
base = Path('/mnt/c/Users/guido/.codex/worktrees/pilot-v2-ci-evidence/rustdom/tools/evidence-transport')
records = []
for filename in [base/'runtime.py',base/'tests/test_stream.py']:
    for mode in ['flag','environment']:
        label = filename.stem+'-'+mode
        environment = dict(os.environ, PYTHONDONTWRITEBYTECODE='1')
        arguments = [sys.executable]
        if mode == 'flag':
            arguments.append('-O')
        else:
            environment['PYTHONOPTIMIZE'] = '1'
        arguments.append(str(filename))
        result = subprocess.run(arguments,env=environment,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=15)
        (root/(label+'.stdout')).write_bytes(result.stdout)
        (root/(label+'.stderr')).write_bytes(result.stderr)
        if result.returncode == 0 or b'Evidence transport requires non-optimized Python' not in result.stderr:
            raise AssertionError('Current optimized entry did not reject before transport: '+label)
        records.append({'case':label,'exitCode':result.returncode,'refusedBeforeTransport':True})
(root/'summary.json').write_bytes(json.dumps({'cases':records,'scientificCaptureExecuted':False},indent=2).encode()+b'\n')
print(json.dumps({'passed':len(records)}))
