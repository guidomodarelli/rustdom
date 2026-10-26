"""Observe and preserve this functional build's six jobs; never activate, retry, build or execute DOM."""
import concurrent.futures
import datetime
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import zipfile

if sys.flags.optimize:
    raise RuntimeError('Range build collection requires non-optimized Python')

POLICY = json.loads((Path(__file__).parent / 'constants/transport.json').read_text(encoding='utf-8'))


def digest(filename):
    result = hashlib.sha256()
    with filename.open('rb') as content:
        for chunk in iter(lambda: content.read(1024 * 1024), b''):
            result.update(chunk)
    return result.hexdigest()


def authenticate_run(run, jobs):
    """Consume only the identity fields needed to bind the exact build and its matrix jobs."""
    assert run['id'] == POLICY['runId'] and run['head_sha'] == POLICY['head']
    assert run['run_attempt'] == POLICY['attempt'] and run['event'] == 'pull_request'
    assert run['path'].split('@', 1)[0] == POLICY['workflow']
    assert {job['id'] for job in jobs['jobs']} == {job['id'] for job in POLICY['jobs']}


def authenticate_artifact(metadata, filename, job):
    """Bind API name/run/head, exact compressed bytes, digest and ZIP integrity without a provider-wide schema."""
    assert metadata['name'] == job['artifactName']
    assert metadata['workflow_run']['id'] == POLICY['runId'] and metadata['workflow_run']['head_sha'] == POLICY['head']
    if job.get('artifactPin') is not None:
        pinned = job['artifactPin']
        assert metadata['id'] == pinned['id'] and metadata['size_in_bytes'] == pinned['zipBytes']
        assert metadata['digest'] == 'sha256:' + pinned['zipSha256']
    assert filename.stat().st_size == metadata['size_in_bytes']
    assert 'sha256:' + digest(filename) == metadata['digest']
    with zipfile.ZipFile(filename) as archive:
        assert archive.testzip() is None


def claim_output(output):
    """Reject foreign output before any API call or metadata write."""
    output = output.parent.resolve(strict=True) / output.name
    assert not output.is_symlink() and not getattr(output, 'is_junction', lambda: False)()
    ownership = {key: POLICY[key] for key in ['revision', 'runId', 'head', 'attempt']}
    if not output.exists():
        output.mkdir()
    assert output.is_dir(), 'Range build collection requires a directory'
    marker = output / POLICY['ownerFile']
    if marker.exists():
        assert not marker.is_symlink()
        assert json.loads(marker.read_text(encoding='utf-8')) == ownership, 'Range build collection belongs to another owner'
    else:
        assert not any(output.iterdir()), 'Range build collection requires an empty output or its matching ownership marker'
        with marker.open('x', encoding='utf-8') as destination:
            destination.write(json.dumps(ownership, indent=2) + '\n')
    return output


def collect(repository, output, download=False):
    output = claim_output(output)
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
    snapshots = output / 'observations'
    snapshots.mkdir(exist_ok=True)
    def metadata(endpoint, name):
        raw = subprocess.check_output(['gh', 'api', endpoint], cwd=repository)
        with (snapshots / (stamp + '-' + name)).open('xb') as destination:
            destination.write(raw)
        (output / name).write_bytes(raw)
        return json.loads(raw)
    prefix = f'repos/{POLICY["repository"]}/actions'
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as workers:
        run_request = workers.submit(metadata, f'{prefix}/runs/{POLICY["runId"]}', 'run.json')
        jobs_request = workers.submit(metadata, f'{prefix}/runs/{POLICY["runId"]}/jobs?per_page=100', 'jobs.json')
        run, jobs = run_request.result(), jobs_request.result()
    authenticate_run(run, jobs)
    artifacts = metadata(f'{prefix}/runs/{POLICY["runId"]}/artifacts?per_page=100', 'artifacts.json') if download else {'artifacts': []}
    observed = {job['id']: job for job in jobs['jobs']}
    summary = {'runId': POLICY['runId'], 'head': POLICY['head'], 'attempt': POLICY['attempt'],
        'status': run['status'], 'conclusion': run['conclusion'], 'observedAtUTC': stamp,
        'functionalOnly': True, 'performanceAccepted': None, 'collectorExecutedDOM': False, 'jobs': []}
    for expected in POLICY['jobs']:
        job = observed[expected['id']]
        state = {'key': expected['key'], 'id': job['id'], 'name': job['name'], 'status': job['status'], 'conclusion': job['conclusion']}
        summary['jobs'].append(state)
        if not download or job['status'] != 'completed':
            continue
        directory = output / expected['key']
        directory.mkdir(exist_ok=True)
        log = directory / 'job.log'
        if not log.exists():
            log_result = subprocess.run(['gh', 'api', f'{prefix}/jobs/{job["id"]}/logs'], cwd=repository, capture_output=True)
            if log_result.returncode:
                (directory / (stamp + '-log-error.txt')).write_bytes(log_result.stderr)
                state['logAvailable'] = False
            else:
                with log.open('xb') as destination:
                    destination.write(log_result.stdout)
        state['logAvailable'] = log.exists()
        selected = [artifact for artifact in artifacts['artifacts'] if artifact['name'] == expected['artifactName']]
        assert len(selected) <= 1, 'Range build collection: ambiguous artifact name'
        if not selected:
            state['artifactAvailable'] = False
            continue
        artifact = selected[0]
        filename = directory / 'artifact.zip'
        metadata_path = directory / 'artifact.json'
        if filename.exists():
            pinned = json.loads(metadata_path.read_text(encoding='utf-8'))
            for field in ['id', 'name', 'size_in_bytes', 'digest']:
                assert pinned[field] == artifact[field], 'Range build collection: original artifact identity changed'
            authenticate_artifact(pinned, filename, expected)
        else:
            assert not artifact['expired'], 'Range build collection: preserve logs and API metadata for expired artifacts'
            partial = directory / (stamp + '-artifact.zip.part')
            with partial.open('xb') as destination:
                subprocess.run(['gh', 'api', f'{prefix}/artifacts/{artifact["id"]}/zip'], cwd=repository, stdout=destination, check=True)
            authenticate_artifact(artifact, partial, expected)
            if metadata_path.exists():
                previous = json.loads(metadata_path.read_text(encoding='utf-8'))
                for field in ['id', 'name', 'size_in_bytes', 'digest']:
                    assert previous[field] == artifact[field], 'Range build collection: preserve original metadata after interrupted transport'
            else:
                with metadata_path.open('x', encoding='utf-8') as destination:
                    destination.write(json.dumps(artifact, indent=2) + '\n')
            partial.rename(filename)
        state.update(artifactAvailable=True, artifactId=artifact['id'], zipBytes=filename.stat().st_size,
            zipSha256=digest(filename), transportAuthenticated=True)
    summary['terminalJobs'] = sum(job['status'] == 'completed' for job in summary['jobs'])
    summary['authenticatedArtifacts'] = sum(job.get('transportAuthenticated', False) for job in summary['jobs'])
    summary['allJobsSucceeded'] = all(job['status'] == 'completed' and job['conclusion'] == 'success' for job in summary['jobs'])
    (output / 'collection.json').write_text(json.dumps(summary, indent=2) + '\n', encoding='utf-8', newline='\n')
    return summary


if __name__ == '__main__':
    assert len(sys.argv) in [3, 4], 'Provide repository, owned output, and optional --collect'
    assert len(sys.argv) != 4 or sys.argv[3] == '--collect'
    result = collect(Path(sys.argv[1]).resolve(), Path(sys.argv[2]), len(sys.argv) == 4)
    print(json.dumps({'runId': result['runId'], 'status': result['status'], 'terminalJobs': result['terminalJobs'],
        'authenticatedArtifacts': result['authenticatedArtifacts'], 'allJobsSucceeded': result['allJobsSucceeded'],
        'performanceAccepted': None, 'collectorExecutedDOM': False}))
