"""Reconstruct one preserved ZIP into a new file, without executing its contents."""
from pathlib import Path, PurePosixPath
import hashlib
import json
import sys

POLICY = json.loads((Path(__file__).resolve().parent / 'constants/archive-storage.json').read_bytes())

def physical_part(repository, relative):
    path = PurePosixPath(relative)
    if not relative or path.is_absolute() or any(part in ['', '.', '..'] for part in relative.split('/')) or '\\' in relative or ':' in relative:
        raise ValueError('Artifact part path is not canonical')
    current = repository
    for part in path.parts:
        current = current / part
        if current.is_symlink():
            raise ValueError('Artifact part path contains a symbolic link')
    return current


def restore(repository, layout, artifact_id, destination):
    entries = [entry for entry in layout['artifacts'] if entry['artifactId'] == artifact_id]
    if layout['revision'] != POLICY['revision'] or len(entries) != 1:
        raise ValueError('Artifact storage layout or identity differs')
    entry = entries[0]
    if not 0 < entry['bytes'] <= POLICY['maximumArchiveBytes'] or not 0 < len(entry['parts']) <= POLICY['maximumParts']:
        raise ValueError('Artifact storage exceeds bounded size')
    checksum = hashlib.sha256()
    total = 0
    # Exclusive creation preserves existing output, including links and previous partials.
    with destination.open('xb') as writer:
        for part in entry['parts']:
            filename = physical_part(repository, part['path'])
            if not filename.is_file() or filename.stat().st_size != part['bytes']:
                raise ValueError('Artifact part size differs: ' + part['path'])
            part_checksum = hashlib.sha256()
            with filename.open('rb') as reader:
                for chunk in iter(lambda: reader.read(POLICY['readChunkBytes']), b''):
                    total += len(chunk)
                    if total > entry['bytes']:
                        raise ValueError('Artifact parts exceed original byte count')
                    part_checksum.update(chunk)
                    checksum.update(chunk)
                    writer.write(chunk)
            if part_checksum.hexdigest() != part['sha256']:
                raise ValueError('Artifact part digest differs: ' + part['path'])
    if total != entry['bytes'] or checksum.hexdigest() != entry['sha256']:
        raise ValueError('Reconstructed artifact differs from original digest or size')
    return {'artifactId': artifact_id, 'bytes': total, 'sha256': checksum.hexdigest(),
            'storageReconstructionVerified': True, 'apiAuthenticationPerformedHere': False,
            'archivedCodeExecuted': False, 'measurementExecuted': False}


if __name__ == '__main__':
    repository = Path(sys.argv[1]).resolve(strict=True)
    layout = json.loads(Path(sys.argv[2]).read_bytes())
    print(json.dumps(restore(repository, layout, int(sys.argv[3]), Path(sys.argv[4]))))
