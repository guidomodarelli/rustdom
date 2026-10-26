"""Authenticate current functional CI artifacts and read package data without executing archived helpers."""
import hashlib
import json
from pathlib import Path, PurePosixPath
import stat
import sys
import zipfile

if sys.flags.optimize:
    raise RuntimeError('Combined artifact reader: requires non-optimized Python')

POLICY = json.loads((Path(__file__).parent / 'constants/reader.json').read_bytes())
SELECTION = json.loads((Path(__file__).parent / 'constants/selection.json').read_bytes())
BINDING = json.loads((Path(__file__).parent / 'constants/artifact-binding.json').read_bytes())


def digest(filename):
    """Hash original transport bytes without serialization or newline normalization."""
    checksum = hashlib.sha256()
    with filename.open('rb') as stream:
        for chunk in iter(lambda: stream.read(POLICY['readChunkBytes']), b''):
            checksum.update(chunk)
    return checksum.hexdigest()


def inspect_artifact(repository, archive_path, metadata):
    """Read one authenticated qualified Linux/Node24 artifact; this alone does not qualify its complete matrix."""
    repository = repository.resolve(strict=True)
    manifest_path = repository / POLICY['sourceManifestPath']
    assert digest(manifest_path) == POLICY['sourceManifestSha256'], 'Combined artifact reader: candidate manifest changed'
    manifest = json.loads(manifest_path.read_bytes())
    assert archive_path.stat().st_size == metadata['size_in_bytes'], 'Combined artifact reader: ZIP size mismatch'
    assert 'sha256:' + digest(archive_path) == metadata['digest'], 'Combined artifact reader: ZIP digest mismatch'
    with zipfile.ZipFile(archive_path) as archive:
        assert archive.testzip() is None, 'Combined artifact reader: ZIP integrity failure'
        members = {}
        for member in archive.infolist():
            relative = PurePosixPath(member.filename)
            assert not relative.is_absolute() and '..' not in relative.parts and '\\' not in member.filename
            assert member.filename not in members, 'Combined artifact reader: duplicate ZIP member'
            assert not stat.S_ISLNK(member.external_attr >> 16), 'Combined artifact reader: archive links are unsupported'
            members[member.filename] = member
        qualifications = [name for name in members if name.endswith(POLICY['qualificationSuffix'])]
        assert len(qualifications) == 1, 'Combined artifact reader: ambiguous qualification'
        qualification = json.loads(archive.read(qualifications[0]))
        assert qualification['qualified'] and qualification['platform'] == POLICY['platform']
        assert qualification['node'] == POLICY['node'] and not qualification['sourceGitErrors']
        assert qualification['sourceCommit'] == manifest['baseCommit']
        assert qualification['preparedSource']['sourceFiles'] == manifest['sources']
        assert qualification['preparedSource']['patchSha256'] == manifest['patchSha256']
        assert len(qualification['commands']) == 22
        assert all(command['exitCode'] == 0 and not command['timedOut'] for command in qualification['commands'])
        assert qualification['performanceAccepted'] is None and not qualification['gateReevaluated']
        candidates = [name for name in members if name.endswith(POLICY['candidatePrefixSuffix'] + POLICY['nativeMetadata'])]
        assert len(candidates) == 1, 'Combined artifact reader: ambiguous candidate distribution'
        prefix = candidates[0][:-len(POLICY['nativeMetadata'])]
        native = json.loads(archive.read(prefix + POLICY['nativeMetadata']))
        for field in ['platform', 'arch', 'node']:
            assert native[field] == POLICY[field], 'Combined artifact reader: native ' + field + ' differs'
        assert native['glibcBuildVersion'] == POLICY['glibc'] and native['libc'] == 'glibc'
        assert native['binarySha256'] == qualification['nativeBuild']['binarySha256']
        assert hashlib.sha256(archive.read(prefix + POLICY['nativeBinary'])).hexdigest() == native['binarySha256']
        assert native['cargoLockSha256'] == manifest['buildInputs']['Cargo.lock']
        for relative, expected in manifest['buildInputs'].items():
            assert hashlib.sha256(archive.read(prefix + relative)).hexdigest() == expected, relative
        for relative, expected in manifest['sources'].items():
            if any(relative.startswith(value) for value in POLICY['expectedSourcePrefixes']):
                assert hashlib.sha256(archive.read(prefix + relative)).hexdigest() == expected, relative
        selected = []
        for name, member in members.items():
            if not name.startswith(prefix) or member.is_dir():
                continue
            relative = name[len(prefix):]
            if relative in POLICY['selectedFiles'] or any(relative.startswith(value) for value in POLICY['selectedPrefixes']):
                selected.append({'path': relative, 'archivePath': name, 'bytes': member.file_size,
                                 'sha256': hashlib.sha256(archive.read(name)).hexdigest()})
    return {'artifactId': metadata['id'], 'run': metadata['workflow_run']['id'],
            'hostedHead': metadata['workflow_run']['head_sha'], 'zipSha256': metadata['digest'].split(':', 1)[1],
            'prefix': prefix, 'selectedFiles': sorted(selected, key=lambda member: member['path']),
            'binarySha256': native['binarySha256'], 'qualification': qualification,
            'runtimeExecuted': False, 'rustRebuilt': False, 'benchmarkExecuted': False, 'performanceAccepted': None}


def inspect_collection(repository, collection):
    """Require the entire fixed six-job matrix before selecting its predeclared artifact, without fallback."""
    assert BINDING['complete'], 'Combined artifact reader: independent artifact binding is not published yet'
    for relative, expected in BINDING['collectionFiles'].items():
        assert digest(collection / relative) == expected, 'Combined artifact reader: changed authenticated receipt ' + relative
    run = json.loads((collection / 'run.json').read_bytes())
    assert run['id'] == SELECTION['run'] and run['head_sha'] == SELECTION['head']
    assert run['run_attempt'] == SELECTION['attempt'], 'Combined artifact reader: unexpected workflow attempt'
    assert run['status'] == 'completed' and run['conclusion'] == 'success', 'Combined artifact reader: matrix is not qualified'
    jobs = json.loads((collection / 'jobs.json').read_bytes())
    assert jobs['total_count'] == SELECTION['requiredQualifiedJobs'] and len(jobs['jobs']) == jobs['total_count']
    assert all(job['status'] == 'completed' and job['conclusion'] == 'success' for job in jobs['jobs'])
    artifacts = json.loads((collection / 'artifacts.json').read_bytes())
    candidates = [item for item in artifacts['artifacts'] if item['name'] == SELECTION['profile']['artifactName']]
    assert len(candidates) == 1, 'Combined artifact reader: selected artifact is absent or ambiguous'
    metadata = candidates[0]
    assert metadata['id'] == BINDING['artifactId'], 'Combined artifact reader: unexpected bound artifact'
    assert metadata['digest'] == BINDING['digest'] and metadata['size_in_bytes'] == BINDING['bytes']
    assert metadata['workflow_run']['id'] == SELECTION['run']
    assert metadata['workflow_run']['head_sha'] == SELECTION['head']
    result = inspect_artifact(repository, collection / ('artifact-' + str(metadata['id'])) / 'artifact.zip', metadata)
    assert result['binarySha256'] == BINDING['binarySha256'], 'Combined artifact reader: unexpected bound native binary'
    return {**result, 'attempt': run['run_attempt'], 'matrixQualified': True}


if __name__ == '__main__':
    assert len(sys.argv) == 3, 'Provide repository and authenticated complete CI collection'
    print(json.dumps(inspect_collection(Path(sys.argv[1]), Path(sys.argv[2]))))
