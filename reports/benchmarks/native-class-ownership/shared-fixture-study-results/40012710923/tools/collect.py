"""Read and collect the one authorized hosted study. Never launches, retries or changes a study."""
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import zipfile

if sys.flags.optimize:
    raise RuntimeError('Shared study collection requires non-optimized Python')

RUN_ID = 40012710923
JOB_ID = 120616868608
HEAD = '14c2cc236ebcf68abc7c9d06f4b5b88e35e57ab4'
WORKFLOW = '.github/workflows/ownership-shared-fixtures.yml'
ARTIFACT_NAME = 'ownership-shared-fixtures-' + HEAD + '-attempt1'
TAR_NAME = 'shared-study.tar.xz'


def digest(filename):
    result = hashlib.sha256()
    with filename.open('rb') as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b''):
            result.update(chunk)
    return result.hexdigest()


def authenticate_run(run, jobs):
    """Bind the transport to the actual unique source, attempt and observed job."""
    assert run['id'] == RUN_ID and run['head_sha'] == HEAD and run['run_attempt'] == 1
    assert run['path'].split('@', 1)[0] == WORKFLOW
    assert run['event'] == 'pull_request'
    assert [job['id'] for job in jobs['jobs']] == [JOB_ID]


def authenticate_artifact(artifact, filename):
    """Verify only consumed identity/byte-integrity fields; unrelated API metadata is retained without revalidation."""
    assert artifact['name'] == ARTIFACT_NAME and not artifact['expired']
    assert artifact['workflow_run']['id'] == RUN_ID and artifact['workflow_run']['head_sha'] == HEAD
    assert filename.stat().st_size == artifact['size_in_bytes']
    assert 'sha256:' + digest(filename) == artifact['digest']
    with zipfile.ZipFile(filename) as archive:
        assert archive.namelist() == [TAR_NAME]
        assert archive.testzip() is None


def collect(repository, output, download=False):
    output = output.parent.resolve(strict=True) / output.name
    output.mkdir(exist_ok=True)
    def metadata(endpoint, name):
        raw = subprocess.check_output(['gh', 'api', endpoint], cwd=repository)
        (output / name).write_bytes(raw)
        return json.loads(raw)
    run = metadata(f'repos/guidomodarelli/rustdom/actions/runs/{RUN_ID}', 'run.json')
    jobs = metadata(f'repos/guidomodarelli/rustdom/actions/runs/{RUN_ID}/jobs', 'jobs.json')
    authenticate_run(run, jobs)
    job = jobs['jobs'][0]
    state = {'runId': RUN_ID, 'jobId': JOB_ID, 'head': HEAD, 'attempt': 1,
        'status': run['status'], 'conclusion': run['conclusion'], 'studyRepeated': False,
        'collectorExecutedDOM': False, 'performanceAccepted': None,
        'activeSteps': [step['name'] for step in job['steps'] if step['status'] == 'in_progress']}
    (output / 'observation.json').write_bytes((json.dumps(state, indent=2) + '\n').encode())
    if not download or run['status'] != 'completed':
        return state
    assert job['status'] == 'completed'
    # Preserve the diagnostic log even when upload failed and no archive is available.
    if not (output / 'job.log').exists():
        partial_log = output / 'job.log.part'
        with partial_log.open('xb') as destination:
            subprocess.run(['gh', 'run', 'view', str(RUN_ID), '--job', str(JOB_ID), '--log'],
                cwd=repository, stdout=destination, check=True)
        partial_log.rename(output / 'job.log')
    artifacts = metadata(f'repos/guidomodarelli/rustdom/actions/runs/{RUN_ID}/artifacts', 'artifacts.json')
    candidates = [artifact for artifact in artifacts['artifacts'] if artifact['name'] == ARTIFACT_NAME]
    assert len(candidates) == 1, 'Inspect the same run/artifact list; never relaunch a study to repair transport'
    artifact = candidates[0]
    filename = output / 'artifact.zip'
    if not filename.exists():
        partial = output / 'artifact.zip.part'
        with partial.open('xb') as destination:
            subprocess.run(['gh', 'api', f'repos/guidomodarelli/rustdom/actions/artifacts/{artifact["id"]}/zip'],
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
    state.update(artifactId=artifact['id'], zipBytes=filename.stat().st_size, zipSha256=digest(filename),
        tarBytes=tar_path.stat().st_size, tarSha256=digest(tar_path), transportAuthenticated=True)
    (output / 'collection.json').write_bytes((json.dumps(state, indent=2) + '\n').encode())
    return state


if __name__ == '__main__':
    assert len(sys.argv) in [3, 4], 'Provide repository, owned output and optional --collect'
    if len(sys.argv) == 4:
        assert sys.argv[3] == '--collect'
    print(json.dumps(collect(Path(sys.argv[1]).resolve(), Path(sys.argv[2]), len(sys.argv) == 4)))
