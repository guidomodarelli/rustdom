"""Collect the one completed core-contract CI attempt, authenticate all bytes and read outcomes without running artifacts."""
import hashlib,json,subprocess,zipfile
from pathlib import Path
repo=Path.cwd();out=repo/'.cache/combined-worker-contract-ci-d149';run_id=int((out/'run-id.txt').read_text(encoding='utf-8'));assert run_id==40176086547
def api(path):return subprocess.check_output(['gh','api','repos/guidomodarelli/rustdom/'+path])
def sha(raw):return hashlib.sha256(raw).hexdigest()
run=json.loads((out/'run.json').read_bytes());assert run['status']=='completed' and run['run_attempt']==1 and run['head_sha']=='d14941173bf80e354b0935f4a79cea2edcfa1dca'
raw=api('actions/runs/'+str(run_id)+'/artifacts?per_page=100');artifacts=json.loads(raw);assert artifacts['total_count']==2 and len(artifacts['artifacts'])==2;(out/'artifacts.json').write_bytes(raw)
runtime_hashes=json.loads((repo/'reports/benchmarks/native-class-ownership/constants/current-ownership.json').read_bytes())['runtimeExecutableHashes'];results=[]
for metadata in artifacts['artifacts']:
 assert metadata['workflow_run']['id']==run_id and metadata['workflow_run']['head_sha']==run['head_sha'] and not metadata['expired']
 assert metadata['name'].startswith('combined-process-contracts-') and metadata['name'].endswith('-'+run['head_sha'])
 directory=out/('artifact-'+str(metadata['id']));directory.mkdir(exist_ok=True)
 archive=directory/'artifact.zip'
 if not archive.exists():
  raw=api('actions/artifacts/'+str(metadata['id'])+'/zip');assert len(raw)==metadata['size_in_bytes'] and 'sha256:'+sha(raw)==metadata['digest'];archive.write_bytes(raw)
 raw=archive.read_bytes();assert len(raw)==metadata['size_in_bytes'] and 'sha256:'+sha(raw)==metadata['digest']
 (directory/'metadata.json').write_text(json.dumps(metadata,indent=2)+'\n',encoding='utf-8',newline='\n')
 with zipfile.ZipFile(archive) as zipped:
  assert zipped.testzip() is None
  members=[{'name':member.filename,'bytes':member.file_size,'sha256':sha(zipped.read(member))} for member in zipped.infolist()]
  by_basename={Path(member.filename).name:member.filename for member in zipped.infolist()};assert len(by_basename)==len(members)
  def read(name):return zipped.read(by_basename[name])
  assert read('tests.exit-code').strip()==b'0'
  tests=read('tests.stdout.log').decode('utf-8');assert ('# tests 17' in tests and '# pass 17' in tests) or ('ℹ tests 17' in tests and 'ℹ pass 17' in tests)
  sdk=json.loads(read('runtime.json'));assert sdk['sha256']==runtime_hashes[sdk['node']]
  checkout=json.loads(read('checkout.stdout.log'));assert checkout['sourceCommit']==run['head_sha'] and checkout['verifiedFiles']==688 and checkout['historicalPins']==599 and not checkout['samplerInvoked']
  extraction=json.loads(read('extraction.stdout.log'));assert extraction['archiveSha256']=='5b67fcc681e15edab795635b7038f3e51620ea9f261f85d569d228202508cb72' and extraction['members']==7824 and not extraction['runtimeExecuted']
 (directory/'members.json').write_text(json.dumps(members,indent=2)+'\n',encoding='utf-8',newline='\n')
 results.append({'artifactId':metadata['id'],'name':metadata['name'],'bytes':metadata['size_in_bytes'],'sha256':sha(raw),'node':sdk['node'],'runtimeSha256':sdk['sha256'],'tests':17,'pass':True,'members':len(members)})
logs=out/'run-logs.zip'
if not logs.exists():logs.write_bytes(api('actions/runs/'+str(run_id)+'/attempts/1/logs'))
with zipfile.ZipFile(logs) as archive:
 assert archive.testzip() is None
 members=[{'name':member.filename,'bytes':member.file_size,'sha256':sha(archive.read(member))} for member in archive.infolist()]
(out/'run-logs.json').write_text(json.dumps({'bytes':logs.stat().st_size,'sha256':sha(logs.read_bytes()),'members':members},indent=2)+'\n',encoding='utf-8',newline='\n')
receipt={'run':run_id,'attempt':1,'head':run['head_sha'],'conclusion':run['conclusion'],'results':results,'collectorExecutedDOM':False,'measurementProcesses':0,'invalidManifestContractProcessesPerNode':1,'archivedCodeExecuted':False,'performanceAccepted':None,'gateReevaluated':False,'executionReady':False}
(out/'collection.json').write_text(json.dumps(receipt,indent=2)+'\n',encoding='utf-8',newline='\n');print(json.dumps(receipt))
