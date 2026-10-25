"""Materialize only the two authenticated byte archives from published parts; never execute archive code or measurements."""
import hashlib
import types
import json
from pathlib import Path
import shutil
import stat
import sys

if sys.flags.optimize:
    raise RuntimeError('Combined result materialization requires non-optimized Python')

POLICY = json.loads((Path(__file__).parent / 'constants/materialization.json').read_bytes())


def physical(filename, directory=False):
    """Require a physical file/directory, preserving links, aliases and foreign destinations."""
    metadata = filename.lstat()
    assert not stat.S_ISLNK(metadata.st_mode), 'Combined materialization: symbolic input link'
    if hasattr(metadata, 'st_file_attributes'):
        assert not metadata.st_file_attributes & stat.FILE_ATTRIBUTE_REPARSE_POINT, 'Combined materialization: reparse input'
    assert not getattr(filename, 'is_junction', lambda: False)()
    if directory:
        assert stat.S_ISDIR(metadata.st_mode), 'Combined materialization: expected a physical directory'
    else:
        assert stat.S_ISREG(metadata.st_mode) and metadata.st_nlink == 1, 'Combined materialization: expected an unaliased regular file'
    return metadata


def digest(filename):
    result = hashlib.sha256()
    with filename.open('rb') as source:
        for chunk in iter(lambda: source.read(POLICY['chunkBytes']), b''):
            result.update(chunk)
    return result.hexdigest()


def materialize(repository, packet, destination):
    """Validate current binding, every input and byte boundary before creating a fresh disjoint output."""
    physical(packet, directory=True)
    packet = packet.resolve(strict=True)
    destination = destination.parent.resolve(strict=True) / destination.name
    for protected in [packet, repository.resolve(strict=True)]:
        assert destination != protected and not destination.is_relative_to(protected) and not protected.is_relative_to(destination), 'Combined materialization: output overlaps protected input'
    assert not destination.exists() and not destination.is_symlink(), 'Combined materialization: preserve existing output'
    physical(packet / 'metadata', directory=True)
    physical(packet / POLICY['metadataDirectory'], directory=True)
    for relative, checksum in POLICY['metadataFiles'].items():
        filename = packet / relative
        physical(filename.parent, directory=True)
        physical(filename)
        assert digest(filename) == checksum, relative
    binding = json.loads((packet / POLICY['bindingFile']).read_bytes())
    parts = json.loads((packet / POLICY['partsFile']).read_bytes())
    assert set(parts) == {'artifact.zip', binding['tarName']}
    physical(packet / POLICY['partsDirectory'], directory=True)
    for name, kind in [('artifact.zip', 'zip'), (binding['tarName'], 'tar')]:
        declared = parts[name]
        assert declared['bytes'] == binding[kind + 'Bytes'] and declared['sha256'] == binding[kind + 'Sha256']
        assert len(declared['parts']) == (declared['bytes'] + POLICY['partBytes'] - 1) // POLICY['partBytes']
        for ordinal, part in enumerate(declared['parts']):
            expected_name = f'{name}.part-{ordinal:03d}'
            assert part['name'] == expected_name and part['bytes'] == min(POLICY['partBytes'], declared['bytes'] - ordinal * POLICY['partBytes'])
            filename = packet / POLICY['partsDirectory'] / expected_name
            assert physical(filename).st_size == part['bytes'] and digest(filename) == part['sha256'], expected_name
    for dependency in POLICY['transportDependencies']:
        filename = repository / dependency['path']
        physical(filename)
        assert digest(filename) == dependency['sha256'], 'Combined materialization: current transport dependency changed: ' + dependency['path']
    method = repository / POLICY['transportReader']
    content = method.read_bytes()
    assert hashlib.sha256(content).hexdigest() == POLICY['transportReaderSha256']
    transport = types.ModuleType('current_combined_transport_materialization')
    transport.__file__ = str(method)
    exec(compile(content, str(method), 'exec'), transport.__dict__)
    transport.current_binding(binding, repository)
    destination.mkdir()
    for name, declared in parts.items():
        with (destination / name).open('xb') as output:
            for part in declared['parts']:
                filename = packet / POLICY['partsDirectory'] / part['name']
                physical(filename)
                with filename.open('rb') as source:
                    shutil.copyfileobj(source, output, POLICY['chunkBytes'])
        assert (destination / name).stat().st_size == declared['bytes'] and digest(destination / name) == declared['sha256'], name
    for name in POLICY['collectionMetadata']:
        shutil.copyfile(packet / POLICY['metadataDirectory'] / name, destination / name)
    result = transport.verify_collection(repository, destination, binding)
    assert result['transportAuthenticated'] and result['performanceAccepted'] is None
    return {**result, 'archivesReconstructed': 2, 'DOMExecuted': False, 'measurementExecuted': False}


if __name__ == '__main__':
    assert len(sys.argv) == 4, 'Provide repository, published packet and fresh destination'
    print(json.dumps(materialize(*map(Path, sys.argv[1:]))))
