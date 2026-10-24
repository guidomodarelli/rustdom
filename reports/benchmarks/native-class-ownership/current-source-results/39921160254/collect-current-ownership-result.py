"""Collect the one original current-source run; never start or repeat a measurement."""
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import zipfile

if sys.flags.optimize:
    raise RuntimeError('Original ownership collection requires Python assertions; disable Python optimization')
RUN = 39921160254
JOB = 120306452464
HEAD = 'eafe4109fbbf94d36d225f745bb60d716ea0c214'
root = Path.cwd() / '.cache' / ('current-ownership-original-' + str(RUN))
root.mkdir(exist_ok=True)

def metadata(endpoint, filename):
    raw = subprocess.check_output(['gh', 'api', endpoint])
    (root / filename).write_bytes(raw)
    return json.loads(raw)

run = metadata(f'repos/guidomodarelli/rustdom/actions/runs/{RUN}', 'run.json')
jobs = metadata(f'repos/guidomodarelli/rustdom/actions/runs/{RUN}/jobs', 'jobs.json')
assert run['head_sha'] == HEAD and run['run_attempt'] == 1
assert run['path'] == '.github/workflows/ownership-current-source.yml'
job = next(item for item in jobs['jobs'] if item['id'] == JOB)
state = {'runId': RUN, 'jobId': JOB, 'head': HEAD, 'status': run['status'],
         'conclusion': run['conclusion'], 'measurementRepeated': False}
if '--collect' not in sys.argv:
    print(json.dumps(state))
    raise SystemExit(0)
if run['status'] != 'completed' or job['status'] != 'completed':
    raise SystemExit('Original run is still active; do not collect partial transport or restart it')
artifacts = metadata(f'repos/guidomodarelli/rustdom/actions/runs/{RUN}/artifacts', 'artifacts.json')
matching = [item for item in artifacts['artifacts'] if item['name'] == 'ownership-current-source-' + HEAD]
assert len(matching) == 1 and not matching[0]['expired']
artifact = matching[0]
filename = root / 'artifact.zip'
if not filename.exists():
    partial = root / 'artifact.zip.part'
    with partial.open('wb') as output:
        subprocess.run(['gh', 'api', f'repos/guidomodarelli/rustdom/actions/artifacts/{artifact["id"]}/zip'],
                       stdout=output, check=True)
    downloaded = partial.read_bytes()
    assert len(downloaded) == artifact['size_in_bytes']
    assert 'sha256:' + hashlib.sha256(downloaded).hexdigest() == artifact['digest']
    partial.replace(filename)
raw = filename.read_bytes()
digest = hashlib.sha256(raw).hexdigest()
assert len(raw) == artifact['size_in_bytes'] and 'sha256:' + digest == artifact['digest']
with zipfile.ZipFile(filename) as bundle:
    members = [entry for entry in bundle.infolist() if not entry.is_dir()]
    assert len(members) == 1 and members[0].filename == 'ownership-current-results.tar.xz'
    assert bundle.testzip() is None
    tar = bundle.read(members[0])
    (root / members[0].filename).write_bytes(tar)
with (root / 'job.log').open('wb') as output, (root / 'job-log.stderr.log').open('wb') as errors:
    log = subprocess.run(['gh', 'run', 'view', str(RUN), '--job', str(JOB), '--log'], stdout=output, stderr=errors)
state.update(artifactId=artifact['id'], zipBytes=len(raw), zipSha256=digest,
             tarBytes=len(tar), tarSha256=hashlib.sha256(tar).hexdigest(),
             jobLogExitCode=log.returncode, transportAuthenticated=True)
(root / 'collection.json').write_text(json.dumps(state, indent=2) + '\n')
print(json.dumps(state))
if '--transport-only' not in sys.argv:
    operations = [
        ('extract', ['wsl', '-d', 'Ubuntu-22.04', '--', 'python3', '-B',
            '/mnt/c/Users/guido/.codex/worktrees/native-class-ownership/rustdom/.cache/extract-current-ownership-result.py']),
        ('verify', ['wsl', '-d', 'Ubuntu-22.04', '--', 'python3', '-B',
            '/mnt/c/Users/guido/.codex/worktrees/native-class-ownership/rustdom/.cache/verify-current-ownership-result.py']),
    ]
    processing = {'runId': RUN, 'head': HEAD, 'samplerExecuted': False, 'operations': []}
    for name, arguments in operations:
        with (root / (name + '.stdout.log')).open('wb') as output, (root / (name + '.stderr.log')).open('wb') as errors:
            result = subprocess.run(arguments, stdout=output, stderr=errors)
        processing['operations'].append({'name': name, 'command': arguments, 'exitCode': result.returncode})
        (root / 'postprocessing.json').write_text(json.dumps(processing, indent=2) + '\n')
        if result.returncode:
            print(json.dumps({'postprocessingComplete': False, 'operation': name, 'exitCode': result.returncode,
                              'performanceAccepted': None, 'logs': str(root)}))
            raise SystemExit(result.returncode)
    verified = json.loads((Path.cwd() / '.cache/current-ownership-results-verification-state.json').read_text())
    print(json.dumps({'postprocessingComplete': True, 'verified': verified['verified'],
                      'performanceAccepted': verified['accepted'], 'samplerExecuted': False}))
