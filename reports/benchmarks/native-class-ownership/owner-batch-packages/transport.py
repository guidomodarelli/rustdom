"""Verify and extract only the independently bound data package, never archived Python/JavaScript helpers."""
import hashlib
import json
from pathlib import Path, PurePosixPath
import sys
import tarfile
import runpy

ARTIFACT_SOURCE = Path(__file__).with_name('artifact.py')
assert ARTIFACT_SOURCE.is_file() and not ARTIFACT_SOURCE.is_symlink()
digest = runpy.run_path(str(ARTIFACT_SOURCE))['digest']

if sys.flags.optimize:
    raise RuntimeError('Owner batch transport requires non-optimized Python')
SOURCE = Path(__file__).resolve().parent
REPOSITORY = SOURCE.parents[3]
POLICY = json.loads((SOURCE / 'constants/transport.json').read_bytes())


def verify(archive):
    """Read every tar member against a committed external manifest and reject changed bytes, names, types or links."""
    manifest_file = REPOSITORY / POLICY['manifestPath']
    assert digest(manifest_file) == POLICY['manifestSha256'], 'Owner batch transport: changed external manifest'
    manifest = json.loads(manifest_file.read_bytes())
    assert manifest['complete'] is True and manifest['performanceAccepted'] is None and manifest['gateReevaluated'] is False
    binding = manifest['archive']
    assert archive.is_file() and not archive.is_symlink()
    assert archive.stat().st_size == binding['bytes'] and digest(archive) == binding['sha256'], 'Owner batch transport: changed archive'
    expected = {entry['path']: entry for entry in manifest['members']}
    assert len(expected) == len(manifest['members']) == POLICY['members']
    actual = {}; root_seen = False
    with tarfile.open(archive, 'r:xz') as stream:
        for entry in stream:
            if entry.name == binding['root']:
                assert entry.isdir() and not root_seen
                root_seen = True; continue
            assert entry.name.startswith(binding['root'] + '/')
            relative = entry.name[len(binding['root']) + 1:]
            member = PurePosixPath(relative)
            assert not member.is_absolute() and '..' not in member.parts and '\\' not in relative and ':' not in relative
            assert relative not in actual and relative in expected
            if entry.isdir():
                value = {'path': relative, 'kind': 'directory'}
            elif entry.issym():
                assert not PurePosixPath(entry.linkname).is_absolute()
                value = {'path': relative, 'kind': 'symlink', 'target': entry.linkname}
            else:
                assert entry.isfile(), 'Owner batch transport: unsupported member type'
                with stream.extractfile(entry) as reader:
                    checksum = hashlib.sha256()
                    for chunk in iter(lambda: reader.read(POLICY['readChunkBytes']), b''):
                        checksum.update(chunk)
                value = {'path': relative, 'kind': 'file', 'bytes': entry.size, 'sha256': checksum.hexdigest()}
            assert value == expected[relative], 'Owner batch transport: changed member ' + relative
            actual[relative] = value
    assert root_seen and actual == expected
    assert sum(entry['kind'] == 'symlink' for entry in actual.values()) == POLICY['links']
    return {'verified': True, 'archiveSha256': binding['sha256'], 'members': len(actual),
            'links': POLICY['links'], 'runtimeExecuted': False, 'benchmarkExecuted': False,
            'performanceAccepted': None, 'gateReevaluated': False}


def extract(archive, destination):
    """Extract data into a fresh disjoint Linux directory; physical members first, internal links last, no overwrite/retry."""
    assert sys.platform == 'linux', 'Owner batch transport: relative package links require Linux'
    receipt = verify(archive)
    destination = destination.parent.resolve(strict=True) / destination.name
    assert not destination.exists() and not destination.is_symlink(), 'Owner batch transport: preserve existing output'
    for protected in [REPOSITORY, archive.resolve(strict=True)]:
        assert destination != protected and not destination.is_relative_to(protected) and not protected.is_relative_to(destination)
    manifest = json.loads((REPOSITORY / POLICY['manifestPath']).read_bytes())
    expected = {entry['path']: entry for entry in manifest['members']}
    # No archive path may place a regular member below one of the declared symlinks.
    for relative in expected:
        assert all(expected.get(parent.as_posix(), {}).get('kind') != 'symlink' for parent in PurePosixPath(relative).parents)
    destination.mkdir()
    links = []; seen = set(); root_seen = False
    with tarfile.open(archive, 'r:xz') as stream:
        for entry in stream:
            if entry.name == manifest['archive']['root']:
                assert entry.isdir() and not root_seen
                root_seen = True
                continue
            assert entry.name.startswith(manifest['archive']['root'] + '/')
            relative = entry.name[len(manifest['archive']['root']) + 1:]
            assert relative in expected and relative not in seen, 'Owner batch transport: archive changed after verification'
            seen.add(relative)
            declared = expected[relative]
            target = destination / relative
            if entry.isdir():
                assert declared['kind'] == 'directory'
                target.mkdir(parents=True, exist_ok=True)
            elif entry.issym():
                assert declared['kind'] == 'symlink' and entry.linkname == declared['target']
                links.append((target, entry.linkname))
            else:
                assert entry.isfile() and declared['kind'] == 'file' and entry.size == declared['bytes']
                target.parent.mkdir(parents=True, exist_ok=True)
                with stream.extractfile(entry) as reader, target.open('xb') as writer:
                    for chunk in iter(lambda: reader.read(POLICY['readChunkBytes']), b''):
                        writer.write(chunk)
                assert digest(target) == expected[relative]['sha256']
    assert root_seen and seen == set(expected)
    assert digest(archive) == manifest['archive']['sha256'], 'Owner batch transport: archive changed during extraction'
    for target, link in links:
        assert (target.parent / link).resolve(strict=True).is_relative_to(destination), 'Owner batch transport: external resolution link'
        target.symlink_to(link, target_is_directory=(target.parent / link).is_dir())
    return {**receipt, 'extracted': True, 'destination': str(destination)}


if __name__ == '__main__':
    if len(sys.argv) == 3 and sys.argv[1] == '--verify':
        print(json.dumps(verify(Path(sys.argv[2]))))
    else:
        assert len(sys.argv) == 4 and sys.argv[1] == '--extract', 'Provide --verify archive or --extract archive new-output'
        print(json.dumps(extract(*map(Path, sys.argv[2:]))))
