"""Materialize authenticated ZIP/tar data without importing or executing any archived implementation."""
import hashlib
import json
from pathlib import Path
import sys
import tarfile
import types
import zipfile

TRANSPORT_SOURCE = Path(__file__).with_name('transport.py')
assert TRANSPORT_SOURCE.is_file() and not TRANSPORT_SOURCE.is_symlink()
TRANSPORT_BYTES = TRANSPORT_SOURCE.read_bytes()
current_transport = types.ModuleType('current_owner_batch_transport')
current_transport.__file__ = str(TRANSPORT_SOURCE)
current_transport._SOURCE_SHA256 = hashlib.sha256(TRANSPORT_BYTES).hexdigest()
exec(compile(TRANSPORT_BYTES, str(TRANSPORT_SOURCE), 'exec'), current_transport.__dict__)
POLICY = current_transport.POLICY
digest, read_json, safe_name = current_transport.digest, current_transport.read_json, current_transport.safe_name
verify_collection, write_json = current_transport.verify_collection, current_transport.write_json
assert digest(TRANSPORT_SOURCE) == current_transport._SOURCE_SHA256

if sys.flags.optimize:
    raise RuntimeError('Owner batch extraction requires non-optimized Python')


def read_tar(filename, root_name, destination=None):
    """Read every physical tar member, optionally into a new tree; reject aliases, links, devices and escapes."""
    assert safe_name(root_name).name == root_name
    names = set(); folded = set(); members = []; total = 0
    if destination is not None:
        assert sys.platform == 'linux', 'Owner batch extraction: use Linux for original long paths'
        assert not destination.exists() and not destination.is_symlink()
        destination.mkdir()
    with tarfile.open(filename, 'r:xz') as archive:
        for entry in archive:
            relative = safe_name(entry.name)
            assert relative.parts[0] == root_name, 'Owner batch extraction: unexpected archive root'
            canonical = str(relative)
            assert canonical not in names and canonical.casefold() not in folded, 'Owner batch extraction: member alias'
            names.add(canonical); folded.add(canonical.casefold())
            assert len(names) <= POLICY['maximumMembers']
            assert entry.isdir() or entry.isfile(), 'Owner batch extraction: links and special members are rejected'
            if canonical == root_name:
                assert entry.isdir(), 'Owner batch extraction: root must be a directory'
            target = destination.joinpath(*relative.parts) if destination is not None else None
            if entry.isdir():
                assert entry.size == 0
                if target is not None:
                    target.mkdir(parents=True, exist_ok=True)
                members.append({'path': entry.name, 'kind': 'directory'})
                continue
            assert 0 <= entry.size <= POLICY['archiveLimitBytes']
            total += entry.size; assert total <= POLICY['archiveLimitBytes']
            checksum = hashlib.sha256(); length = 0
            if target is not None:
                target.parent.mkdir(parents=True, exist_ok=True)
            stream = target.open('xb') if target is not None else None
            try:
                with archive.extractfile(entry) as source:
                    for chunk in iter(lambda: source.read(POLICY['chunkBytes']), b''):
                        length += len(chunk); assert length <= entry.size; checksum.update(chunk)
                        if stream is not None:
                            stream.write(chunk)
                assert length == entry.size
            finally:
                if stream is not None:
                    stream.close()
            members.append({'path': entry.name, 'kind': 'file', 'bytes': length, 'sha256': checksum.hexdigest()})
    assert root_name in names and members, 'Owner batch extraction: missing archive root'
    return members


def materialize(binding, collection, destination):
    """Retain both original tar files and their complete member manifests; partial outputs stay available on failure."""
    verified = verify_collection(binding, collection)
    collection = collection.resolve(strict=True)
    destination = destination.parent.resolve(strict=True) / destination.name
    source_repository = Path(__file__).resolve().parents[4]
    for protected in [collection, source_repository]:
        assert not destination.is_relative_to(protected) and not protected.is_relative_to(destination)
    assert sys.platform == 'linux', 'Owner batch extraction: use Linux'
    assert not destination.exists() and not destination.is_symlink(), 'Owner batch extraction: preserve existing destination'
    destination.mkdir()
    result = {**verified, 'complete': False, 'tarFiles': [], 'archivedCodeExecuted': False, 'DOMExecuted': False,
              'readerPythonFiles': {**current_transport.source_identity(),
                                    'extract.py': hashlib.sha256(Path(__file__).read_bytes()).hexdigest()},
              'pythonVersion': sys.version, 'pythonExecutable': sys.executable}
    try:
        for entry in verified['artifacts']:
            node = entry['node']; directory = destination / node; directory.mkdir()
            artifact = binding['artifacts'][node]
            tar_name = POLICY[binding['mode'] + 'Tar']; root_name = POLICY[binding['mode'] + 'Root']
            filename = directory / tar_name
            with zipfile.ZipFile(collection / ('artifact-' + str(artifact['id'])) / 'artifact.zip') as archive:
                assert archive.namelist().count(tar_name) == 1, 'Owner batch extraction: missing/ambiguous original tar'
                information = archive.getinfo(tar_name); assert information.file_size <= POLICY['archiveLimitBytes']
                with archive.open(tar_name) as source, filename.open('xb') as output:
                    length = 0
                    for chunk in iter(lambda: source.read(POLICY['chunkBytes']), b''):
                        length += len(chunk); assert length <= information.file_size; output.write(chunk)
                assert length == information.file_size
                tar_sha = digest(filename)
                if binding['mode'] == 'capture':
                    checksum_name = tar_name + '.sha256'
                    assert set(archive.namelist()) == {tar_name, checksum_name}
                    assert archive.getinfo(checksum_name).file_size <= POLICY['metadataLimitBytes']
                    checksum = archive.read(checksum_name)
                    # sha256sum contains the original producer path; preserve it rather than normalizing it.
                    assert checksum.decode('utf-8').split()[0] == tar_sha
                    (directory / checksum_name).write_bytes(checksum)
            members = read_tar(filename, root_name, directory / 'payload')
            write_json(directory / 'members.json', members)
            result['tarFiles'].append({'node': node, 'archive': str(filename), 'bytes': filename.stat().st_size,
                                       'sha256': tar_sha, 'members': len(members),
                                       'root': str(directory / 'payload' / root_name)})
        result['complete'] = True
        return result
    except BaseException as error:
        result['failure'] = {'type': type(error).__name__, 'message': str(error)}
        raise
    finally:
        write_json(destination / 'extraction.json', result)


if __name__ == '__main__':
    assert len(sys.argv) == 4, 'Provide independently pinned binding JSON, collection and new external extraction directory'
    print(json.dumps(materialize(read_json(Path(sys.argv[1])), Path(sys.argv[2]), Path(sys.argv[3]))))
