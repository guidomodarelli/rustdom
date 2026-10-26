from pathlib import Path
import hashlib
import json
import subprocess
import sys

if sys.flags.optimize:
    raise RuntimeError('Published checkout fix verification requires non-optimized Python')

repository = Path('/mnt/c/Users/guido/.codex/worktrees/native-class-ownership/rustdom')
primary = Path('/mnt/c/Users/guido/ghq/projects/rustdom')
source = Path('/dev/shm/rustdom-pilot-v2-published-525e2be6')
output = repository/'.cache/published-checkout-fix-4196'
output.mkdir(exist_ok=False)
git = ['git','-c','core.autocrlf=false','-c','gc.auto=0','-c','maintenance.auto=false']
head = '4196c496187c88c92304516287a7e644659a8536'
def command(arguments,name):
    with (output/(name+'.stdout')).open('xb') as stdout,(output/(name+'.stderr')).open('xb') as stderr:
        result = subprocess.run(arguments,cwd=source,stdout=stdout,stderr=stderr,timeout=240)
    assert result.returncode == 0,(name,result.returncode)
assert subprocess.check_output(git+['status','--porcelain'],cwd=source) == b''
assert subprocess.check_output(git+['remote','get-url','origin'],cwd=source).strip() == b'https://github.com/guidomodarelli/rustdom.git'
command(git+['fetch','--filter=blob:none','--depth=1','origin','refs/heads/feature/native-class-ownership'],'fetch')
assert subprocess.check_output(git+['rev-parse','FETCH_HEAD'],cwd=source).decode().strip() == head
command(git+['checkout','--detach',head],'checkout')
records = []
for version,relative,checksum in [
    ('22.12.0','.tools/node-22/bin/node','177208bfc4a9403121a40c72d038c670f4fd937fa16ca7df0a720e90be0fe2d9'),
    ('24.14.1','.tools/node/bin/node','bf9112eb83a827dc9f9c8d19bb7bddcbf00f7b2fedae18fdcaee05406981f20a')]:
    node = primary/relative
    assert hashlib.sha256(node.read_bytes()).hexdigest() == checksum
    command([str(node),str(repository/'.cache/check-v2-published-source.cjs'),str(source),head],version)
    records.append(json.loads((output/(version+'.stdout')).read_bytes()))
assert subprocess.check_output(git+['status','--porcelain'],cwd=source) == b''
summary = {'sourceCommit':head,'actualRemoteLinuxGitCheckout':True,'sourceClean':True,
    'records':records,'reviewedMethodEntries':903,'bothNodeVersionsPassed':True,
    'DOMExecuted':False,'scientificCaptureExecuted':False,'performanceAccepted':None,'gateReevaluated':False}
(output/'summary.json').write_bytes(json.dumps(summary,indent=2).encode()+b'\n')
print(json.dumps(summary),flush=True)
