"""Pack or read bounded USTAR data. Never import or execute a captured implementation."""
import sys
if sys.flags.optimize:
    raise RuntimeError('Pilot archive requires non-optimized Python')
import gzip
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import stat
import tarfile
import unicodedata

POLICY = json.loads((Path(__file__).resolve().parent.parent / 'constants/capture.json').read_bytes())


def digest(filename):
    checksum = hashlib.sha256()
    with filename.open('rb') as stream:
        for chunk in iter(lambda: stream.read(POLICY['readChunkBytes']), b''):
            checksum.update(chunk)
    return checksum.hexdigest()


def relative_name(value):
    """Require one portable physical namespace; no aliases, control characters or platform device names."""
    assert isinstance(value, str) and value and unicodedata.normalize('NFC', value) == value
    assert PurePosixPath(value).as_posix() == value and not value.startswith('/')
    assert '\\' not in value and ':' not in value and all(ord(character) >= 32 and ord(character) != 127 for character in value)
    assert len(value.encode('utf-8')) <= POLICY['maximumArchivePathBytes']
    for segment in value.split('/'):
        assert segment not in ['', '.', '..'] and segment.rstrip(' .') == segment
        assert segment.split('.', 1)[0].casefold() not in POLICY['windowsReservedNames']
    return value


def physical_files(root):
    result = {}
    visited = 0
    total = 0
    namespace = {}
    for directory, directories, filenames in os.walk(root, followlinks=False):
        for name in directories + filenames:
            visited += 1
            assert visited <= POLICY['maximumArchiveFiles']
            member = Path(directory) / name
            status = member.lstat()
            assert not stat.S_ISLNK(status.st_mode), 'Pilot archive: linked member'
            relative = relative_name(member.relative_to(root).as_posix())
            previous = namespace.setdefault(relative.casefold(), relative)
            assert previous == relative, 'Pilot archive: directory/file case alias'
            if stat.S_ISDIR(status.st_mode):
                continue
            assert stat.S_ISREG(status.st_mode) and status.st_nlink == 1
            relative_name(POLICY['archiveRoot'] + '/' + relative)
            assert status.st_size <= POLICY['maximumArchiveMemberBytes']
            total += status.st_size
            assert total <= POLICY['maximumArchiveBytes']
            result[relative] = {'bytes': status.st_size, 'sha256': digest(member)}
    assert len(result) <= POLICY['maximumArchiveFiles']
    assert sum(binding['bytes'] for binding in result.values()) <= POLICY['maximumArchiveBytes']
    assert len({name.casefold() for name in result}) == len(result)
    return dict(sorted(result.items()))


def pack(root, archive):
    """Preserve every raw or partial file; add a complete inventory after the producer has stopped."""
    root = root.resolve(strict=True)
    archive = archive.parent.resolve(strict=True) / archive.name
    assert not archive.is_relative_to(root) and not os.path.lexists(archive)
    files = physical_files(root)
    files.pop(POLICY['inventoryFile'], None)
    inventory = {'revision': POLICY['revision'], 'files': files, 'dataOnly': True}
    raw = (json.dumps(inventory, indent=2) + '\n').encode()
    assert len(raw) <= POLICY['maximumJSONBytes']
    target = root / POLICY['inventoryFile']
    if target.exists():
        assert target.read_bytes() == raw, 'Pilot archive: preserve an existing differing inventory'
    else:
        with target.open('xb') as stream:
            stream.write(raw)
    expected = physical_files(root)
    with archive.open('xb') as output, tarfile.open(fileobj=output, mode='w:gz', format=tarfile.USTAR_FORMAT) as stream:
        for relative, binding in expected.items():
            member = root / relative
            entry = tarfile.TarInfo(POLICY['archiveRoot'] + '/' + relative)
            entry.size = binding['bytes']; entry.mode = 0o444; entry.mtime = int(member.stat().st_mtime)
            with member.open('rb') as content:
                stream.addfile(entry, content)
            assert digest(member) == binding['sha256'], 'Pilot archive: input changed during packing'
    assert archive.stat().st_size <= POLICY['maximumArchiveBytes']
    return {'archiveBytes': archive.stat().st_size, 'archiveSha256': digest(archive), 'regularFiles': len(expected),
            'rawBytes': sum(binding['bytes'] for binding in expected.values()),
            'DOMExecuted': False, 'performanceAccepted': None, 'gateReevaluated': False}


def read_archive(archive, expected_sha256, destination=None):
    """Stream raw headers before any extension allocation; reject PAX/GNU/links and never extract executable authority."""
    assert isinstance(expected_sha256, str) and len(expected_sha256) == 64 and all(character in '0123456789abcdef' for character in expected_sha256)
    status = archive.lstat()
    assert stat.S_ISREG(status.st_mode) and status.st_nlink == 1 and status.st_size <= POLICY['maximumArchiveBytes']
    assert digest(archive) == expected_sha256, 'Pilot archive: external transport digest differs'
    if destination is not None:
        destination = destination.parent.resolve(strict=True) / destination.name
        assert not os.path.lexists(destination) and not archive.resolve().is_relative_to(destination)
        destination.mkdir()
    inventory = {}; names = set(); total = 0; manifest_raw = None
    directories = set(); namespace = {}
    block = POLICY['archiveHeaderBytes']
    with gzip.open(archive, 'rb') as stream:
        while True:
            header = stream.read(block)
            assert len(header) == block, 'Pilot archive: truncated header or missing terminator'
            if header == b'\0' * block:
                assert stream.read(block) == b'\0' * block, 'Pilot archive: two zero terminators required'
                tail_bytes = 0
                for chunk in iter(lambda: stream.read(block), b''):
                    tail_bytes += len(chunk)
                    assert not any(chunk) and tail_bytes <= POLICY['maximumArchivePaddingBytes'], 'Pilot archive: hidden or excessive trailing data'
                break
            assert header[257:263] == b'ustar\0', 'Pilot archive: only USTAR headers are permitted'
            entry = tarfile.TarInfo.frombuf(header, 'utf-8', 'strict')
            assert entry.type in [tarfile.REGTYPE, tarfile.AREGTYPE], 'Pilot archive: extension, link or special file rejected'
            assert 0 <= entry.size <= POLICY['maximumArchiveMemberBytes']
            name = relative_name(entry.name)
            assert name.startswith(POLICY['archiveRoot'] + '/')
            relative = relative_name(name[len(POLICY['archiveRoot']) + 1:])
            for component in [relative, *[parent.as_posix() for parent in PurePosixPath(relative).parents if parent.as_posix() != '.']]:
                previous = namespace.setdefault(component.casefold(), component)
                assert previous == component, 'Pilot archive: directory/file case alias'
            parents = {parent.as_posix().casefold() for parent in PurePosixPath(relative).parents if parent.as_posix() != '.'}
            assert not parents.intersection(names) and relative.casefold() not in directories, 'Pilot archive: file/directory collision'
            directories.update(parents)
            assert len(directories) + len(names) + 1 <= POLICY['maximumArchiveFiles']
            if relative == POLICY['inventoryFile']:
                assert entry.size <= POLICY['maximumJSONBytes']
                manifest_raw = bytearray()
            assert relative.casefold() not in names
            names.add(relative.casefold()); assert len(names) <= POLICY['maximumArchiveFiles']
            total += entry.size; assert total <= POLICY['maximumArchiveBytes']
            checksum = hashlib.sha256(); remaining = entry.size
            target = destination / relative if destination is not None else None
            if target is not None:
                target.parent.mkdir(parents=True, exist_ok=True)
                assert target.parent.resolve(strict=True).is_relative_to(destination)
                writer = target.open('xb')
            else:
                writer = None
            try:
                while remaining:
                    chunk = stream.read(min(remaining, POLICY['readChunkBytes']))
                    assert chunk, 'Pilot archive: truncated content'
                    checksum.update(chunk); remaining -= len(chunk)
                    if relative == POLICY['inventoryFile']:
                        manifest_raw.extend(chunk)
                    if writer is not None:
                        writer.write(chunk)
            finally:
                if writer is not None:
                    writer.close()
            padding = (-entry.size) % block
            assert stream.read(padding) == b'\0' * padding, 'Pilot archive: invalid file padding'
            inventory[relative] = {'bytes': entry.size, 'sha256': checksum.hexdigest()}
    assert POLICY['inventoryFile'] in inventory, 'Pilot archive: complete file inventory is required'
    assert digest(archive) == expected_sha256, 'Pilot archive: bytes changed while reading'
    manifest = json.loads(manifest_raw)
    assert manifest['revision'] == POLICY['revision'] and manifest['dataOnly'] is True
    assert manifest['files'] == {name: binding for name, binding in inventory.items() if name != POLICY['inventoryFile']}
    return {'verified': True, 'archiveSha256': expected_sha256, 'regularFiles': len(inventory), 'rawBytes': total,
            'files': inventory, 'extracted': destination is not None, 'DOMExecuted': False,
            'performanceAccepted': None, 'gateReevaluated': False}


if __name__ == '__main__':
    if len(sys.argv) == 4 and sys.argv[1] == '--pack':
        result = pack(Path(sys.argv[2]), Path(sys.argv[3]))
    elif len(sys.argv) in [4, 5] and sys.argv[1] in ['--verify', '--extract']:
        assert (sys.argv[1] == '--extract') == (len(sys.argv) == 5)
        result = read_archive(Path(sys.argv[2]), sys.argv[3], Path(sys.argv[4]) if len(sys.argv) == 5 else None)
    else:
        raise ValueError('Provide --pack data new-archive, --verify archive digest, or --extract archive digest new-directory')
    print(json.dumps(result))
