from pathlib import Path
import hashlib
import json
import subprocess

repository = Path('/mnt/c/Users/guido/.codex/worktrees/native-class-ownership/rustdom')
source = Path('/dev/shm/rustdom-pilot-v2-published-525e2be6')
output = repository/'.cache/pilot-v2-partial-storage-qualification'
output.mkdir(exist_ok=False)
expected = '525e2be66edba26846582be67d0087418d64312c'
git = ['git', '-c', 'gc.auto=0', '-c', 'maintenance.auto=false']
def run(arguments):
    return subprocess.check_output(git+arguments, cwd=source, stderr=subprocess.PIPE)
assert run(['rev-parse','HEAD']).decode().strip() == expected
assert run(['status','--porcelain']) == b''
assert run(['config','--get','remote.origin.promisor']).strip() == b'true'
layout = json.loads((repository/'reports/validation/jsdom-block-pilot-v2/ci-57c3c2c9/storage-layout.json').read_bytes())
part = layout['artifacts'][0]['parts'][0]
object_id = run(['ls-tree', 'HEAD', '--', part['path']]).decode().split()[2]
def disk_bytes():
    return sum(file.stat().st_size for file in (source/'.git').rglob('*') if file.is_file())
before = disk_bytes()
with (output/'git-show.stderr.log').open('xb') as stderr:
    process = subprocess.Popen(git+['show',expected+':'+part['path']],cwd=source,stdout=subprocess.PIPE,stderr=stderr)
    checksum = hashlib.sha256()
    count = 0
    while True:
        block = process.stdout.read(1024*1024)
        if not block: break
        checksum.update(block)
        count += len(block)
    assert process.wait(timeout=240) == 0
assert count == part['bytes'] and checksum.hexdigest() == part['sha256']
assert run(['status','--porcelain']) == b''
summary = {'sourceCommit':expected, 'actualRemotePartialClone':True,
    'testedPublishedPart':part, 'gitBlobObjectId':object_id,
    'gitDirectoryBytesBefore':before, 'gitDirectoryBytesAfter':disk_bytes(),
    'bytesRead':count, 'originalPartDigestVerified':True,
    'allOriginalZipPartsRead':False, 'remoteWriteTested':False,
    'fullCapturePreservationQualified':False,
    'scope':'Lectura de una parte real desde un clon parcial remoto; no demuestra publicación incremental ni preservación completa de una captura futura.',
    'sourceClean':True, 'DOMExecuted':False, 'scientificCaptureExecuted':False}
(output/'summary.json').write_bytes(json.dumps(summary,indent=2,ensure_ascii=False).encode()+b'\n')
print(json.dumps(summary),flush=True)
