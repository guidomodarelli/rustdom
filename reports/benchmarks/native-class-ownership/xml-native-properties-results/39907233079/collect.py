import hashlib
import json
from pathlib import Path
import subprocess
import sys
import zipfile

repository = Path(r'C:\Users\guido\.codex\worktrees\native-class-ownership\rustdom')
run_id = 39907233079
expected_head = 'a5a1379d2d59827f557c44b94e7660db43619b04'
endpoint = 'repos/guidomodarelli/rustdom/actions'

def github(path):
    return subprocess.check_output(['gh', 'api', path], cwd=repository)

run_bytes = github(f'{endpoint}/runs/{run_id}')
run = json.loads(run_bytes)
assert run['head_sha'] == expected_head
if run['status'] != 'completed':
    print(json.dumps({'runId': run_id, 'status': run['status'], 'terminal': False, 'measurementRestarted': False}))
    sys.exit(3)
target = repository / f'.cache/xml-native-properties-original-{run_id}'
target.mkdir(exist_ok=True)
(target / 'run.json').write_bytes(run_bytes)
artifacts_bytes = github(f'{endpoint}/runs/{run_id}/artifacts')
artifacts = json.loads(artifacts_bytes)
(target / 'artifacts.json').write_bytes(artifacts_bytes)
matches = [entry for entry in artifacts['artifacts'] if entry['name'] == f'xml-native-properties-{expected_head}']
assert len(matches) == 1 and not matches[0]['expired'], 'Original XML artifact is missing or expired; do not restart the study'
artifact = matches[0]
zip_path = target / 'artifact.zip'
if not zip_path.exists():
    payload = github(f"{endpoint}/artifacts/{artifact['id']}/zip")
    zip_path.write_bytes(payload)
checksum = hashlib.sha256(zip_path.read_bytes()).hexdigest()
assert artifact['digest'] == 'sha256:' + checksum
with zipfile.ZipFile(zip_path) as bundle:
    assert bundle.testzip() is None
    entries = [entry for entry in bundle.infolist() if not entry.is_dir()]
    assert len(entries) == 1 and entries[0].filename == 'xml-full-inputs.tar.xz'
    tar_path = target / 'xml-full-inputs.tar.xz'
    payload = bundle.read(entries[0])
    tar_path.write_bytes(payload)
jobs_bytes = github(f'{endpoint}/runs/{run_id}/jobs')
(target / 'jobs.json').write_bytes(jobs_bytes)
for job in json.loads(jobs_bytes)['jobs']:
    (target / f"job-{job['id']}.log").write_bytes(github(f"{endpoint}/jobs/{job['id']}/logs"))
receipt = {'runId': run_id, 'head': expected_head, 'terminal': True, 'conclusion': run['conclusion'],
    'artifactId': artifact['id'], 'zipSha256': checksum, 'zipBytes': zip_path.stat().st_size,
    'tarSha256': hashlib.sha256(tar_path.read_bytes()).hexdigest(), 'tarBytes': tar_path.stat().st_size,
    'measurementRestarted': False}
(target / 'collection.json').write_text(json.dumps(receipt, indent=2) + '\n', encoding='utf8')
print(json.dumps(receipt))
