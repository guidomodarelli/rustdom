"""Collect the one authorized run without launching or repeating any process."""
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import zipfile

if sys.flags.optimize:
    raise RuntimeError('JSDOM telemetry collection requires non-optimized Python')

repository = Path(__file__).resolve().parents[1]
run_id = 39959175058
head = '22aeb0ba709f9a2959f4fe482b043f43d59794ad'
root = repository / '.cache/jsdom-telemetry-original-39959175058'
root.mkdir(exist_ok=True)
def metadata(endpoint, name):
    data = subprocess.check_output(['gh', 'api', endpoint], cwd=repository)
    (root / name).write_bytes(data)
    return json.loads(data)
run = metadata(f'repos/guidomodarelli/rustdom/actions/runs/{run_id}', 'run.json')
jobs = metadata(f'repos/guidomodarelli/rustdom/actions/runs/{run_id}/jobs', 'jobs.json')
assert run['head_sha'] == head and run['run_attempt'] == 1
assert run['path'] == '.github/workflows/ownership-jsdom-telemetry.yml'
assert len(jobs['jobs']) == 1
job = jobs['jobs'][0]
assert job['id'] == 120432514538
state = {'runId': run_id, 'jobId': job['id'], 'head': head, 'status': run['status'],
    'conclusion': run['conclusion'], 'repeated': False, 'accepted': None,
    'steps': [{key: step[key] for key in ['name', 'status', 'conclusion']} for step in job['steps']]}
watch = Path('C:/Users/guido/ghq/projects/rustdom/.codex-autofix/watch-80.json')
tracking = json.loads(watch.read_text(encoding='utf8'))
tracking['currentJsdomTelemetry'].update(state)
tracking.update(ciHasLiveJobs=True, ciRunId=39959045894)
watch.write_text(json.dumps(tracking, indent=2, ensure_ascii=False) + '\n', encoding='utf8')
if '--collect' not in sys.argv or run['status'] != 'completed':
    print(json.dumps(state)); raise SystemExit(0)
assert job['status'] == 'completed'
artifacts = metadata(f'repos/guidomodarelli/rustdom/actions/runs/{run_id}/artifacts', 'artifacts.json')
matching = [artifact for artifact in artifacts['artifacts'] if artifact['name'] == 'jsdom-telemetry-' + head]
assert len(matching) == 1 and not matching[0]['expired']
artifact = matching[0]
assert artifact['workflow_run']['id'] == run_id
assert artifact['workflow_run']['head_sha'] == head
filename = root / 'artifact.zip'
if not filename.exists():
    partial = root / 'artifact.zip.part'
    with partial.open('wb') as output:
        subprocess.run(['gh', 'api', f'repos/guidomodarelli/rustdom/actions/artifacts/{artifact["id"]}/zip'], stdout=output, check=True)
    data = partial.read_bytes()
    assert len(data) == artifact['size_in_bytes']
    assert 'sha256:' + hashlib.sha256(data).hexdigest() == artifact['digest']
    partial.replace(filename)
data = filename.read_bytes()
assert len(data) == artifact['size_in_bytes']
assert 'sha256:' + hashlib.sha256(data).hexdigest() == artifact['digest']
with zipfile.ZipFile(filename) as archive:
    assert archive.testzip() is None
    assert archive.namelist() == ['jsdom-telemetry-results.tar.xz']
    tar = archive.read(archive.namelist()[0])
    (root / archive.namelist()[0]).write_bytes(tar)
with (root / 'job.log').open('wb') as output:
    subprocess.run(['gh', 'run', 'view', str(run_id), '--job', str(job['id']), '--log'], stdout=output, check=True)
state.update(artifactId=artifact['id'], zipBytes=len(data), zipSha256=hashlib.sha256(data).hexdigest(),
    tarBytes=len(tar), tarSha256=hashlib.sha256(tar).hexdigest(), transportAuthenticated=True)
(root / 'collection.json').write_text(json.dumps(state, indent=2) + '\n')
print(json.dumps(state))
