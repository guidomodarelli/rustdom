"""Check both optimized modes cannot run the installer or credential-bearing qualification."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys

source = Path(__file__).resolve().parent.parent
evidence = source/'.cache/native-gh-2.103.3-qualification'
root = evidence/'entry-guards-final'
root.mkdir(exist_ok=False)
binary = Path('/run/rustdom-native-gh-2.103.3/gh')
before = hashlib.sha256(binary.read_bytes()).hexdigest()
cases = []
for filename in ['install-native-gh-linux.py','qualify-native-gh-linux.py']:
    script = source/'.cache'/filename
    for label,arguments,environment in [
        ('cli',[sys.executable,'-O',str(script)],dict(os.environ)),
        ('environment',[sys.executable,str(script)],dict(os.environ,PYTHONOPTIMIZE='1')),
    ]:
        name = filename.removesuffix('.py')+'-'+label
        result = subprocess.run(arguments,cwd=root,env=environment,capture_output=True)
        (root/(name+'.stdout')).write_bytes(result.stdout)
        (root/(name+'.stderr')).write_bytes(result.stderr)
        if result.returncode == 0 or result.stdout or b'non-optimized Python' not in result.stderr:
            raise AssertionError('Optimized native CLI entry point did not refuse before acting')
        if (evidence/'commands').exists() or Path('/run/rustdom-native-gh-2.103.3-config').exists():
            raise AssertionError('Optimized qualification created outputs or credential configuration')
        if hashlib.sha256(binary.read_bytes()).hexdigest() != before:
            raise AssertionError('Optimized installer changed the authenticated binary')
        cases.append({'script':filename,'scriptSha256':hashlib.sha256(script.read_bytes()).hexdigest(),'mode':label,'refusedBeforeQualificationOrInstall':True,
            'binaryUnchanged':True,'credentialConfigurationNotCreated':True})
receipt = {'cases':cases,'nativeBinarySha256':before,'GitHubInvoked':False,'newDOMExecuted':False,
    'scientificCaptureExecuted':False}
(root/'summary.json').write_bytes(json.dumps(receipt,indent=2).encode()+b'\n')
print(json.dumps(receipt),flush=True)
