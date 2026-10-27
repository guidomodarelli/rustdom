"""Repack the verified study without changing its uncompressed tar bytes or observations."""
from pathlib import Path
import gzip,hashlib,json,lzma,time
workspace=Path('/mnt/c/Users/guido/.codex/worktrees/native-class-ownership/rustdom')
marker=json.loads((workspace/'.cache/background-affinity-archive-started.json').read_bytes())
assert marker['complete'] is True
source=Path(marker['archive']);assert source.is_relative_to(Path('/home/guido/rustdom-validation'))
output=source.with_suffix('.xz');assert not output.exists()
expected=marker['receipt']['archiveSha256'];digest=hashlib.sha256()
with source.open('rb') as stream:
 for block in iter(lambda:stream.read(8*1024*1024),b''):digest.update(block)
assert digest.hexdigest()==expected
uncompressed=hashlib.sha256();size=0;reported=0
with gzip.open(source,'rb') as original, lzma.open(output,'xb',preset=6) as target:
 for block in iter(lambda:original.read(8*1024*1024),b''):
  uncompressed.update(block);size+=len(block);target.write(block)
  if size-reported>=128*1024*1024:
   reported=size;print(json.dumps({'stage':'lossless-repack','tarBytesRead':size}),flush=True)
digest=hashlib.sha256();readback=hashlib.sha256();readback_size=0
with output.open('rb') as stream:
 for block in iter(lambda:stream.read(8*1024*1024),b''):digest.update(block)
with lzma.open(output,'rb') as stream:
 for block in iter(lambda:stream.read(8*1024*1024),b''):readback.update(block);readback_size+=len(block)
assert readback.hexdigest()==uncompressed.hexdigest() and readback_size==size
record={'complete':True,'sourceGzip':str(source),'sourceGzipSha256':expected,'xz':str(output),'xzBytes':output.stat().st_size,'xzSha256':digest.hexdigest(),'tarSha256':uncompressed.hexdigest(),'tarBytes':size,'uncompressedTarBytesIdentical':True,'measurementExecuted':False,'finishedAt':time.time()}
(workspace/'.cache/background-affinity-xz-transport.json').write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps(record),flush=True)