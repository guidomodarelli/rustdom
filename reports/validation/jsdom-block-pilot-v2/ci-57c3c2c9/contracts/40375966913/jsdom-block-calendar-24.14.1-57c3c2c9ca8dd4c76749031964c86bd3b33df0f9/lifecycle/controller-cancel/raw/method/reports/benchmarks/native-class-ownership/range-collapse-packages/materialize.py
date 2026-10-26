"""Copy only the declared runtime data from the pinned hosted ZIP; never execute archived helpers."""
import hashlib
import json
from pathlib import Path, PurePosixPath
import stat
import sys
import zipfile

if sys.flags.optimize:
    raise RuntimeError('Range package materialization requires non-optimized Python')

POLICY = json.loads((Path(__file__).parent / 'constants/packages.json').read_text(encoding='utf-8'))


def digest(filename):
    """Hash existing bytes without importing or rewriting them."""
    checksum = hashlib.sha256()
    with filename.open('rb') as content:
        for chunk in iter(lambda: content.read(1024 * 1024), b''):
            checksum.update(chunk)
    return checksum.hexdigest()


def inspect_archive(repository, output=None):
    """Authenticate all members, optionally materializing the declared runtime without overwriting anything."""
    repository = repository.resolve(strict=True)
    if output is not None:
        output = output.parent.resolve(strict=True) / output.name
        assert not output.exists() and not output.is_symlink(), 'Range package materialization: preserve existing output'
        assert repository != output and repository not in output.parents and output not in repository.parents
    for entry in POLICY['qualification'].values():
        assert digest(repository / entry['path']) == entry['sha256']
    pinned = POLICY['artifact']
    metadata = json.loads((repository / pinned['metadataPath']).read_bytes())
    assert metadata['id'] == pinned['id'] and metadata['name'] == pinned['name']
    assert metadata['workflow_run']['id'] == POLICY['runId'] and metadata['workflow_run']['head_sha'] == POLICY['hostedHead']
    assert metadata['size_in_bytes'] == pinned['zipBytes'] and metadata['digest'] == 'sha256:' + pinned['zipSha256']
    filename = repository / pinned['zipPath']
    assert filename.stat().st_size == pinned['zipBytes'] and digest(filename) == pinned['zipSha256']
    with zipfile.ZipFile(repository / POLICY['qualification']['profiles.zip']['path']) as profiles:
        members = json.loads(profiles.read(POLICY['artifactMemberPath']))
    expected = {entry['path']: entry for entry in members}
    with zipfile.ZipFile(filename) as archive:
        assert len(archive.infolist()) == len(expected) and archive.testzip() is None
        selected = []
        seen = set()
        for member in archive.infolist():
            relative = PurePosixPath(member.filename)
            assert member.filename not in seen and member.filename in expected
            seen.add(member.filename)
            assert not relative.is_absolute() and '..' not in relative.parts and '\\' not in member.filename
            assert not stat.S_ISLNK(member.external_attr >> 16)
            original = expected[member.filename]
            assert original['bytes'] == member.file_size
            if member.is_dir():
                assert original['kind'] == 'directory'
                continue
            checksum = hashlib.sha256()
            with archive.open(member) as content:
                for chunk in iter(lambda: content.read(1024 * 1024), b''):
                    checksum.update(chunk)
            assert original['kind'] == 'file' and checksum.hexdigest() == original['sha256']
            if member.filename in POLICY['selectedFiles'] or any(member.filename.startswith(prefix) for prefix in POLICY['selectedPrefixes']):
                selected.append(original)
        assert seen == set(expected)
        assert expected['dist/rustdom.node']['sha256'] == POLICY['binarySha256']
        assert expected['package.json']['sha256'] == POLICY['packageSha256']
        assert expected['package-lock.json']['sha256'] == POLICY['lockSha256']
        if output is not None:
            output.mkdir()
            for member in selected:
                target = output / member['path']
                target.parent.mkdir(parents=True, exist_ok=True)
                with archive.open(member['path']) as content, target.open('xb') as destination:
                    for chunk in iter(lambda: content.read(1024 * 1024), b''):
                        destination.write(chunk)
                assert digest(target) == member['sha256']
    return {'revision': POLICY['revision'], 'runId': POLICY['runId'], 'head': POLICY['hostedHead'],
        'attempt': POLICY['attempt'], 'artifactId': pinned['id'], 'zipSha256': pinned['zipSha256'],
        'selectedFiles': selected, 'complete': True, 'runtimeExecuted': False, 'rustRebuilt': False,
        'performanceAccepted': None}


if __name__ == '__main__':
    assert len(sys.argv) == 3, 'Provide reviewed repository and fresh independent package destination'
    if sys.argv[1] == POLICY['operations']['manifest']:
        print(json.dumps(inspect_archive(Path(sys.argv[2]))))
    else:
        print(json.dumps(inspect_archive(Path(sys.argv[1]), Path(sys.argv[2]))))
