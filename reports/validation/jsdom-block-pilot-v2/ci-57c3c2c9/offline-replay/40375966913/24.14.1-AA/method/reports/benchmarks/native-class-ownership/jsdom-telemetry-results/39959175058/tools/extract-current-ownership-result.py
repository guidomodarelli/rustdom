"""Extract the authenticated original transport without executing a DOM, sampler, or archived code."""
import gzip
import hashlib
import json
from pathlib import Path, PurePosixPath
import sys
import tarfile
import tempfile

if sys.flags.optimize:
    raise RuntimeError('Ownership extraction requires Python assertions; disable Python optimization')


def digest(filename):
    result = hashlib.sha256()
    with filename.open('rb') as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b''):
            result.update(chunk)
    return result.hexdigest()


def extract_archive(source, destination, allowed_roots):
    """Use a fresh caller-owned directory and reject escaping, aliased or unsupported archive paths."""
    destination = destination.parent.resolve(strict=True) / destination.name
    destination.mkdir()
    names = set()
    entries = []
    with tarfile.open(source) as archive:
        for entry in archive:
            name = PurePosixPath(entry.name)
            if (name.is_absolute() or '..' in name.parts or not name.parts or
                    name.parts[0] not in allowed_roots or name.as_posix() != entry.name.rstrip('/')):
                raise ValueError('Ownership archive: noncanonical or undeclared member path')
            if name.as_posix() in names:
                raise ValueError('Ownership archive: duplicate member path')
            names.add(name.as_posix())
            output = destination / name
            if not output.resolve().is_relative_to(destination):
                raise ValueError('Ownership archive: member escapes its extraction directory')
            if not (entry.isfile() or entry.isdir() or entry.issym() or entry.islnk()):
                raise ValueError('Ownership archive: unsupported entry type')
            if entry.issym() and not (output.parent / entry.linkname).resolve().is_relative_to(destination):
                raise ValueError('Ownership archive: symbolic link escapes its extraction directory')
            if entry.islnk():
                target = destination / entry.linkname
                if not target.resolve().is_relative_to(destination) or not target.is_file():
                    raise ValueError('Ownership archive: hard link requires a preceding contained file')
            archive.extract(entry, destination, filter=tarfile.tar_filter)
            record = {'path': name.as_posix()}
            if entry.isfile():
                if output.stat().st_size != entry.size:
                    raise ValueError('Ownership archive: extracted regular-file size differs')
                record.update(kind='file', bytes=entry.size, sha256=digest(output))
            elif entry.isdir():
                record['kind'] = 'directory'
            else:
                record.update(kind='symlink' if entry.issym() else 'hardlink', target=entry.linkname)
            entries.append(record)
    for name in names:
        if not (destination / name).resolve().is_relative_to(destination):
            raise ValueError('Ownership archive: extracted path resolves outside its owner')
    return entries


if __name__ == '__main__':
    repository = Path('/mnt/c/Users/guido/.codex/worktrees/native-class-ownership/rustdom')
    cache = repository / '.cache/current-ownership-original-39921160254'
    receipt = json.loads((cache / 'collection.json').read_text())
    assert receipt['runId'] == 39921160254 and receipt['jobId'] == 120306452464
    assert receipt['head'] == 'eafe4109fbbf94d36d225f745bb60d716ea0c214'
    assert receipt['transportAuthenticated'] is True and receipt['status'] == 'completed'
    source = cache / 'ownership-current-results.tar.xz'
    assert digest(source) == receipt['tarSha256']
    assert digest(cache / 'artifact.zip') == receipt['zipSha256']
    outer = Path(tempfile.mkdtemp(prefix='ownership-current-result-39921160254-', dir='/home/guido/rustdom-validation'))
    destination = outer / 'archive'
    members = extract_archive(source, destination, {'ownership-current'})
    (outer / 'raw-members.json.gz').write_bytes(gzip.compress(json.dumps(members, indent=2).encode(), mtime=0))
    state = {'root': str(destination / 'ownership-current'), 'members': len(members),
             'regularFiles': sum(member['kind'] == 'file' for member in members),
             'rawRegularBytes': sum(member.get('bytes', 0) for member in members),
             'links': sum(member['kind'] in ('symlink', 'hardlink') for member in members),
             'memberManifest': str(outer / 'raw-members.json.gz'), 'transportAuthenticated': True,
             'samplerExecuted': False, 'performanceAccepted': None}
    (repository / '.cache/current-ownership-results-extraction-state.json').write_text(json.dumps(state, indent=2) + '\n')
    print(json.dumps(state))
