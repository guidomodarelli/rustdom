"""Read an authenticated data-only subset without executing archived code or DOM."""
import hashlib
import json
from pathlib import Path
import shutil
import sys
import zipfile

if sys.flags.optimize:
    raise RuntimeError('Range historical fixtures: non-optimized Python is required')

FIXTURES = json.loads((Path(__file__).parent / 'constants/fixtures.json').read_bytes())


def digest(filename):
    """Hash bounded chunks without retaining the entire JIT log or profile."""
    result = hashlib.sha256()
    with filename.open('rb') as source:
        for chunk in iter(lambda: source.read(FIXTURES['readerChunkBytes']), b''):
            result.update(chunk)
    return result.hexdigest()


def extract(repository, destination, archive=None):
    """Preserve a fresh destination and the original full index while reading only eight processes."""
    repository = Path(repository).resolve(strict=True)
    destination = Path(destination)
    if destination.name in ('', '.', '..'):
        raise ValueError('Range historical fixtures: destination needs a new final directory')
    destination = destination.parent.resolve(strict=True) / destination.name
    if destination.exists() or destination.is_symlink():
        raise FileExistsError(f'Range historical fixtures: preserve existing destination {destination}')
    if repository == destination or repository in destination.parents or destination in repository.parents:
        raise ValueError('Range historical fixtures: destination must be disjoint from the source repository')
    declaration = FIXTURES['archive']
    archive = Path(archive).resolve(strict=True) if archive is not None else repository / declaration['path']
    if archive.stat().st_size != declaration['bytes'] or digest(archive) != declaration['sha256']:
        raise ValueError('Range historical fixtures: ZIP size or SHA256 differs from the published subset')
    manifest_file = repository / FIXTURES['archiveManifest']['path']
    if digest(manifest_file) != FIXTURES['archiveManifest']['sha256']:
        raise ValueError('Range historical fixtures: subset manifest SHA256 differs')
    manifest = json.loads(manifest_file.read_bytes())
    original_index = repository / FIXTURES['index']['path']
    if digest(original_index) != FIXTURES['index']['sha256']:
        raise ValueError('Range historical fixtures: original full index SHA256 differs')
    with zipfile.ZipFile(archive) as package:
        names = package.namelist()
        if len(names) != len(set(names)) or sorted(names) != sorted(manifest['members']):
            raise ValueError('Range historical fixtures: member coverage differs')
        for entry in package.infolist():
            expected = manifest['members'][entry.filename]
            # The authenticated member names are data, never archive-controlled output paths.
            segments = entry.filename.split('/')
            if any(segment in ('', '.', '..') or '\\' in segment or ':' in segment for segment in segments):
                raise ValueError('Range historical fixtures: unsafe member path')
            if entry.file_size != expected['bytes'] or entry.is_dir() or (entry.external_attr >> 16) & 0o170000 != 0o100000:
                raise ValueError('Range historical fixtures: expected a regular data member')
        destination.mkdir()
        for entry in package.infolist():
            filename = destination.joinpath(*entry.filename.split('/'))
            filename.parent.mkdir(exist_ok=True)
            with package.open(entry) as source, filename.open('xb') as output:
                shutil.copyfileobj(source, output, FIXTURES['readerChunkBytes'])
            if digest(filename) != manifest['members'][entry.filename]['sha256']:
                raise ValueError(f'Range historical fixtures: member SHA256 differs: {entry.filename}')
    if (destination / 'index.json').read_bytes() != original_index.read_bytes():
        raise ValueError('Range historical fixtures: index was changed during extraction')
    return {'role': manifest['role'], 'runId': FIXTURES['runId'], 'sourceCommit': FIXTURES['sourceCommit'],
            'includedOrdinals': FIXTURES['ordinals'], 'originalIndexProcesses': manifest['originalIndexProcesses'],
            'members': len(manifest['members']), 'archiveSha256': declaration['sha256'],
            'DOMExecuted': False, 'newMeasurements': 0, 'performanceAccepted': None, 'gateReevaluated': False}


if __name__ == '__main__':
    if len(sys.argv) != 3:
        raise ValueError('Provide current repository and a fresh disjoint destination for historical data')
    print(json.dumps(extract(*map(Path, sys.argv[1:]))))
