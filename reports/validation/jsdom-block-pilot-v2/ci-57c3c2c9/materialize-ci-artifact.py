"""Materialize authenticated ZIP members into a new directory; never execute archived code."""
from pathlib import Path, PurePosixPath
import hashlib
import json
import stat
import sys
import unicodedata
import zipfile

SOURCE = Path(__file__).resolve().parent
POLICY = json.loads((SOURCE/'constants/expanded-storage.json').read_bytes())
ARCHIVE_POLICY = json.loads((SOURCE/'constants/archive-storage.json').read_bytes())


def digest_file(filename):
    """Hash a file with bounded reads."""
    checksum = hashlib.sha256()
    with filename.open('rb') as stream:
        for chunk in iter(lambda: stream.read(ARCHIVE_POLICY['readChunkBytes']), b''):
            checksum.update(chunk)
    return checksum.hexdigest()


def member_path(name):
    """Reject paths that cannot be preserved portably or could escape the output."""
    path = PurePosixPath(name)
    components = name.split('/')
    if (not name or path.is_absolute() or path.as_posix() != name
            or any(component in ['', '.', '..'] for component in components)
            or '\\' in name or ':' in name or '\x00' in name
            or unicodedata.normalize('NFC',name) != name
            or len(name.encode()) > POLICY['maximumMemberPathBytes']):
        raise ValueError('Artifact member path is not canonical: '+repr(name))
    for component in components:
        stem = component.split('.')[0].casefold()
        if (component.endswith((' ', '.')) or stem in POLICY['reservedNames']
                or any(character in '<>"|?*' or ord(character) < 32 for character in component)
                or stem in [prefix+str(number) for prefix in POLICY['reservedDevicePrefixes'] for number in range(1,10)]):
            raise ValueError('Artifact member path is not portable: '+repr(name))
    return path


def materialize(archive_path, artifact, destination):
    """Authenticate the original archive and every member before reporting success."""
    if archive_path.is_symlink() or not archive_path.is_file():
        raise ValueError('Artifact ZIP must be a physical file')
    if not 0 < artifact['bytes'] <= ARCHIVE_POLICY['maximumArchiveBytes']:
        raise ValueError('Artifact ZIP exceeds its byte bound')
    if archive_path.stat().st_size != artifact['bytes'] or digest_file(archive_path) != artifact['sha256']:
        raise ValueError('Artifact ZIP differs from its authenticated size or digest')
    expected = {}
    for member in artifact['members']:
        member_path(member['path'])
        if member['path'] in expected or not 0 <= member['bytes'] <= POLICY['maximumMemberBytes']:
            raise ValueError('Artifact inventory contains duplicate or oversized members')
        expected[member['path']] = member
    if not 0 < len(expected) <= POLICY['maximumMembers']:
        raise ValueError('Artifact inventory exceeds its member bound')
    if sum(member['bytes'] for member in expected.values()) > POLICY['maximumExpandedBytes']:
        raise ValueError('Artifact inventory exceeds its expanded byte bound')
    current = destination.absolute()
    for parent in [current, *current.parents]:
        if parent.is_symlink() or (hasattr(parent,'is_junction') and parent.is_junction()):
            raise ValueError('Artifact output path contains a symbolic link')
    with zipfile.ZipFile(archive_path) as archive:
        members = archive.infolist()
        if len(members) > POLICY['maximumMembers']:
            raise ValueError('Artifact ZIP exceeds its member bound')
        files = {}
        portable = set()
        for member in members:
            if member.orig_filename != member.filename:
                raise ValueError('Artifact ZIP member name was normalized by the platform')
            name = member.filename[:-1] if member.is_dir() else member.filename
            member_path(name)
            kind = stat.S_IFMT(member.external_attr >> 16)
            if member.flag_bits & 1 or kind not in [0, stat.S_IFREG, stat.S_IFDIR]:
                raise ValueError('Artifact ZIP contains an encrypted or special member')
            folded = name.casefold()
            if folded in portable:
                raise ValueError('Artifact ZIP contains duplicate portable paths')
            portable.add(folded)
            if member.is_dir():
                continue
            if name not in expected or member.file_size != expected[name]['bytes'] or member.CRC != expected[name]['crc32']:
                raise ValueError('Artifact ZIP member differs from its authenticated inventory: '+name)
            files[name] = member
        if set(files) != set(expected):
            raise ValueError('Artifact ZIP inventory is incomplete')
        file_names = {name.casefold() for name in files}
        for name in files:
            if any(parent.as_posix().casefold() in file_names
                   for parent in PurePosixPath(name).parents if parent.as_posix() != '.'):
                raise ValueError('Artifact ZIP has a file/directory path collision')
        destination.mkdir(parents=True,exist_ok=False)
        for name, member in files.items():
            target = destination.joinpath(*PurePosixPath(name).parts)
            target.parent.mkdir(parents=True,exist_ok=True)
            checksum = hashlib.sha256()
            count = 0
            with archive.open(member) as reader, target.open('xb') as writer:
                for chunk in iter(lambda:reader.read(ARCHIVE_POLICY['readChunkBytes']),b''):
                    count += len(chunk)
                    if count > expected[name]['bytes']:
                        raise ValueError('Artifact member exceeds its authenticated byte bound: '+name)
                    checksum.update(chunk)
                    writer.write(chunk)
            if count != expected[name]['bytes'] or checksum.hexdigest() != expected[name]['sha256']:
                raise ValueError('Artifact member differs from its authenticated digest: '+name)
    return {'artifactId':artifact['id'],'files':len(files),'expandedBytes':sum(member['bytes'] for member in expected.values()),
        'allMemberDigestsVerified':True,'apiAuthenticationPerformedHere':False,
        'archivedCodeExecuted':False,'measurementExecuted':False}


if __name__ == '__main__':
    if len(sys.argv) != 5:
        raise SystemExit('Usage: materialize-ci-artifact.py REPOSITORY ARTIFACT_ID ORIGINAL_ZIP NEW_DIRECTORY')
    repository = Path(sys.argv[1]).resolve(strict=True)
    destination = Path(sys.argv[4])
    canonical_destination = destination.resolve(strict=False)
    if canonical_destination.is_relative_to(repository) or repository.is_relative_to(canonical_destination):
        raise ValueError('Artifact materialization requires a new directory outside the repository')
    layout = json.loads((SOURCE/'expanded-artifact-layout.json').read_bytes())
    raw = (repository/layout['receiptPath']).read_bytes()
    if hashlib.sha256(raw).hexdigest() != layout['receiptSha256']:
        raise ValueError('Artifact receipt differs from the materialization layout')
    receipt = json.loads(raw)
    candidates = [artifact for artifact in receipt['artifacts'] if artifact['id'] == int(sys.argv[2])]
    if len(candidates) != 1:
        raise ValueError('Artifact ID is absent or ambiguous in the authenticated receipt')
    print(json.dumps(materialize(Path(sys.argv[3]),candidates[0],destination)))
