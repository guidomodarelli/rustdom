"""Import only four independently verified QA blobs; never filtered-fetch/repack the shared full repository."""
import hashlib
import json
from pathlib import Path
import subprocess
import sys

if sys.flags.optimize:
    raise RuntimeError('Bounded QA blob import requires non-optimized Python')
data = Path('C:/Users/guido/.codex/worktrees/pilot-v2-ci-evidence/rustdom')
source = Path(__file__).resolve().parent.parent
wsl = ['wsl','-d','Rustdom-Validation-20261025','-u','root','--','python3','-c']
raw = subprocess.check_output(wsl+['from pathlib import Path; import sys; sys.stdout.buffer.write(Path("/run/rustdom-scientific-publish-20261026/summary.json").read_bytes())'])
receipt = json.loads(raw)
if receipt['finalEvidenceCommit'] != 'c25901a6af14062cc213791addc4a16200af9e15' or len(receipt['record']['parts']) != 4:
    raise ValueError('Actual native publication receipt differs')
git = ['git','-c','core.longpaths=true','-c','gc.auto=0','-c','maintenance.auto=false']
records = []
combined = hashlib.sha256()
offset = 0
for part in receipt['record']['parts']:
    code = ('from pathlib import Path; import sys; '
        'p=Path("/run/rustdom-ci-4196-artifacts-20261026/journals/zip-12688150146.stdout"); '
        'f=p.open("rb"); f.seek('+str(offset)+'); sys.stdout.buffer.write(f.read('+str(part['bytes'])+'))')
    payload = subprocess.check_output(wsl+[code])
    if len(payload) != part['bytes'] or hashlib.sha256(payload).hexdigest() != part['sha256']:
        raise ValueError('Bounded input differs from independent remote readback')
    identity = hashlib.sha1(('blob '+str(len(payload))+'\0').encode()+payload).hexdigest()
    if identity != part['blob']:
        raise ValueError('Actual Git blob identity differs')
    observed = subprocess.check_output(git+['hash-object','-w','--stdin'],cwd=data,input=payload).decode().strip()
    if observed != identity:
        raise ValueError('Stored Git blob differs')
    combined.update(payload)
    offset += len(payload)
    records.append({'blob':identity,'bytes':len(payload),'sha256':part['sha256'],'independentRemoteDigestVerified':True})
    del payload
if offset != 111209731 or combined.hexdigest() != '914dccda28284f206e1e077f9805e652f66209694ef7c7bbe405c520ed2ecff7':
    raise ValueError('Combined imported original differs')
result = {'parts':records,'bytes':offset,'wholeOriginalDigestVerified':True,
    'filteredFetchRepeated':False,'permanentGitObjectsRemoved':False,'blockedTemporaryFileLeftUntouched':True}
(source/'.cache/native-qa-part-import.json').write_bytes(json.dumps(result,indent=2).encode()+b'\n')
print(json.dumps({'boundedBlobsImported':len(records),'bytes':offset}))
