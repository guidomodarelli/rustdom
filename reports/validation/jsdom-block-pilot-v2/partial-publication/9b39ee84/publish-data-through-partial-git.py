from pathlib import Path
import json
import subprocess
import sys

if sys.flags.optimize:
    raise RuntimeError('Partial Git publication requires non-optimized Python')

repository = Path('/mnt/c/Users/guido/.codex/worktrees/native-class-ownership/rustdom')
source = Path('/dev/shm/rustdom-pilot-v2-published-525e2be6')
output = repository/'.cache/pilot-v2-partial-publication-9b39ee84'
output.mkdir(exist_ok=False)
git = ['git','-c','gc.auto=0','-c','maintenance.auto=false']
base = 'b348202bca63b11a17ee4c0b1e3724a1925934aa'
head = '9b39ee847046f8630ea9214f6d60414dc4db435a'
remote_ref = 'refs/heads/feature/pilot-v2-ci-evidence'
local_ref = 'refs/transport/qualification-9b39ee84'
bundle = repository/'.cache/pilot-v2-data-9b39ee84.bundle'
def read(arguments):
    return subprocess.check_output(git+arguments,cwd=source,stderr=subprocess.PIPE)
def run(arguments,name,timeout=180):
    with (output/(name+'.stdout')).open('xb') as stdout,(output/(name+'.stderr')).open('xb') as stderr:
        result = subprocess.run(git+arguments,cwd=source,stdout=stdout,stderr=stderr,timeout=timeout)
    assert result.returncode == 0,(name,result.returncode)
assert read(['rev-parse','HEAD']).decode().strip() == '525e2be66edba26846582be67d0087418d64312c'
assert read(['status','--porcelain']) == b''
assert read(['config','--get','remote.origin.promisor']).strip() == b'true'
assert read(['remote','get-url','origin']).strip() == b'https://github.com/guidomodarelli/rustdom.git'
assert read(['ls-remote','origin',remote_ref]).decode().split()[0] == base
run(['fetch','--filter=blob:none','--depth=1','origin',remote_ref], 'fetch-base')
run(['bundle','verify',str(bundle)],'verify-bundle')
run(['fetch',str(bundle),'feature/pilot-v2-ci-evidence:'+local_ref],'import-bundle')
assert read(['rev-parse',local_ref]).decode().strip() == head
assert read(['rev-list','--count',base+'..'+local_ref]).strip() == b'1'
intent = {'remoteRef':remote_ref,'expectedOldCommit':base,'newCommit':head,
    'forcePush':False,'automaticMutationRetries':0,'onlyNewEvidenceCommit':True}
(output/'intent.json').write_bytes(json.dumps(intent,indent=2).encode()+b'\n')
# Standard Git credential-helper protocol passes credentials only to Git, never to logs.
helper = '!"/mnt/c/Program Files/GitHub CLI/gh.exe" auth git-credential'
run(['-c','credential.helper=','-c','credential.helper='+helper,
    '-c','pack.window=0','push','origin',local_ref+':'+remote_ref], 'push',timeout=180)
assert read(['ls-remote','origin',remote_ref]).decode().split()[0] == head
assert read(['status','--porcelain']) == b''
summary = {**intent,'remoteCommitConfirmed':head,'partialClonePushPassed':True,
    'transportedBundleBytes':bundle.stat().st_size,'fullCapturePreservationQualified':False,
    'scope':'Publicación real de un commit nuevo de evidencia desde clon parcial; no equivale a probar el tamaño máximo ni todas las ramas de fallo de una captura futura.',
    'sourceClean':True,'DOMExecuted':False,'scientificCaptureExecuted':False}
(output/'summary.json').write_bytes(json.dumps(summary,indent=2,ensure_ascii=False).encode()+b'\n')
print(json.dumps(summary),flush=True)
