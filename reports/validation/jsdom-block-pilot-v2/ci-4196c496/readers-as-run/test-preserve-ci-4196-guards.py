"""Verify both optimized interpreter modes refuse preservation before changing the data worktree."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys

source = Path(__file__).resolve().parent.parent
script = source/'.cache/preserve-ci-4196-results.py'
data = Path('C:/Users/guido/.codex/worktrees/pilot-v2-ci-evidence/rustdom')
root = source/'.cache/ci-4196-preservation-guard-tests-final'
root.mkdir(exist_ok=False)
git = ['git','-c','core.longpaths=true','-c','gc.auto=0','-c','maintenance.auto=false']
before = subprocess.check_output(git+['status','--porcelain'],cwd=data)
head = subprocess.check_output(git+['rev-parse','HEAD'],cwd=data)
marker = root/'preserve.bin'
payload = b'unchanged\x00\xff\r\n'
marker.write_bytes(payload)
cases = []
for label,arguments,environment in [
    ('cli-optimization',[sys.executable,'-O',str(script)],dict(os.environ)),
    ('environment-optimization',[sys.executable,str(script)],dict(os.environ,PYTHONOPTIMIZE='1')),
]:
    with (root/(label+'.stdout')).open('xb') as stdout,(root/(label+'.stderr')).open('xb') as stderr:
        result = subprocess.run(arguments,cwd=root,env=environment,stdout=stdout,stderr=stderr)
    assert result.returncode != 0 and b'CI result preservation requires non-optimized Python' in (root/(label+'.stderr')).read_bytes()
    assert marker.read_bytes() == payload
    assert subprocess.check_output(git+['status','--porcelain'],cwd=data) == before
    assert subprocess.check_output(git+['rev-parse','HEAD'],cwd=data) == head
    cases.append({'case':label,'refusedBeforeDataChanges':True,'markerUnchanged':True,'dataHeadAndStatusUnchanged':True})
summary = {'preserverSha256':hashlib.sha256(script.read_bytes()).hexdigest(),'cases':cases,
    'GitHubInvoked':False,'DOMExecuted':False,'scientificCaptureExecuted':False}
(root/'summary.json').write_bytes(json.dumps(summary,indent=2).encode()+b'\n')
print(json.dumps(summary))
