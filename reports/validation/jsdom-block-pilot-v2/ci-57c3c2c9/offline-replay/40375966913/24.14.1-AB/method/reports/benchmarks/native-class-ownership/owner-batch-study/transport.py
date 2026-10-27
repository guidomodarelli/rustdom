"""Collect one independently selected run and authenticate its two SDK artifacts; never execute captured code or accept performance."""
import hashlib
import base64
import json
from pathlib import Path, PurePosixPath
import re
import stat
import subprocess
import sys
import zipfile

if sys.flags.optimize:
    raise RuntimeError('Owner batch transport requires non-optimized Python')
POLICY_BYTES = (Path(__file__).parent / 'constants/transport.json').read_bytes()
CAPTURE_BYTES = (Path(__file__).parent / 'constants/capture.json').read_bytes()
POLICY = json.loads(POLICY_BYTES)
CAPTURE = json.loads(CAPTURE_BYTES)
_SOURCE_SHA256 = globals().get('_SOURCE_SHA256', hashlib.sha256(Path(__file__).read_bytes()).hexdigest())


def source_identity():
    """Record actual current Python source and consumed policy bytes separately from immutable producer data."""
    return {'transport.py': _SOURCE_SHA256, 'constants/transport.json': hashlib.sha256(POLICY_BYTES).hexdigest(),
            'constants/capture.json': hashlib.sha256(CAPTURE_BYTES).hexdigest()}


def digest(filename):
    """Hash complete bytes with bounded buffers."""
    value = hashlib.sha256()
    with filename.open('rb') as stream:
        for chunk in iter(lambda: stream.read(POLICY['chunkBytes']), b''):
            value.update(chunk)
    return value.hexdigest()


def read_json(filename):
    """Read an independent regular metadata file; never follow metadata aliases."""
    status = filename.lstat()
    assert stat.S_ISREG(status.st_mode) and status.st_nlink == 1 and status.st_size <= POLICY['metadataLimitBytes'], filename
    return json.loads(filename.read_bytes())


def write_json(filename, value):
    """Create only new metadata, preserving partial and existing entries."""
    raw = (json.dumps(value, indent=2) + '\n').encode()
    assert len(raw) <= POLICY['metadataLimitBytes'], 'Owner batch transport: metadata bound exceeded'
    with filename.open('xb') as stream:
        stream.write(raw)


def validate_binding(binding):
    """Selection is external to artifacts and fixes both jobs before looking at their data."""
    assert binding['repository'] == POLICY['repository']
    assert binding['mode'] in ['functional', 'capture']
    assert binding['attempt'] == POLICY['attempt'] and type(binding['attempt']) is int
    assert type(binding['runId']) is int and binding['runId'] > 0
    assert re.fullmatch(r'[a-f0-9]{40}', binding['head'])
    assert set(binding['jobs']) == set(POLICY['nodes'])
    assert all(type(value) is int and value > 0 for value in binding['jobs'].values())
    assert len(set(binding['jobs'].values())) == len(POLICY['nodes'])


def authenticate_jobs(binding, run, jobs):
    """Bind actual GitHub identity/attempt/job names before requiring an artifact upload."""
    validate_binding(binding)
    assert run['id'] == binding['runId'] and run['run_attempt'] == binding['attempt'] and run['head_sha'] == binding['head']
    assert run['event'] == 'pull_request' and run['path'].split('@', 1)[0] == POLICY[binding['mode'] + 'Workflow']
    assert run['status'] == 'completed', 'Owner batch transport: run still active; observe the same run'
    assert jobs['total_count'] == len(jobs['jobs']) <= POLICY['maximumMembers']
    assert len({job['id'] for job in jobs['jobs']}) == len(jobs['jobs'])
    selected = {}
    for node in POLICY['nodes']:
        candidates = [job for job in jobs['jobs'] if job['id'] == binding['jobs'][node]]
        assert len(candidates) == 1, 'Owner batch transport: missing independently selected SDK job'
        job = candidates[0]
        assert job['run_id'] == binding['runId'] and job['head_sha'] == binding['head'] and job['run_attempt'] == binding['attempt']
        assert job['name'] == POLICY[binding['mode'] + 'JobPrefix'] + node and job['status'] == 'completed'
        selected[node] = job
    return selected


def authenticate_metadata(binding, run, jobs, artifacts):
    """Bind both artifacts without choosing favorable replacements when an upload fails."""
    selected_jobs = authenticate_jobs(binding, run, jobs)
    assert artifacts['total_count'] == len(artifacts['artifacts']) == len(POLICY['nodes'])
    assert len({artifact['id'] for artifact in artifacts['artifacts']}) == len(artifacts['artifacts'])
    selected = []
    for node in POLICY['nodes']:
        job = selected_jobs[node]
        name = POLICY[binding['mode'] + 'ArtifactPrefix'] + node + '-' + binding['head']
        candidates = [artifact for artifact in artifacts['artifacts'] if artifact['name'] == name]
        assert len(candidates) == 1, 'Owner batch transport: missing/ambiguous SDK artifact; do not repeat capture'
        artifact = candidates[0]
        assert type(artifact['id']) is int and artifact['id'] > 0 and artifact['expired'] is False
        assert artifact['workflow_run']['id'] == binding['runId'] and artifact['workflow_run']['head_sha'] == binding['head']
        assert type(artifact['size_in_bytes']) is int and 0 < artifact['size_in_bytes'] <= POLICY['archiveLimitBytes']
        assert re.fullmatch(r'sha256:[a-f0-9]{64}', artifact['digest'])
        if 'artifacts' in binding:
            assert set(binding['artifacts']) == set(POLICY['nodes'])
            assert binding['artifacts'][node] == {field: artifact[field] for field in ['id', 'name', 'digest', 'size_in_bytes']}, \
                'Owner batch transport: changed independently pinned artifact'
        selected.append({'node': node, 'job': job, 'artifact': artifact})
    return selected


def safe_name(name):
    """Require a normalized portable relative member; callers reject links and all special files."""
    assert isinstance(name, str) and name and '\\' not in name and ':' not in name and '\0' not in name
    path = PurePosixPath(name)
    assert not path.is_absolute() and '..' not in path.parts and name in [str(path), str(path) + '/']
    assert all(part not in ['.', '..'] and not part.endswith((' ', '.')) for part in path.parts)
    assert all(not re.fullmatch(r'(?i:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])', part.split('.')[0]) for part in path.parts)
    return path


def inspect_zip(filename, artifact):
    """Authenticate original ZIP size/digest, then every member including ignored or unfavorable diagnostics."""
    status = filename.lstat()
    assert stat.S_ISREG(status.st_mode) and status.st_nlink == 1 and status.st_size == artifact['size_in_bytes']
    assert 'sha256:' + digest(filename) == artifact['digest'], 'Owner batch transport: ZIP digest mismatch'
    members = []; names = set(); total = 0
    with zipfile.ZipFile(filename) as archive:
        entries = archive.infolist(); assert len(entries) <= POLICY['maximumMembers']
        for entry in entries:
            safe_name(entry.filename)
            assert entry.filename not in names; names.add(entry.filename)
            kind = stat.S_IFMT(entry.external_attr >> 16)
            assert kind in [0, stat.S_IFDIR, stat.S_IFREG], 'Owner batch transport: ZIP special member/link rejected'
            assert not entry.flag_bits & 1, 'Owner batch transport: encrypted ZIP unsupported'
            total += entry.file_size; assert total <= POLICY['archiveLimitBytes']
            checksum = hashlib.sha256(); length = 0
            with archive.open(entry) as stream:
                for chunk in iter(lambda: stream.read(POLICY['chunkBytes']), b''):
                    length += len(chunk); assert length <= entry.file_size; checksum.update(chunk)
            assert length == entry.file_size
            members.append({'path': entry.filename, 'kind': 'directory' if entry.is_dir() else 'file',
                            'bytes': length, 'sha256': checksum.hexdigest()})
    return members


def verify_collection(binding, collection, require_completed=True):
    """Offline replay of transport authentication; capture payload and numerical decisions remain separate."""
    assert 'artifacts' in binding, 'Owner batch transport: offline verification requires independently retained artifact pins'
    assert re.fullmatch(r'[a-f0-9]{64}', binding['producerCatalogSha256'])
    assert collection.is_dir() and not collection.is_symlink()
    required = {'run.json', 'jobs.json', 'artifacts.json', 'producer-catalog-api.json'} | \
        {'job-' + str(job_id) + '.log' for job_id in binding['jobs'].values()}
    assert set(binding['savedFiles']) == required, 'Owner batch transport: independent metadata/log pins required'
    for name, expected in binding['savedFiles'].items():
        filename = collection / name; status = filename.lstat()
        assert stat.S_ISREG(status.st_mode) and status.st_nlink == 1 and 0 < status.st_size == expected['bytes']
        assert digest(filename) == expected['sha256'], 'Owner batch transport: retained API/log bytes changed ' + name
    if require_completed:
        completed = read_json(collection / 'collection.json')
        assert completed['complete'] is True and completed['logFailures'] == [] and 'failure' not in completed
        assert completed['performanceAccepted'] is None and completed['gateReevaluated'] is False
    run = read_json(collection / 'run.json')
    selected = authenticate_metadata(binding, run, read_json(collection / 'jobs.json'), read_json(collection / 'artifacts.json'))
    producer = producer_catalog(binding, collection)
    summaries = []
    for entry in selected:
        directory = collection / ('artifact-' + str(entry['artifact']['id']))
        assert directory.is_dir() and not directory.is_symlink()
        assert read_json(directory / 'metadata.json') == entry['artifact']
        members = inspect_zip(directory / 'artifact.zip', entry['artifact'])
        assert read_json(directory / 'members.json') == members
        summaries.append({'node': entry['node'], 'jobId': entry['job']['id'], 'artifactId': entry['artifact']['id'],
                          'artifactDigest': entry['artifact']['digest'], 'members': len(members), 'jobConclusion': entry['job']['conclusion']})
    return {'transportAuthenticated': True, 'mode': binding['mode'], 'runId': binding['runId'], 'head': binding['head'],
            'attempt': binding['attempt'], 'runNumber': run['run_number'], 'runConclusion': run['conclusion'], 'artifacts': summaries, 'archivedCodeExecuted': False,
            'producerProfile': producer, 'DOMExecuted': False, 'performanceAccepted': None, 'gateReevaluated': False}


def producer_catalog(binding, collection):
    """Authenticate producer source declarations fetched as GitHub data at the independently fixed commit."""
    response = read_json(collection / 'producer-catalog-api.json')
    assert response['type'] == 'file' and response['path'] == POLICY['producerCatalog'] and response['encoding'] == 'base64'
    assert response['url'] == 'https://api.github.com/repos/' + binding['repository'] + '/contents/' + POLICY['producerCatalog'] + '?ref=' + binding['head']
    raw = base64.b64decode(''.join(response['content'].split()), validate=True)
    assert len(raw) == response['size'] <= POLICY['metadataLimitBytes']
    assert hashlib.sha1(b'blob ' + str(len(raw)).encode() + b'\0' + raw).hexdigest() == response['sha']
    checksum = hashlib.sha256(raw).hexdigest()
    assert checksum == binding['producerCatalogSha256'], 'Owner batch transport: producer catalog differs from retained API binding'
    declaration = json.loads(raw); assert declaration['revision'] == CAPTURE['revision']
    assert isinstance(declaration['files'], dict) and declaration['files']
    for name, sha in declaration['files'].items():
        safe_name(name); assert re.fullmatch(r'[a-f0-9]{64}', sha)
    assert POLICY['producerCatalog'] not in declaration['files']
    return {'sourceCommit': binding['head'], 'catalogSha256': checksum,
            'files': {**declaration['files'], POLICY['producerCatalog']: checksum}}


def collect(binding, output):
    """Read a fixed completed run once into a new directory, retaining every transport partial on failure."""
    validate_binding(binding)
    output = output.parent.resolve(strict=True) / output.name
    assert not output.exists() and not output.is_symlink(), 'Owner batch transport: preserve existing collection'
    output.mkdir(); write_json(output / 'binding.json', binding)
    state = {'complete': False, 'runId': binding['runId'], 'attempt': binding['attempt'], 'head': binding['head'],
             'DOMExecuted': False, 'studyRepeated': False, 'performanceAccepted': None, 'gateReevaluated': False}

    def request(endpoint, filename):
        with filename.open('xb') as stream, filename.with_name(filename.name + '.stderr.log').open('xb') as errors:
            child = subprocess.run(['gh', 'api', endpoint], stdout=stream, stderr=errors,
                                   timeout=POLICY['commandTimeoutSeconds'])
        assert child.returncode == 0, 'Owner batch transport: GitHub API request failed; partial retained ' + filename.name

    try:
        prefix = 'repos/' + binding['repository'] + '/actions/runs/' + str(binding['runId'])
        for endpoint, name in [(prefix, 'run.json'), (prefix + '/attempts/1/jobs?per_page=100', 'jobs.json')]:
            request(endpoint, output / name)
        selected_jobs = authenticate_jobs(binding, read_json(output / 'run.json'), read_json(output / 'jobs.json'))
        state['logFailures'] = []
        for node, job in selected_jobs.items():
            try:
                request('repos/' + binding['repository'] + '/actions/jobs/' + str(job['id']) + '/logs',
                        output / ('job-' + str(job['id']) + '.log'))
            except Exception as error:
                state['logFailures'].append({'node': node, 'jobId': job['id'], 'error': str(error)})
        # Logs are preserved even if upload failed and no artifact exists.
        request(prefix + '/artifacts?per_page=100', output / 'artifacts.json')
        selected = authenticate_metadata(binding, read_json(output / 'run.json'), read_json(output / 'jobs.json'),
                                         read_json(output / 'artifacts.json'))
        pinned = {**binding, 'artifacts': {entry['node']: {field: entry['artifact'][field]
                  for field in ['id', 'name', 'digest', 'size_in_bytes']} for entry in selected}}
        request('repos/' + binding['repository'] + '/contents/' + POLICY['producerCatalog'] + '?ref=' + binding['head'],
                output / 'producer-catalog-api.json')
        catalog_response = read_json(output / 'producer-catalog-api.json')
        catalog_bytes = base64.b64decode(''.join(catalog_response['content'].split()), validate=True)
        pinned['producerCatalogSha256'] = hashlib.sha256(catalog_bytes).hexdigest()
        producer_catalog(pinned, output)
        retained = ['run.json', 'jobs.json', 'artifacts.json', 'producer-catalog-api.json'] + \
            ['job-' + str(job_id) + '.log' for job_id in binding['jobs'].values()]
        pinned['savedFiles'] = {name: {'bytes': (output / name).stat().st_size, 'sha256': digest(output / name)}
                                for name in retained if (output / name).is_file()}
        write_json(output / 'authenticated-binding.json', pinned)
        for entry in selected:
            artifact = entry['artifact']; directory = output / ('artifact-' + str(artifact['id'])); directory.mkdir()
            write_json(directory / 'metadata.json', artifact)
            request('repos/' + binding['repository'] + '/actions/artifacts/' + str(artifact['id']) + '/zip', directory / 'artifact.zip')
            write_json(directory / 'members.json', inspect_zip(directory / 'artifact.zip', artifact))
        state.update(verify_collection(pinned, output, require_completed=False))
        assert not state['logFailures'], 'Owner batch transport: original job logs incomplete; retained available artifacts'
        state['complete'] = True
        return state
    except BaseException as error:
        state['failure'] = {'type': type(error).__name__, 'message': str(error)}
        raise
    finally:
        write_json(output / 'collection.json', state)


if __name__ == '__main__':
    assert len(sys.argv) == 4, 'Provide --collect/--verify, independent binding JSON and collection directory'
    operation, binding_path, directory = sys.argv[1:]
    binding = read_json(Path(binding_path))
    if operation == '--collect':
        result = collect(binding, Path(directory))
    else:
        assert operation == '--verify'; result = verify_collection(binding, Path(directory))
    print(json.dumps(result))
