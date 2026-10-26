"""Preserve every original artifact and terminal job log from the consumed pilot attempt. No DOM or archived-code execution."""
from pathlib import Path,PurePosixPath
from datetime import datetime,timezone
import hashlib
import json
import stat
import subprocess
import sys
import zipfile
repository=Path(__file__).resolve().parent.parent
root=repository/'.cache/pilot-study-40366685759/collection'
resume=sys.argv[1:]==['--resume'];assert not sys.argv[1:] or resume
root.mkdir(parents=True,exist_ok=resume)
prefix='repos/guidomodarelli/rustdom/'
run_id=40366685759;head='1078e4fd190276a116e6dc5e64c9fe32eca3e7e9'
def digest(file):
    checksum=hashlib.sha256()
    with file.open('rb') as stream:
        for chunk in iter(lambda:stream.read(1048576),b''):checksum.update(chunk)
    return checksum.hexdigest()
def retain(file,raw):
    if not file.exists():
        with file.open('xb') as stream:stream.write(raw)
    elif file.read_bytes()!=raw:
        observer=file.with_name(file.name+'.observed-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ'))
        with observer.open('xb') as stream:stream.write(raw)
def api(endpoint,name):
    raw=subprocess.check_output(['gh','api',prefix+endpoint],timeout=120)
    retain(root/name,raw);return json.loads(raw)
def timestamp(value):return datetime.fromisoformat(value.replace('Z','+00:00'))
run=api(f'actions/runs/{run_id}/attempts/1','run.json')
jobs=api(f'actions/runs/{run_id}/attempts/1/jobs?per_page=100','jobs.json')
artifacts=api(f'actions/runs/{run_id}/artifacts?per_page=100','artifacts.json')
assert run['head_sha']==head and run['run_attempt']==1 and run['status']=='completed' and run['conclusion']=='failure'
assert jobs['total_count']==len(jobs['jobs'])==33 and artifacts['total_count']==len(artifacts['artifacts'])==33
catalog=repository/'reports/benchmarks/native-class-ownership/control-precision/pilot/capture/files.json'
assert digest(catalog)=='1a4f142ccc27ed834da69ae923454cd7ccc18bea1cb5b8e3103a5293100d2b62'
criteria=json.loads(catalog.read_bytes())['criteria'];assert len(criteria)==32
expected={f'jsdom-pilot-consumption-{head}-{run_id}-attempt1':('preflight',None)}
for criterion in criteria:
    ordinal=criterion['ordinal']
    expected[f'jsdom-pilot-criterion-{ordinal}-{head}-{run_id}-attempt1']=(f'Criterio {ordinal} Node '+criterion['node'][1:],ordinal)
assert {artifact['name'] for artifact in artifacts['artifacts']}==set(expected)
for job in jobs['jobs']:
    assert job['head_sha']==head and job['run_attempt']==1 and job['status']=='completed'
    file=root/(str(job['id'])+'.log')
    if not file.exists():retain(file,subprocess.check_output(['gh','api',prefix+f'actions/jobs/{job["id"]}/logs'],timeout=120))
records=[]
ordered=sorted(artifacts['artifacts'],key=lambda artifact:-1 if expected[artifact['name']][1] is None else expected[artifact['name']][1])
for artifact in ordered:
    job_name,ordinal=expected[artifact['name']]
    matching=[job for job in jobs['jobs'] if job['name']==job_name];assert len(matching)==1
    job=matching[0]
    assert artifact['workflow_run']['id']==run_id and artifact['workflow_run']['head_sha']==head and not artifact['expired']
    assert 0<artifact['size_in_bytes']<=536870912
    assert timestamp(job['started_at'])<=timestamp(artifact['created_at'])<=timestamp(job['completed_at'])
    metadata=api(f'actions/artifacts/{artifact["id"]}',str(artifact['id'])+'-metadata.json');assert metadata==artifact
    archive_path=root/(str(artifact['id'])+'.zip')
    if archive_path.exists() and (archive_path.stat().st_size!=artifact['size_in_bytes'] or artifact['digest']!='sha256:'+digest(archive_path)):
        assert archive_path.resolve().is_relative_to(root.resolve()) and not archive_path.is_symlink()
        partial=archive_path.with_name(archive_path.name+'.transport-partial-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ'))
        archive_path.rename(partial)
    if not archive_path.exists():
        with archive_path.open('xb') as stdout,(root/(str(artifact['id'])+'-download.stderr.log')).open('ab') as stderr:
            subprocess.run(['gh','api',prefix+f'actions/artifacts/{artifact["id"]}/zip'],stdout=stdout,stderr=stderr,check=True,timeout=240)
    checksum=digest(archive_path)
    assert archive_path.stat().st_size==artifact['size_in_bytes'] and artifact['digest']=='sha256:'+checksum
    inventory=[];small=root/('artifact-'+str(artifact['id']));small.mkdir(exist_ok=True)
    with zipfile.ZipFile(archive_path) as archive:
        members=archive.infolist();assert len(members)<=1000
        assert len({member.filename for member in members})==len(members)
        assert sum(member.file_size for member in members)<=1073741824
        for member in members:
            path=PurePosixPath(member.filename)
            assert not path.is_absolute() and '..' not in path.parts and '\\' not in member.filename
            assert not stat.S_ISLNK(member.external_attr>>16) and not member.flag_bits&1
            if member.is_dir():continue
            assert member.file_size<=536870912
            with archive.open(member) as stream:member_sha=hashlib.file_digest(stream,'sha256').hexdigest()
            inventory.append({'path':member.filename,'bytes':member.file_size,'crc32':member.CRC,'sha256':member_sha})
            if member.filename in ['capture-consumption.json','capture.stderr.log','capture.stdout.log','supervisor.json',
                                   'replay.json','archive.json','expected.json','receipt-sha.txt','once.stderr.log','checkout.json']:
                assert member.file_size<=16777216
                retain(small/member.filename,archive.read(member))
    record={'artifactId':artifact['id'],'name':artifact['name'],'ordinal':ordinal,'jobId':job['id'],
            'jobConclusion':job['conclusion'],'bytes':archive_path.stat().st_size,'sha256':checksum,'members':inventory}
    records.append(record)
    retain(root/(str(artifact['id'])+'-members.json'),json.dumps(inventory,indent=2).encode()+b'\n')
    progress={'runId':run_id,'attempt':1,'headCommit':head,'collectedArtifacts':len(records),'expectedArtifacts':33,
              'records':records,'complete':len(records)==33,'DOMExecutedByCollector':False,'workflowRelaunched':False}
    pending=root/'collection-progress.next.json';pending.write_bytes(json.dumps(progress,indent=2).encode()+b'\n')
    pending.replace(root/'collection-progress.json')
    print(json.dumps({'artifactId':artifact['id'],'ordinal':ordinal,'bytes':artifact['size_in_bytes'],'authenticated':True}),flush=True)
receipt={'runId':run_id,'attempt':1,'sourceCommit':head,'conclusion':'failure','terminalJobs':33,
    'failedJobs':sum(job['conclusion']=='failure' for job in jobs['jobs']),'originalArtifactsAuthenticated':33,
    'originalZipBytes':sum(record['bytes'] for record in records),'artifacts':records,
    'allLogsPreserved':True,'DOMExecutedByCollector':False,'archivedCodeExecuted':False,
    'workflowRelaunched':False,'methodConsumed':True,'performanceAccepted':None,'gateReevaluated':False}
retain(root/'receipt.json',json.dumps(receipt,indent=2).encode()+b'\n')
print(json.dumps({key:value for key,value in receipt.items() if key!='artifacts'}),flush=True)
