"""Authenticate the completed rejected gate without running DOM or any recorded executable."""
from pathlib import Path, PurePosixPath
from datetime import datetime
import hashlib
import json
import stat
import subprocess
import sys
import zipfile

if sys.flags.optimize:
    raise RuntimeError('Ownership gate collection requires non-optimized Python')

repository = Path(__file__).resolve().parent.parent
output = repository/'.cache/ownership-ci-failure-40395416797'
output.mkdir(exist_ok=False)
head = '4196c496187c88c92304516287a7e644659a8536'
run_id = 40395416797
def api(endpoint,name):
    raw = subprocess.check_output(['gh','api','repos/guidomodarelli/rustdom/'+endpoint],cwd=repository,timeout=120)
    (output/name).write_bytes(raw)
    return json.loads(raw)
def stamp(value): return datetime.fromisoformat(value.replace('Z','+00:00'))
run = api(f'actions/runs/{run_id}/attempts/1','run.json')
assert run['head_sha'] == head and run['run_attempt'] == 1 and run['status'] == 'completed' and run['conclusion'] == 'failure'
assert run['path'] == '.github/workflows/native-class-ownership.yml'
jobs = api(f'actions/runs/{run_id}/attempts/1/jobs?per_page=100','jobs.json')
listing = api(f'actions/runs/{run_id}/artifacts?per_page=100','artifacts.json')
assert jobs['total_count'] == len(jobs['jobs']) == 2
assert listing['total_count'] == len(listing['artifacts']) == 2
for job in jobs['jobs']:
    assert job['head_sha'] == head and job['run_attempt'] == 1 and job['conclusion'] == 'failure'
    failed = [step['name'] for step in job['steps'] if step['conclusion'] == 'failure']
    assert failed == ['Recalcular la captura actual completa y exigir el presupuesto original']
    raw = subprocess.check_output(['gh','api',f'repos/guidomodarelli/rustdom/actions/jobs/{job["id"]}/logs'],timeout=120)
    (output/(str(job['id'])+'.log')).write_bytes(raw)
records = []
decisions = []
seen = set()
for artifact in listing['artifacts']:
    assert artifact['workflow_run']['id'] == run_id and artifact['workflow_run']['head_sha'] == head
    assert not artifact['expired'] and 0 < artifact['size_in_bytes'] < 2*1024**2
    major = next((major for major in [22,24] if artifact['name']==f'native-class-ownership-evidence-node{major}-{head}'),None)
    assert major is not None and major not in seen
    seen.add(major)
    job = next(job for job in jobs['jobs'] if job['name']==f'Native class ownership Node {major}')
    assert stamp(job['started_at']) <= stamp(artifact['created_at']) <= stamp(job['completed_at'])
    metadata = api(f'actions/artifacts/{artifact["id"]}',str(artifact['id'])+'-metadata.json')
    assert metadata == artifact
    archive_path = output/(str(artifact['id'])+'.zip')
    with archive_path.open('xb') as writer:
        subprocess.run(['gh','api',f'repos/guidomodarelli/rustdom/actions/artifacts/{artifact["id"]}/zip'],stdout=writer,check=True,timeout=120)
    checksum = hashlib.sha256(archive_path.read_bytes()).hexdigest()
    assert archive_path.stat().st_size == artifact['size_in_bytes'] and artifact['digest'] == 'sha256:'+checksum
    inventory = []
    found_decision = False
    with zipfile.ZipFile(archive_path) as archive:
        members = archive.infolist()
        assert len(members) < 1000 and len({member.filename for member in members}) == len(members)
        assert sum(member.file_size for member in members) < 32*1024**2
        for member in members:
            path = PurePosixPath(member.filename)
            assert not path.is_absolute() and '..' not in path.parts and '\\' not in member.filename
            assert not stat.S_ISLNK(member.external_attr >> 16) and member.file_size < 16*1024**2
            if member.is_dir(): continue
            raw = archive.read(member)
            inventory.append({'path':member.filename,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()})
            if member.filename == 'ownership-verification.json':
                found_decision = True
                (output/(str(artifact['id'])+'-decision.json')).write_bytes(raw)
                decision = json.loads(raw)
                assert decision['verified'] is True and decision['accepted'] is False and decision['measurementExecuted'] is False
                decisions.append(decision)
    assert found_decision
    records.append({'artifactId':artifact['id'],'readerNodeMajor':major,'jobId':job['id'],
        'bytes':archive_path.stat().st_size,'sha256':checksum,'members':inventory})
assert seen == {22,24} and decisions[0]['results'] == decisions[1]['results']
rows = []
for result in decisions[0]['results']:
    for phase, entries in result['summaries'].items():
        for entry in entries:
            rows.append({'node':result['node'],'phase':phase,'key':entry['key'],
                'calibrated':entry['calibrated'],'withinBudget':entry['withinBudget'],
                'rustdomChangePercent':entry['rustdomChangePercent'],
                'jsdomControlChangePercent':entry['jsdomControlChangePercent']})
assert len(rows) == 32
analysis = {'ciRunId':run_id,'attempt':1,'sourceCommit':head,'historicalMeasurementRunId':39921160254,
    'verified':True,'accepted':False,'measurementExecuted':False,'readerResultsIdenticalAcrossNode22And24':True,
    'rows':rows,'uncalibratedRows':sum(not row['calibrated'] for row in rows),
    'notWithinBudgetRows':sum(not row['withinBudget'] for row in rows),
    'budgetsChanged':False,'historicalRejectionPreserved':True,
    'scope':'Replay del gate histórico. Lectores duplicados no son réplicas nuevas; la falta de calibración no prueba una regresión real.'}
(output/'analysis.json').write_bytes(json.dumps(analysis,indent=2,ensure_ascii=False).encode()+b'\n')
(output/'receipt.json').write_bytes(json.dumps({'runId':run_id,'attempt':1,'sourceCommit':head,
    'artifacts':records,'gateRejected':True,'newMeasurementExecuted':False,'performanceAccepted':False},indent=2).encode()+b'\n')
print(json.dumps({'runId':run_id,'authenticatedArtifacts':len(records),'rows':len(rows),
    'uncalibratedRows':analysis['uncalibratedRows'],'notWithinBudgetRows':analysis['notWithinBudgetRows'],
    'measurementExecuted':False}),flush=True)
