"""Preserve real ordinary CI artifacts and completed job logs without executing archives or changing the ownership study."""
import datetime
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys
import zipfile

if sys.flags.optimize:
    raise RuntimeError('Ordinary CI collection requires non-optimized Python')
repository = Path.cwd(); run_id = 40191262985; head = 'd265390ec77390fc055178f0c29093329debf860'
output = repository / '.cache/general-CI-40191262985'
owner = {'runId': run_id, 'head': head, 'attempt': 1, 'purpose': 'ordinary-ci-evidence-not-scientific-acceptance'}
assert not output.is_symlink()
if output.exists():
    assert json.loads((output / 'owner.json').read_bytes()) == owner
else:
    output.mkdir(); (output / 'owner.json').write_text(json.dumps(owner, indent=2) + '\n', encoding='utf-8', newline='\n')
stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
history = output / 'observations' / stamp; history.mkdir(parents=True)

def api(endpoint):
    return subprocess.check_output(['gh', 'api', 'repos/guidomodarelli/rustdom/' + endpoint])

def digest(filename):
    checksum = hashlib.sha256()
    with filename.open('rb') as source:
        for chunk in iter(lambda: source.read(1048576), b''):
            checksum.update(chunk)
    return checksum.hexdigest()

def metadata(name, endpoint):
    raw = api(endpoint); filename = output / name
    assert not filename.is_symlink() and (not filename.exists() or filename.stat().st_nlink == 1)
    filename.write_bytes(raw); (history / name).write_bytes(raw)
    return json.loads(raw)

def download(endpoint, filename):
    assert not filename.is_symlink()
    if filename.exists():
        assert filename.is_file() and filename.stat().st_nlink == 1
        return
    partial = filename.with_name(filename.name + '.part'); assert not partial.is_symlink()
    if partial.exists():
        retained = output / 'partials'; retained.mkdir(exist_ok=True)
        target = retained / (stamp + '-' + str(filename.parent.name) + '-' + partial.name)
        assert not target.exists(); partial.rename(target)
    with partial.open('xb') as stream:
        result = subprocess.run(['gh', 'api', 'repos/guidomodarelli/rustdom/' + endpoint], stdout=stream, stderr=subprocess.PIPE)
    if result.returncode != 0:
        error_file = partial.with_name(partial.name + '.stderr.log'); assert not error_file.exists()
        error_file.write_bytes(result.stderr)
        raise RuntimeError('Ordinary CI transport failed; exact partial bytes and stderr preserved: ' + str(partial))
    partial.rename(filename)

run = metadata('run.json', f'actions/runs/{run_id}')
jobs = metadata('jobs.json', f'actions/runs/{run_id}/attempts/1/jobs?per_page=100')['jobs']
assert run['id'] == run_id and run['head_sha'] == head and run['run_attempt'] == 1
assert run['path'] == '.github/workflows/ci.yml' and run['event'] == 'pull_request'
assert len(jobs) < 100 and all(job['run_id'] == run_id and job['head_sha'] == head and job['run_attempt'] == 1 for job in jobs)
artifacts = metadata('artifacts.json', f'actions/runs/{run_id}/artifacts?per_page=100')
assert artifacts['total_count'] == len(artifacts['artifacts']) < 100
saved = []
for artifact in artifacts['artifacts']:
    assert artifact['workflow_run']['id'] == run_id and artifact['workflow_run']['head_sha'] == head and not artifact['expired']
    assert artifact['name'].startswith(('benchmark-linux-', 'validation-', 'package-'))
    directory = output / ('artifact-' + str(artifact['id'])); directory.mkdir(exist_ok=True)
    filename = directory / 'artifact.zip'; download('actions/artifacts/' + str(artifact['id']) + '/zip', filename)
    assert filename.stat().st_size == artifact['size_in_bytes'] and 'sha256:' + digest(filename) == artifact['digest']
    (directory / 'metadata.json').write_text(json.dumps(artifact, indent=2) + '\n', encoding='utf-8', newline='\n')
    members = []
    with zipfile.ZipFile(filename) as archive:
        assert len(archive.namelist()) == len(set(archive.namelist()))
        for member in archive.infolist():
            checksum = hashlib.sha256()
            with archive.open(member) as source:
                for chunk in iter(lambda: source.read(1048576), b''):
                    checksum.update(chunk)
            members.append({'name': member.filename, 'bytes': member.file_size, 'sha256': checksum.hexdigest()})
    (directory / 'members.json').write_text(json.dumps(members, indent=2) + '\n', encoding='utf-8', newline='\n')
    saved.append({'id': artifact['id'], 'name': artifact['name'], 'bytes': filename.stat().st_size, 'sha256': digest(filename), 'members': len(members)})
job_logs = []
for job in jobs:
    if job['status'] == 'completed':
        filename = output / ('job-' + str(job['id']) + '.log')
        download('actions/jobs/' + str(job['id']) + '/logs', filename)
        job_logs.append({'id': job['id'], 'name': job['name'], 'conclusion': job['conclusion'], 'bytes': filename.stat().st_size, 'sha256': digest(filename)})
run_logs = None
if run['status'] == 'completed':
    filename = output / 'run-logs.zip'; download(f'actions/runs/{run_id}/attempts/1/logs', filename)
    with zipfile.ZipFile(filename) as archive:
        members = []
        for member in archive.infolist():
            checksum = hashlib.sha256()
            with archive.open(member) as source:
                for chunk in iter(lambda: source.read(1048576), b''):
                    checksum.update(chunk)
            members.append({'name': member.filename, 'bytes': member.file_size, 'sha256': checksum.hexdigest()})
    run_logs = {'bytes': filename.stat().st_size, 'sha256': digest(filename), 'members': members}
    (output / 'run-logs.json').write_text(json.dumps(run_logs, indent=2) + '\n', encoding='utf-8', newline='\n')
receipt = {'runId': run_id, 'head': head, 'attempt': 1, 'status': run['status'], 'conclusion': run['conclusion'],
    'artifacts': saved, 'jobLogs': job_logs, 'runLogs': run_logs, 'jobs': [{key: job[key] for key in ['id', 'name', 'status', 'conclusion']} for job in jobs],
    'APIHeadIsNotNormalizedBenchmarkSourceCommit': True, 'savedSourcesAndRuntimeIdentitiesRemainOriginal': True,
    'collectorExecutedDOM': False, 'archivedCodeExecuted': False, 'scientificRunModified': False,
    'performanceAccepted': None, 'gateReevaluated': False, 'observedAtUTC': stamp, 'workflowRelaunched': False}
(output / 'collection.json').write_text(json.dumps(receipt, indent=2) + '\n', encoding='utf-8', newline='\n')
print(json.dumps(receipt))
