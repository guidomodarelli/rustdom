"""Archive the completed original background-affinity study without rerunning measurements."""
from pathlib import Path
import collections, gzip, hashlib, json, os, shutil, tarfile, tempfile, time
source=Path('/home/guido/rustdom-validation/background-affinity-study-k98_55yo')
workspace=Path('/mnt/c/Users/guido/.codex/worktrees/native-class-ownership/rustdom')
output=workspace/'reports/benchmarks/native-class-ownership/background-affinity-results/2026-10-22'
assert not output.exists(), 'Preserve an existing archive rather than overwriting it'
execution=json.loads((source/'execution.json').read_bytes());verification=json.loads((source/'verification.json').read_bytes())
assert execution['complete'] is True and execution['accepted'] is False
assert verification['verified'] is True and verification['backgroundAffinityVerified'] is True and verification['accepted'] is False
assert json.loads((source/'verification.process.json').read_bytes())['exitCode']==0
assert all(command['exitCode']==1 for command in execution['commands'])
assert shutil.disk_usage(source.parent).free>2_000_000_000
output.mkdir(parents=True)
archive_directory=Path(tempfile.mkdtemp(prefix='background-affinity-archive-',dir=source.parent))
archive=archive_directory/'study.tar.gz'
status={'complete':False,'source':str(source),'output':str(output),'archive':str(archive),'pid':os.getpid(),'measurementExecuted':False}
marker=workspace/'.cache/background-affinity-archive-started.json';marker.write_text(json.dumps(status,indent=2)+'\n')
def checksum(filename):
 digest=hashlib.sha256()
 with filename.open('rb') as stream:
  for block in iter(lambda:stream.read(8*1024*1024),b''):digest.update(block)
 return digest.hexdigest()
def save_json(name,data):
 with (output/name).open('xb') as stream:stream.write((json.dumps(data,indent=2,ensure_ascii=False)+'\n').encode())
paths=sorted(source.rglob('*'));assert not any(path.is_symlink() for path in paths)
files=[path for path in paths if path.is_file()];manifest={}
for ordinal,path in enumerate(files):
 relative=path.relative_to(source).as_posix();metadata=path.stat();digest=checksum(path)
 assert path.stat().st_size==metadata.st_size
 manifest[relative]={'bytes':metadata.st_size,'sha256':digest}
 if ordinal%1000==0:print(json.dumps({'stage':'source-hashes','files':ordinal,'total':len(files)}),flush=True)
save_json('raw-files.json',manifest)
profiles=[];cells=[];memory=[];total_durations=0
for label in ['node-22','node-24']:
 index=json.loads((source/label/'index.json').read_bytes());assert index['complete'] is True and index['accepted'] is False and len(index['runs'])==1024
 assert all(entry['exitCode']==0 and entry['signal'] is None and entry['error'] is None for entry in index['runs'])
 tracked=collections.Counter();durations=0;memory_endpoints=[]
 for entry in index['runs']:
  worker=json.loads((source/label/entry['report']).read_bytes());assert worker['complete'] is True
  for batch in worker['batches']:
   assert batch['complete'] is True and len(batch['samplesMs'])==9
   assert all(sample>0 for sample in batch['samplesMs'])
   durations+=len(batch['samplesMs']);tracked.update(batch['trackedOwners'])
   trace=batch['cleanupTrace'];assert len(trace)>=2 and all(point['clear'] and point['survivors']=={'window':0,'document':0} for point in trace[-2:])
   memory_endpoints.append({'report':label+'/'+entry['report'],'trackedOwners':batch['trackedOwners'],'finalMemory':trace[-1]['memory'],'finalSurvivors':trace[-1]['survivors'],'clearEndpoints':2})
 assert durations==9216 and tracked=={'window':12288,'document':12288}
 for phase,rows in index['summaries'].items():
  assert len(rows)==8
  for row in rows:
   control_failed=abs(row['jsdomControlChangePercent'])>index['settings']['controlBudgetPercent']
   rust_failed=(abs(row['rustdomChangePercent']) if phase=='AA' else row['rustdomChangePercent'])>index['settings']['rustBudgetPercent']
   cells.append({'node':index['node'],'phase':phase,'key':row['key'],'jsdomControlChangePercent':row['jsdomControlChangePercent'],'rustdomChangePercent':row['rustdomChangePercent'],'jsdomControlViolation':control_failed,'rustNumericViolation':rust_failed,'calibrated':row['calibrated'],'withinBudget':row['withinBudget'],'A':row['A'],'B':row['B'],'outputHash':row['outputHash']})
 profiles.append({'label':label,'node':index['node'],'workers':len(index['runs']),'allWorkersExitZero':True,'measuredDurations':durations,'trackedOwners':dict(tracked),'harnessSha256':index['harness']['sha256'],'controlBudgetPercent':index['settings']['controlBudgetPercent'],'rustBudgetPercent':index['settings']['rustBudgetPercent'],'accepted':False})
 memory.append({'node':index['node'],'trackedOwners':dict(tracked),'workers':len(index['runs']),'endpoints':memory_endpoints});total_durations+=durations
 shutil.copyfile(source/label/'index.json',output/(label+'-index.json'))
assert total_durations==18432
assert sum(cell['jsdomControlViolation'] for cell in cells)==13 and sum(cell['rustNumericViolation'] for cell in cells)==1
summary={'verified':True,'backgroundAffinityVerified':True,'accepted':False,'profiles':profiles,'cells':cells,'measuredDurations':total_durations,'workers':2048,'jsdomControlViolations':13,'rustNumericViolations':1,'note':'La fila Rust numéricamente excedida también falla su control; no permite atribución causal. No se modificó el estimador o los presupuestos.'}
save_json('summary.json',summary);save_json('memory-endpoints.json',{'profiles':memory,'totalWindows':24576,'totalDocuments':24576,'warmupOwnersPerKind':6144,'measuredOwnersPerKind':18432,'scope':'Observaciones finitas de12Window/Document porworker; últimos dos endpoints claros. No demuestra ausencia universal de fugas ni memoria pico.'})
for name in ['execution.json','verification.json','verification.process.json','verification.stderr.log','node-22.stdout.log','node-22.stderr.log','node-24.stdout.log','node-24.stderr.log','publication.json','provenance.json','study-driver.py']:shutil.copyfile(source/name,output/name)
shutil.copyfile(__file__,output/'archive-producer.py')
print(json.dumps({'stage':'compressing','files':len(files),'rawBytes':sum(entry['bytes'] for entry in manifest.values())}),flush=True)
with archive.open('xb') as stream:
 with gzip.GzipFile(fileobj=stream,mode='wb',filename='',mtime=0) as compressed:
  with tarfile.open(fileobj=compressed,mode='w|',format=tarfile.PAX_FORMAT) as target:
   for ordinal,path in enumerate(files):
    name='background-affinity/'+path.relative_to(source).as_posix();info=target.gettarinfo(str(path),arcname=name);assert info.isfile()
    with path.open('rb') as original:target.addfile(info,original)
    if ordinal%2000==0:print(json.dumps({'stage':'compressing','files':ordinal,'total':len(files)}),flush=True)
print(json.dumps({'stage':'archive-readback','archiveBytes':archive.stat().st_size}),flush=True)
seen=set()
with tarfile.open(archive,mode='r|gz') as packed:
 for member in packed:
  assert member.isfile() and member.name.startswith('background-affinity/')
  name=member.name.removeprefix('background-affinity/');assert name in manifest and name not in seen;seen.add(name)
  digest=hashlib.sha256();size=0;original=packed.extractfile(member)
  for block in iter(lambda:original.read(8*1024*1024),b''):digest.update(block);size+=len(block)
  assert size==manifest[name]['bytes'] and digest.hexdigest()==manifest[name]['sha256'],name
assert seen==set(manifest)
archive_checksum=checksum(archive);parts=[]
with archive.open('rb') as stream:
 ordinal=0
 while True:
  block=stream.read(32*1024*1024)
  if not block:break
  ordinal+=1;name=f'archive.part-{ordinal:03d}';path=output/name
  with path.open('xb') as part:part.write(block)
  assert checksum(path)==hashlib.sha256(block).hexdigest();parts.append({'path':name,'bytes':len(block),'sha256':hashlib.sha256(block).hexdigest()})
readback=hashlib.sha256()
for part in parts:
 with (output/part['path']).open('rb') as stream:
  for block in iter(lambda:stream.read(8*1024*1024),b''):readback.update(block)
assert readback.hexdigest()==archive_checksum
save_json('archive-parts.json',{'format':'tar.gz','prefix':'background-affinity/','archiveSha256':archive_checksum,'archiveBytes':archive.stat().st_size,'parts':parts})
receipt={'complete':True,'kind':'complete-original-study-archive','source':str(source),'method':'background-affinity-study-v1','publishedBeforeExecution':'5e6ac005036922bd9965849c84b3876bfa92a8fd','verified':True,'accepted':False,'backgroundAffinityVerified':True,'regularFiles':len(files),'rawBytes':sum(entry['bytes'] for entry in manifest.values()),'archiveSha256':archive_checksum,'archiveBytes':archive.stat().st_size,'allMembersReadbackVerified':True,'allPartsReadbackVerified':True,'rawManifestSha256':checksum(output/'raw-files.json'),'producerSha256':checksum(output/'archive-producer.py'),'workers':2048,'allWorkersExitZero':True,'measuredDurations':18432,'jsdomControlViolations':13,'rustNumericViolations':1,'observedWindows':24576,'observedDocuments':24576,'noMeasurementRepeated':True,'finishedAt':time.time()}
save_json('receipt.json',receipt)
extra=[{'path':path.relative_to(output).as_posix(),'bytes':path.stat().st_size,'sha256':checksum(path)} for path in sorted(output.rglob('*')) if path.is_file()];save_json('files.json',extra)
status.update({'complete':True,'receipt':receipt});marker.write_text(json.dumps(status,indent=2)+'\n')
print(json.dumps({'complete':True,'output':str(output),'archiveSha256':archive_checksum,'archiveBytes':archive.stat().st_size,'parts':len(parts),'sourceFiles':len(files),'jsdomControlViolations':13,'rustNumericViolations':1,'accepted':False}),flush=True)