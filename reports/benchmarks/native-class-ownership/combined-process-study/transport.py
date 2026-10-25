"""Authenticate and preserve recorded transport with current pinned repository readers; never run archived implementations or grant performance acceptance."""
import datetime
import gzip
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import shutil
import sys
import types
import zipfile

if sys.flags.optimize:
    raise RuntimeError('Combined transport requires non-optimized Python')

METHOD = Path(__file__).resolve().parent
POLICY = json.loads((METHOD / 'constants/transport.json').read_bytes())
CAPTURE = json.loads((METHOD / 'constants/capture.json').read_bytes())
PROTOCOL = json.loads((METHOD / 'constants/protocol.json').read_bytes())


def digest(filename):
    """Hash a stream with bounded buffers; JSON decoding and binary transport have different bounds."""
    value = hashlib.sha256()
    with filename.open('rb') as source:
        for chunk in iter(lambda: source.read(CAPTURE['hashChunkBytes']), b''):
            value.update(chunk)
    return value.hexdigest()


def validate_binding(binding, pinned=False):
    """Validate caller-owned run selection once; no identities are inferred from an untrusted capture."""
    assert binding['repository'] == POLICY['repository']
    for field in ['runId', 'jobId']:
        assert type(binding[field]) is int and binding[field] > 0
    assert binding['attempt'] == 1 and re.fullmatch(r'[a-f0-9]{40}', binding['head'])
    assert binding['workflow'].startswith('.github/workflows/') and binding['workflow'].endswith('.yml')
    for field in ['tarName', 'rootName']:
        name = binding[field]
        assert isinstance(name, str) and name and PurePosixPath(name).name == name
        assert name not in ['.', '..'] and '\\' not in name and ':' not in name
    assert isinstance(binding['artifactName'], str) and binding['artifactName']
    if pinned:
        assert type(binding['artifactId']) is int and binding['artifactId'] > 0
        for field in ['zipSha256', 'tarSha256']:
            assert re.fullmatch(r'[a-f0-9]{64}', binding[field])
        for field in ['zipBytes', 'tarBytes']:
            assert type(binding[field]) is int and binding[field] > 0


def method_identity(repository):
    """Expose the current independent reviewed declaration for an activation binding, never from downloaded data."""
    receipt = repository / CAPTURE['publicationReceipt']
    reviewed = json.loads(receipt.read_bytes())
    assert reviewed['revision'] == PROTOCOL['revision'] and reviewed['actionableFindings'] == 0
    assert reviewed['completeMethodReview'] is True and reviewed['executionReady'] == PROTOCOL['executionReady']
    canonical = json.dumps(sorted(reviewed['files'].items()), ensure_ascii=False, separators=(',', ':')).encode()
    checksum = hashlib.sha256(canonical).hexdigest()
    assert checksum == reviewed['methodFilesSha256']
    return {'revision': PROTOCOL['revision'], 'publicationSha256': digest(receipt), 'methodFilesSha256': checksum,
            'performanceAccepted': None, 'gateReevaluated': False}


def current_binding(binding, repository=METHOD.parents[3]):
    """Fixed public CLI scope: historical profiles are usable only as transport contracts, never as this study."""
    validate_binding(binding)
    assert binding['revision'] == PROTOCOL['revision'] and binding['workflow'] == CAPTURE['workflow']
    assert binding['tarName'] == POLICY['tarName'] and binding['rootName'] == POLICY['rootName']
    assert binding['artifactName'] == POLICY['artifactPrefix'] + binding['head'] + '-attempt1'
    identity = method_identity(repository)
    assert identity['publicationSha256'] == binding['publicationSha256']
    assert identity['methodFilesSha256'] == binding['methodFilesSha256']
    return binding


def load_current(repository, descriptor, name):
    """Compile only independently hash-pinned current repository bytes, never code recovered from an artifact or pyc."""
    for dependency in descriptor.get('dependencies', []):
        assert digest(repository / dependency['path']) == dependency['sha256']
    filename = repository / descriptor['path']; content = filename.read_bytes()
    assert hashlib.sha256(content).hexdigest() == descriptor['sha256']
    module = types.ModuleType(name); module.__file__ = str(filename)
    exec(compile(content, str(filename), 'exec'), module.__dict__)
    return module


def current_reader(repository, binding):
    """Specialize the existing reviewed transport adapter for one immutable run/job/source tuple."""
    validate_binding(binding)
    reader = load_current(repository, POLICY['reader'], 'current_combined_transport_reader')
    reader.POLICY = {**binding, 'artifactId': binding.get('artifactId'),
                     'ownerFile': POLICY['ownerFile'], 'collectorRevision': POLICY['revision']}
    for attribute, field in [('RUN_ID', 'runId'), ('JOB_ID', 'jobId'), ('HEAD', 'head'), ('WORKFLOW', 'workflow'),
                             ('ARTIFACT_NAME', 'artifactName'), ('TAR_NAME', 'tarName')]:
        setattr(reader, attribute, binding[field])
    original_run = reader.authenticate_run
    original_artifact = reader.authenticate_artifact

    def authenticate_run(run, jobs):
        original_run(run, jobs)
        job = jobs['jobs'][0]
        assert job['run_id'] == binding['runId'] and job['head_sha'] == binding['head']
        assert job['run_attempt'] == 1 and job['name'] == CAPTURE['jobKey']

    def authenticate_artifact(artifact, filename):
        original_artifact(artifact, filename)
        if binding.get('zipSha256') is not None:
            assert artifact['digest'] == 'sha256:' + binding['zipSha256']
        if binding.get('zipBytes') is not None:
            assert artifact['size_in_bytes'] == binding['zipBytes']

    reader.authenticate_run = authenticate_run; reader.authenticate_artifact = authenticate_artifact
    return reader


def ownership(binding):
    return {'collector': POLICY['revision'], 'runId': binding['runId'], 'jobId': binding['jobId'],
            'head': binding['head'], 'attempt': 1}


def assert_owned(output, binding):
    """Refuse foreign directories and file-level aliases before any network request or metadata write."""
    assert not output.is_symlink() and not getattr(output, 'is_junction', lambda: False)()
    if not output.exists():
        return
    assert output.is_dir()
    if any(output.iterdir()):
        marker = output / POLICY['ownerFile']
        assert marker.is_file() and not marker.is_symlink() and marker.stat().st_nlink == 1
        assert json.loads(marker.read_bytes()) == ownership(binding), 'Combined transport: preserve foreign collection'
    for name in POLICY['mutableFiles'] + [binding['tarName']]:
        filename = output / name
        if filename.exists() or filename.is_symlink():
            assert not filename.is_symlink() and filename.is_file() and filename.stat().st_nlink == 1
    for name in ['observations', 'partials']:
        directory = output / name
        assert not directory.is_symlink() and not getattr(directory, 'is_junction', lambda: False)()
        assert not directory.exists() or directory.is_dir()


def snapshot(output, completed, stage):
    """Preserve every observation without replacing its predecessors or attributing it to a different run."""
    history = output / 'observations'; history.mkdir(exist_ok=True)
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
    destination = history / (stamp + '-' + stage); destination.mkdir()
    for name in POLICY['metadataFiles']:
        source = output / name
        if source.is_file():
            shutil.copyfile(source, destination / name)
    (destination / 'reader.json').write_text(json.dumps({'readerCompleted': completed, 'stage': stage,
        'collectorExecutedDOM': False, 'archivedCodeExecuted': False, 'performanceAccepted': None,
        'gateReevaluated': False}, indent=2) + '\n', encoding='utf-8', newline='\n')
    return destination


def rotate_partials(output, binding):
    """Keep interrupted byte downloads before retrying only the same transport, never a measurement."""
    names = ['artifact.zip.part', 'job.log.part']
    tar = output / binding['tarName']
    if tar.exists():
        expected_bytes = binding.get('tarBytes'); expected_sha256 = binding.get('tarSha256')
        if expected_bytes is None or expected_sha256 is None:
            archive_path = output / 'artifact.zip'
            if archive_path.exists():
                with zipfile.ZipFile(archive_path) as archive:
                    assert archive.namelist() == [binding['tarName']]
                    expected_bytes = archive.getinfo(binding['tarName']).file_size
                    checksum = hashlib.sha256()
                    with archive.open(binding['tarName']) as source:
                        for chunk in iter(lambda: source.read(CAPTURE['hashChunkBytes']), b''):
                            checksum.update(chunk)
                    expected_sha256 = checksum.hexdigest()
        if expected_bytes is None or expected_sha256 is None or tar.stat().st_size != expected_bytes or digest(tar) != expected_sha256:
            names.append(binding['tarName'])
    for name in names:
        source = output / name
        if source.exists():
            target_root = output / 'partials'; target_root.mkdir(exist_ok=True)
            target = target_root / (datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ') + '-' + name)
            assert source.resolve(strict=True).is_relative_to(output)
            assert target.parent.resolve(strict=True).is_relative_to(output) and not target.exists()
            source.rename(target)


def collect(repository, output, binding, download=False):
    """Observe only the declared run; transport retries retain old bytes and never call a workflow activation API."""
    repository = repository.resolve(strict=True); output = output.parent.resolve(strict=True) / output.name
    validate_binding(binding); assert_owned(output, binding)
    reader = current_reader(repository, binding)
    if output.exists() and any(output.iterdir()):
        snapshot(output, False, 'before')
    if download and output.exists():
        rotate_partials(output, binding)
    completed = False
    try:
        result = reader.collect(repository, output, download)
        if result.get('transportAuthenticated'):
            if binding.get('tarSha256') is not None: assert result['tarSha256'] == binding['tarSha256']
            if binding.get('tarBytes') is not None: assert result['tarBytes'] == binding['tarBytes']
        completed = True; return result
    finally:
        if output.exists() and (output / POLICY['ownerFile']).exists():
            assert_owned(output, binding); snapshot(output, completed, 'after')


def verify_collection(repository, collection, binding):
    """Verify recorded byte transport against independently retained pins. This never replays DOM or accepts timing criteria."""
    validate_binding(binding, pinned=True)
    assert not collection.is_symlink() and not getattr(collection, 'is_junction', lambda: False)()
    for name in ['run.json', 'jobs.json', 'artifacts.json', 'collection.json', 'artifact.zip', binding['tarName']]:
        filename = collection / name
        assert not filename.is_symlink() and filename.is_file() and filename.stat().st_nlink == 1
    reader = current_reader(repository, binding)
    run = json.loads((collection / 'run.json').read_bytes()); jobs = json.loads((collection / 'jobs.json').read_bytes())
    reader.authenticate_run(run, jobs)
    assert run['status'] == 'completed' and jobs['jobs'][0]['status'] == 'completed'
    artifacts = json.loads((collection / 'artifacts.json').read_bytes())['artifacts']
    selected = [artifact for artifact in artifacts if artifact['id'] == binding['artifactId']]
    assert len(selected) == 1
    reader.authenticate_artifact(selected[0], collection / 'artifact.zip')
    state = json.loads((collection / 'collection.json').read_bytes())
    for name in ['runId', 'jobId', 'head', 'attempt', 'artifactId', 'zipBytes', 'zipSha256', 'tarBytes', 'tarSha256']:
        assert state[name] == binding[name]
    assert state['status'] == 'completed' and state['transportAuthenticated'] is True
    assert state['performanceAccepted'] is None and state['conclusion'] == run['conclusion']
    tar = collection / binding['tarName']
    assert tar.stat().st_size == binding['tarBytes'] and digest(tar) == binding['tarSha256']
    with zipfile.ZipFile(collection / 'artifact.zip') as archive:
        assert archive.getinfo(binding['tarName']).file_size == binding['tarBytes']
        checksum = hashlib.sha256()
        with archive.open(binding['tarName']) as source:
            for chunk in iter(lambda: source.read(CAPTURE['hashChunkBytes']), b''):
                checksum.update(chunk)
        assert checksum.hexdigest() == binding['tarSha256']
    return {'transportAuthenticated': True, 'runId': binding['runId'], 'jobId': binding['jobId'], 'head': binding['head'],
        'attempt': 1, 'artifactId': binding['artifactId'], 'runConclusion': run['conclusion'],
        'jobConclusion': jobs['jobs'][0]['conclusion'], 'collectorExecutedDOM': False,
        'performanceAccepted': None, 'gateReevaluated': False}


def extract(repository, collection, destination, binding):
    """Read the authenticated complete archive on Linux/WSL using the current pinned safe extractor; preserve partial output on failure."""
    assert sys.platform == 'linux', 'Combined extraction: use Linux/WSL for original links and long data paths'
    verified = verify_collection(repository, collection, binding)
    destination = destination.parent.resolve(strict=True) / destination.name
    for protected in [repository.resolve(strict=True), collection.resolve(strict=True)]:
        assert not destination.is_relative_to(protected) and not protected.is_relative_to(destination)
    assert not destination.exists() and not destination.is_symlink(), 'Combined extraction: preserve existing output'
    manifest = destination.parent / (destination.name + '-members.json.gz')
    assert not manifest.exists() and not manifest.is_symlink(), 'Combined extraction: preserve existing manifest'
    module = load_current(repository, POLICY['extractor'], 'current_combined_safe_extractor')
    members = module.extract_archive(collection / binding['tarName'], destination, {binding['rootName']})
    with manifest.open('xb') as output:
        output.write(gzip.compress((json.dumps(members, indent=2) + '\n').encode(), mtime=0))
    return {**verified, 'root': str(destination / binding['rootName']), 'members': len(members),
        'regularFiles': sum(member['kind'] == 'file' for member in members),
        'rawRegularBytes': sum(member.get('bytes', 0) for member in members),
        'links': sum(member['kind'] in ['symlink', 'hardlink'] for member in members),
        'memberManifest': str(manifest), 'archivedCodeExecuted': False}


if __name__ == '__main__':
    if len(sys.argv) == 3 and sys.argv[1] == POLICY['methodIdentityOperation']:
        print(json.dumps(method_identity(Path(sys.argv[2]).resolve(strict=True))))
        sys.exit(0)
    assert len(sys.argv) in [5, 6], 'Provide operation, repository, binding JSON, collection and optional extraction destination'
    operation, repository, binding_file, collection = sys.argv[1:5]
    repository = Path(repository).resolve(strict=True); binding = current_binding(json.loads(Path(binding_file).read_bytes()), repository)
    if operation == '--observe': result = collect(repository, Path(collection), binding)
    elif operation == '--collect': result = collect(repository, Path(collection), binding, True)
    elif operation == '--verify': result = verify_collection(repository, Path(collection), binding)
    else:
        assert operation == '--extract' and len(sys.argv) == 6
        result = extract(repository, Path(collection), Path(sys.argv[5]), binding)
    print(json.dumps(result))
