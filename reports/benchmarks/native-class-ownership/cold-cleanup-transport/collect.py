"""Read and collect one declared hosted preparation. Never launches or retries a workflow."""
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import zipfile

if sys.flags.optimize:
    raise RuntimeError('Cold preparation collection requires non-optimized Python')

POLICY = json.loads((Path(__file__).parent / 'constants/transport.json').read_text(encoding='utf-8'))
RUN_ID = POLICY['runId']
JOB_ID = POLICY['jobId']
HEAD = POLICY['head']
WORKFLOW = POLICY['workflow']
ARTIFACT_NAME = POLICY['artifactName']
TAR_NAME = POLICY['tarName']
API_REPOSITORY = POLICY['apiRepository']
FILES = POLICY['files']


def digest(filename):
    result = hashlib.sha256()
    with filename.open('rb') as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b''):
            result.update(chunk)
    return result.hexdigest()


def authenticate_run(run, jobs):
    """Bind the transport to the actual unique source, attempt and observed job."""
    assert run['id'] == RUN_ID and run['head_sha'] == HEAD and run['run_attempt'] == POLICY['attempt']
    assert run['path'].split('@', 1)[0] == WORKFLOW
    assert run['event'] == POLICY['event']
    assert [job['id'] for job in jobs['jobs']] == [JOB_ID]


def authenticate_artifact(artifact, filename):
    """Verify only consumed identity/byte-integrity fields; unrelated API metadata is retained without revalidation."""
    assert artifact['name'] == ARTIFACT_NAME and not artifact['expired']
    assert artifact['id'] == POLICY['artifactId']
    assert artifact['workflow_run']['id'] == RUN_ID and artifact['workflow_run']['head_sha'] == HEAD
    assert artifact['size_in_bytes'] == POLICY['zipBytes']
    assert artifact['digest'] == 'sha256:' + POLICY['zipSha256']
    assert filename.stat().st_size == artifact['size_in_bytes']
    assert 'sha256:' + digest(filename) == artifact['digest']
    with zipfile.ZipFile(filename) as archive:
        assert archive.namelist() == [TAR_NAME]
        assert archive.testzip() is None


def collect(repository, output, download=False):
    """Read the pinned run into a fresh or explicitly owned collection, preserving unrelated files."""
    output = output.parent.resolve(strict=True) / output.name
    owner = {'runId': RUN_ID, 'jobId': JOB_ID, 'head': HEAD, 'artifactId': POLICY['artifactId']}
    if output.is_symlink():
        raise ValueError('Cold preparation collection: output cannot be a symbolic link')
    if output.exists() and any(output.iterdir()):
        marker = output / FILES['owner']
        if not marker.is_file() or json.loads(marker.read_text(encoding='utf-8')) != owner:
            raise FileExistsError('Cold preparation collection: preserve nonempty output without a matching ownership marker')
    output.mkdir(exist_ok=True)
    if not (output / FILES['owner']).exists():
        with (output / FILES['owner']).open('xb') as destination:
            destination.write((json.dumps(owner, indent=2) + '\n').encode())
    def metadata(endpoint, name):
        raw = subprocess.check_output(['gh', 'api', endpoint], cwd=repository)
        (output / name).write_bytes(raw)
        return json.loads(raw)
    run = metadata(f'{API_REPOSITORY}/actions/runs/{RUN_ID}', FILES['run'])
    jobs = metadata(f'{API_REPOSITORY}/actions/runs/{RUN_ID}/jobs', FILES['jobs'])
    authenticate_run(run, jobs)
    job = jobs['jobs'][0]
    state = {'runId': RUN_ID, 'jobId': JOB_ID, 'head': HEAD, 'attempt': POLICY['attempt'],
        'status': run['status'], 'conclusion': run['conclusion'], 'workflowRepeated': False,
        'collectorExecutedDOM': False, 'measurementExecuted': False, 'performanceAccepted': None,
        'activeSteps': [step['name'] for step in job['steps'] if step['status'] == 'in_progress']}
    (output / FILES['observation']).write_bytes((json.dumps(state, indent=2) + '\n').encode())
    if not download or run['status'] != 'completed':
        return state
    assert job['status'] == 'completed'
    # Preserve the diagnostic log even when upload failed and no archive is available.
    if not (output / FILES['jobLog']).exists():
        partial_log = output / FILES['jobLogPartial']
        with partial_log.open('xb') as destination:
            subprocess.run(['gh', 'run', 'view', str(RUN_ID), '--job', str(JOB_ID), '--log'],
                cwd=repository, stdout=destination, check=True)
        partial_log.rename(output / FILES['jobLog'])
    artifacts = metadata(f'{API_REPOSITORY}/actions/runs/{RUN_ID}/artifacts', FILES['artifacts'])
    candidates = [artifact for artifact in artifacts['artifacts'] if artifact['name'] == ARTIFACT_NAME]
    assert len(candidates) == 1, 'Inspect the same run/artifact list; never relaunch a preparation to repair transport'
    artifact = candidates[0]
    filename = output / FILES['zip']
    if not filename.exists():
        partial = output / FILES['zipPartial']
        with partial.open('xb') as destination:
            subprocess.run(['gh', 'api', f'{API_REPOSITORY}/actions/artifacts/{artifact["id"]}/zip'],
                cwd=repository, stdout=destination, check=True)
        authenticate_artifact(artifact, partial)
        partial.rename(filename)
    authenticate_artifact(artifact, filename)
    tar_path = output / TAR_NAME
    if not tar_path.exists():
        with zipfile.ZipFile(filename) as archive, archive.open(TAR_NAME) as source, tar_path.open('xb') as destination:
            for chunk in iter(lambda: source.read(1024 * 1024), b''):
                destination.write(chunk)
    with zipfile.ZipFile(filename) as archive:
        assert archive.getinfo(TAR_NAME).file_size == tar_path.stat().st_size
        expected = hashlib.sha256()
        with archive.open(TAR_NAME) as source:
            for chunk in iter(lambda: source.read(1024 * 1024), b''):
                expected.update(chunk)
        assert digest(tar_path) == expected.hexdigest()
    assert tar_path.stat().st_size == POLICY['tarBytes'] and digest(tar_path) == POLICY['tarSha256']
    state.update(artifactId=artifact['id'], zipBytes=filename.stat().st_size, zipSha256=digest(filename),
        tarBytes=tar_path.stat().st_size, tarSha256=digest(tar_path), transportAuthenticated=True)
    (output / FILES['state']).write_bytes((json.dumps(state, indent=2) + '\n').encode())
    return state


if __name__ == '__main__':
    assert len(sys.argv) in [3, 4], 'Provide repository, owned output and optional --collect'
    if len(sys.argv) == 4:
        assert sys.argv[3] == POLICY['collectFlag']
    print(json.dumps(collect(Path(sys.argv[1]).resolve(), Path(sys.argv[2]), len(sys.argv) == 4)))
