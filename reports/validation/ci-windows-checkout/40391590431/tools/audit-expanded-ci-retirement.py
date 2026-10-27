from pathlib import Path
import hashlib
import json
import subprocess
import sys

if sys.flags.optimize:
    raise RuntimeError('Expanded evidence audit requires non-optimized Python')

repository = Path(__file__).resolve().parent.parent
git = ['git','-c','core.longpaths=true','-c','gc.auto=0','-c','maintenance.auto=false']
head = '525e2be66edba26846582be67d0087418d64312c'
assert subprocess.check_output(git+['rev-parse','HEAD'],cwd=repository).decode().strip() == head
assert subprocess.check_output(git+['status','--porcelain'],cwd=repository) == b''
base = 'reports/validation/jsdom-block-pilot-v2/ci-57c3c2c9'
collection = base+'/contracts/40375966913'
receipt_path = collection+'/receipt.json'
receipt_raw = subprocess.check_output(git+['cat-file','blob','HEAD:'+receipt_path],cwd=repository)
receipt = json.loads(receipt_raw)
assert receipt['headCommit'] == '57c3c2c9ca8dd4c76749031964c86bd3b33df0f9'
assert receipt['runId'] == 40375966913 and receipt['attempt'] == 1
rows = {}
for raw in subprocess.check_output(git+['ls-tree','-r','-z','HEAD'],cwd=repository).split(b'\0'):
    if not raw: continue
    metadata, name = raw.split(b'\t',1)
    mode, kind, object_id = metadata.decode().split()
    rows[name.decode()] = (mode,kind,object_id)
selected = {}
directories = []
artifacts = []
for artifact in receipt['artifacts']:
    directory = collection+'/'+artifact['name']
    directories.append(directory)
    for member in artifact['members']:
        relative = directory+'/'+member['path']
        assert relative not in selected
        assert rows[relative][0:2] == ('100644','blob')
        selected[relative] = member
    artifacts.append({'artifactId':artifact['id'],'name':artifact['name'],
        'expandedDirectory':directory,'originalZipPath':collection+'/'+str(artifact['id'])+'.zip',
        'zipBytes':artifact['bytes'],'zipSha256':artifact['sha256'],
        'expandedFiles':len(artifact['members'])})
assert len(selected) == 9624
assert set(selected) == {relative for relative in rows if any(relative.startswith(directory+'/') for directory in directories)}
cache = {}
process = subprocess.Popen(git+['cat-file','--batch'],cwd=repository,stdin=subprocess.PIPE,stdout=subprocess.PIPE)
try:
    for relative, expected in selected.items():
        object_id = rows[relative][2]
        if object_id not in cache:
            process.stdin.write((object_id+'\n').encode()); process.stdin.flush()
            returned_id, kind, size = process.stdout.readline().decode().split()
            assert returned_id == object_id and kind == 'blob'
            payload = process.stdout.read(int(size)); assert len(payload) == int(size)
            assert process.stdout.read(1) == b'\n'
            cache[object_id] = (int(size),hashlib.sha256(payload).hexdigest())
        assert cache[object_id] == (expected['bytes'],expected['sha256']), relative
finally:
    process.stdin.close()
    assert process.wait(timeout=60) == 0
historical = json.loads((repository/'reports/validation/jsdom-block-pilot/capture-method/review.json').read_bytes())
assert len(historical['files']) == 850 and not set(selected).intersection(historical['files'])
for relative, checksum in historical['files'].items():
    assert hashlib.sha256((repository/relative).read_bytes()).hexdigest() == checksum,relative
remaining = set(rows)-set(selected)
layout = {'revision':'ci-expanded-artifacts-in-original-zips-v1','originalSourceCommit':receipt['headCommit'],
    'originalRunId':40375966913,'originalAttempt':1,'expandedTreePublishedCommit':head,
    'receiptPath':receipt_path,'receiptSha256':hashlib.sha256(receipt_raw).hexdigest(),
    'largeZipPartsLayout':base+'/storage-layout.json','retiredExpandedFiles':len(selected),
    'artifacts':artifacts,'originalZipBytesUnchanged':True,'archivedCodeMayBeExecuted':False}
audit = {'sourceCommit':head,'retiredExpandedFiles':len(selected),'uniqueGitBlobsVerified':len(cache),
    'allGitBlobBytesMatchAuthenticatedZipInventory':True,'historicalPinsPreserved':850,
    'maximumGitRelativePathBefore':max(map(len,rows)),
    'maximumGitRelativePathAfter':max(map(len,remaining)),
    'retiredPathsSha256':hashlib.sha256(('\n'.join(sorted(selected))+'\n').encode()).hexdigest(),
    'originalArchivesPreserved':True,'DOMExecuted':False,'scientificCaptureExecuted':False}
for name,value in [('expanded-artifact-layout.json',layout),('expanded-retirement-audit.json',audit)]:
    target = repository/base/name
    assert not target.exists()
    target.write_bytes(json.dumps(value,indent=2).encode()+b'\n')
(repository/'.cache/expanded-ci-retirement-directories.json').write_bytes(json.dumps(directories,indent=2).encode()+b'\n')
print(json.dumps(audit),flush=True)
