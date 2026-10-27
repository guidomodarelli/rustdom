"""Read the fixed six-job owner-batch qualification and its selected runtime without executing archive code."""
import hashlib
import json
from pathlib import Path, PurePosixPath
import stat
import sys
import zipfile

if sys.flags.optimize:
    raise RuntimeError('Owner batch artifact reader requires non-optimized Python')
POLICY = json.loads((Path(__file__).parent / 'constants/artifact.json').read_bytes())


def digest(filename):
    """Hash raw transport bytes in bounded chunks, without normalization."""
    checksum = hashlib.sha256()
    with filename.open('rb') as stream:
        for chunk in iter(lambda: stream.read(POLICY['readChunkBytes']), b''):
            checksum.update(chunk)
    return checksum.hexdigest()


def inspect_collection(repository, collection):
    """Require the complete prospectively selected matrix and preserve the actual compiler identity and diagnostics."""
    repository = repository.resolve(strict=True)
    collection = collection.resolve(strict=True)
    manifest_file = repository / POLICY['sourceManifestPath']
    assert digest(manifest_file) == POLICY['sourceManifestSha256'], 'Owner batch artifact: changed source manifest'
    manifest = json.loads(manifest_file.read_bytes())
    for relative, expected in POLICY['collectionFiles'].items():
        filename = collection / relative
        assert filename.is_file() and not filename.is_symlink(), 'Owner batch artifact: physical collection member required ' + relative
        assert digest(filename) == expected, 'Owner batch artifact: changed collection member ' + relative
    run = json.loads((collection / 'run.json').read_bytes())
    assert run['id'] == POLICY['run'] and run['head_sha'] == POLICY['head'] and run['run_attempt'] == POLICY['attempt']
    assert run['status'] == 'completed' and run['conclusion'] == 'success', 'Owner batch artifact: incomplete matrix'
    jobs = json.loads((collection / 'jobs.json').read_bytes())
    assert jobs['total_count'] == len(jobs['jobs']) == POLICY['requiredJobs']
    assert all(job['status'] == 'completed' and job['conclusion'] == 'success' for job in jobs['jobs'])
    assert {job['id'] for job in jobs['jobs']} == set(POLICY['jobs'])
    artifacts = json.loads((collection / 'artifacts.json').read_bytes())
    assert artifacts['total_count'] == len(artifacts['artifacts']) == POLICY['requiredJobs']
    assert {item['id'] for item in artifacts['artifacts']} == {item['id'] for item in POLICY['artifacts']}
    selected = None
    qualifications = []
    for binding in POLICY['artifacts']:
        metadata = next(item for item in artifacts['artifacts'] if item['id'] == binding['id'])
        assert metadata == json.loads((collection / ('artifact-' + str(binding['id'])) / 'metadata.json').read_bytes())
        for field in ['id', 'name', 'digest', 'size_in_bytes']:
            assert metadata[field] == binding[field], 'Owner batch artifact: changed artifact ' + field
        assert metadata['workflow_run']['id'] == POLICY['run'] and metadata['workflow_run']['head_sha'] == POLICY['head']
        archive_path = collection / ('artifact-' + str(binding['id'])) / 'artifact.zip'
        assert archive_path.stat().st_size == binding['size_in_bytes']
        assert 'sha256:' + digest(archive_path) == binding['digest']
        with zipfile.ZipFile(archive_path) as archive:
            assert archive.testzip() is None, 'Owner batch artifact: corrupt ZIP'
            members = {}
            for entry in archive.infolist():
                relative = PurePosixPath(entry.filename)
                assert not relative.is_absolute() and '..' not in relative.parts and '\\' not in entry.filename
                assert entry.filename not in members, 'Owner batch artifact: duplicate ZIP member'
                assert not stat.S_ISLNK(entry.external_attr >> 16), 'Owner batch artifact: archive links unsupported'
                members[entry.filename] = entry
            candidates = [name for name in members if name.endswith(POLICY['qualificationSuffix'])]
            assert len(candidates) == 1, 'Owner batch artifact: ambiguous qualification'
            qualification = json.loads(archive.read(candidates[0]))
            assert qualification['qualified'] is True and qualification['extraConsumersPending'] is False
            assert qualification['platform'] == binding['platform'] and qualification['node'] == binding['node']
            assert qualification['sourceCommit'] == manifest['baseCommit'] and qualification['sourceGitErrors'] == []
            assert isinstance(qualification['sourceChangesRaw'], str)
            assert qualification['sourceBeforeQualification']['sourceCommit'] == manifest['baseCommit']
            assert qualification['sourceBeforeQualification']['sourceGitErrors'] == []
            assert qualification['preparedSource']['sourceFiles'] == manifest['sources']
            assert qualification['preparedSource']['patchSha256'] == manifest['patchSha256']
            assert len(qualification['commands']) == POLICY['commandsPerJob']
            assert all(command['exitCode'] == 0 and command['timedOut'] is False for command in qualification['commands'])
            for field in ['runtimeIntegrated', 'benchmarkExecuted', 'gateReevaluated']:
                assert qualification[field] is False
            assert qualification['performanceAccepted'] is None
            qualifications.append({'artifactId': binding['id'], 'qualification': qualification})
            if binding['id'] != POLICY['selectedArtifactId']:
                continue
            prefix = POLICY['selectedPrefix']
            native = json.loads(archive.read(prefix + POLICY['nativeMetadata']))
            assert native == qualification['nativeBuild']
            for field, expected in POLICY['nativeProfile'].items():
                assert native[field] == expected, 'Owner batch artifact: changed native profile ' + field
            assert hashlib.sha256(archive.read(prefix + POLICY['nativeBinary'])).hexdigest() == native['binarySha256']
            for relative, expected in manifest['buildInputs'].items():
                assert hashlib.sha256(archive.read(prefix + relative)).hexdigest() == expected
            source_origins = {}
            for relative, expected in manifest['sources'].items():
                if relative == POLICY['missingCompilerSource']:
                    paths = [name for name in members if name.endswith(POLICY['fixtureSourceSuffix'])]
                    assert len(paths) == POLICY['fixtureSourceCopies']
                    assert prefix + relative not in members
                    for name in paths:
                        assert hashlib.sha256(archive.read(name)).hexdigest() == expected
                    source_origins[relative] = {'compilerCheckoutPresent': False, 'fixtureCopies': paths, 'sha256': expected}
                else:
                    assert hashlib.sha256(archive.read(prefix + relative)).hexdigest() == expected
                    source_origins[relative] = {'compilerCheckoutPresent': True, 'archivePath': prefix + relative, 'sha256': expected}
            files = []
            for name, entry in members.items():
                if entry.is_dir() or not name.startswith(prefix):
                    continue
                relative = name[len(prefix):]
                if relative in POLICY['selectedFiles'] or any(relative.startswith(part) for part in POLICY['selectedPrefixes']):
                    files.append({'path': relative, 'archivePath': name, 'bytes': entry.file_size,
                                  'sha256': hashlib.sha256(archive.read(name)).hexdigest()})
            assert len(files) == POLICY['selectedRuntimeFiles']
            selected = {'artifactId': binding['id'], 'zipSha256': binding['digest'].split(':', 1)[1],
                        'binarySha256': native['binarySha256'], 'selectedFiles': sorted(files, key=lambda entry: entry['path']),
                        'compilerSourceOrigins': source_origins, 'qualification': qualification}
    assert selected is not None
    return {**selected, 'revision': POLICY['revision'], 'run': run['id'], 'attempt': run['run_attempt'],
            'hostedHead': run['head_sha'], 'matrixQualified': True, 'qualifications': qualifications,
            'runtimeExecuted': False, 'installExecuted': False, 'rustRebuilt': False,
            'benchmarkExecuted': False, 'performanceAccepted': None, 'gateReevaluated': False}


if __name__ == '__main__':
    assert len(sys.argv) == 3, 'Provide repository and authenticated CI collection'
    print(json.dumps(inspect_collection(Path(sys.argv[1]), Path(sys.argv[2]))))
