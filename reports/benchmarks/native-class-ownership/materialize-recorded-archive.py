"""Reassemble preserved archive bytes and sidecars; never execute a DOM measurement."""
import hashlib
import json
import pathlib
import re
import sys

if sys.flags.optimize:
    raise RuntimeError('Recorded archive: Python optimization disables required checks; unset PYTHONOPTIMIZE')

constants = pathlib.Path(__file__).parent / 'constants'
settings = json.loads((constants / 'recorded-archive.json').read_text(encoding='utf-8'))
digest_pattern = re.compile(json.loads((constants / 'recorded-evidence.json').read_text(encoding='utf-8'))['sha256Pattern'])


def filename(value):
    """Accept only one portable filename beneath the caller's declared archive directory."""
    assert isinstance(value, str) and value and value not in ['.', '..']
    assert '/' not in value and '\\' not in value and ':' not in value, 'Recorded archive: noncanonical filename'
    return value


def metadata(entry):
    """Require actual positive byte lengths and complete SHA-256 declarations."""
    filename(entry['filename'])
    assert type(entry['bytes']) is int and entry['bytes'] > 0, 'Recorded archive: invalid byte length'
    assert isinstance(entry['sha256'], str) and digest_pattern.fullmatch(entry['sha256'])


def source_file(source, entry):
    """Reject links and missing or truncated inputs before consuming their payload."""
    candidate = source / filename(entry['filename'])
    assert candidate.is_file() and not candidate.is_symlink(), f'Recorded archive: missing regular input {entry["filename"]}'
    assert candidate.stat().st_size == entry['bytes'], f'Recorded archive: input byte length differs: {entry["filename"]}'
    return candidate


def materialize(source_argument, destination_argument):
    """Create a fresh output, retaining any incomplete output for inspection on failure."""
    source = pathlib.Path(source_argument).resolve(strict=True)
    destination = pathlib.Path(destination_argument)
    assert source.is_dir()
    assert not destination.exists() and not destination.is_symlink(), 'Recorded archive: destination already exists'
    assert destination.parent.is_dir(), 'Recorded archive: destination parent must exist'
    destination = destination.parent.resolve(strict=True) / filename(destination.name)
    manifest_path = source / settings['manifestFilename']
    assert manifest_path.is_file() and not manifest_path.is_symlink()
    manifest_bytes = manifest_path.read_bytes()
    declaration = json.loads(manifest_bytes)
    archive = declaration['archive']
    metadata(archive)
    assert archive['filename'] == settings['archiveFilename']
    parts = declaration['parts']
    assert isinstance(parts, list) and parts
    for position, part in enumerate(parts):
        metadata(part)
        assert part['filename'] == f'{archive["filename"]}.part-{position:03d}', 'Recorded archive: noncanonical part order'
        assert part['bytes'] <= settings['partSizeBytes']
        if position < len(parts) - 1:
            assert part['bytes'] == settings['partSizeBytes']
    assert sum(part['bytes'] for part in parts) == archive['bytes']
    sidecars = declaration['sidecars']
    assert isinstance(sidecars, list)
    assert [entry['filename'] for entry in sidecars] == settings['requiredSidecars']
    for entry in sidecars:
        metadata(entry)
    # Verify existence and sizes before creating any output. Hash each byte while streaming below.
    inputs = [(entry, source_file(source, entry)) for entry in [*parts, *sidecars]]
    destination.mkdir()
    archive_digest = hashlib.sha256()
    with (destination / archive['filename']).open('xb') as output:
        for part, source_path in inputs[:len(parts)]:
            part_digest = hashlib.sha256()
            count = 0
            with source_path.open('rb') as stream:
                for chunk in iter(lambda: stream.read(settings['readBufferBytes']), b''):
                    count += len(chunk)
                    part_digest.update(chunk)
                    archive_digest.update(chunk)
                    output.write(chunk)
            assert count == part['bytes'] and part_digest.hexdigest() == part['sha256'], (
                f'Recorded archive: part digest differs: {part["filename"]}')
    assert archive_digest.hexdigest() == archive['sha256'], 'Recorded archive: complete archive digest differs'
    for entry, source_path in inputs[len(parts):]:
        raw = source_path.read_bytes()
        assert len(raw) == entry['bytes'] and hashlib.sha256(raw).hexdigest() == entry['sha256'], (
            f'Recorded archive: sidecar digest differs: {entry["filename"]}')
        with (destination / entry['filename']).open('xb') as output:
            output.write(raw)
    result = {'verified': True, 'archive': archive, 'parts': len(parts), 'sidecars': sidecars,
              'manifestSha256': hashlib.sha256(manifest_bytes).hexdigest(), 'measurementExecuted': False}
    with (destination / settings['receiptFilename']).open('x', encoding='utf-8') as output:
        json.dump(result, output, indent=2)
        output.write('\n')
    return result


if __name__ == '__main__':
    assert len(sys.argv) == 3, 'Recorded archive: provide source and fresh destination directories'
    print(json.dumps(materialize(*sys.argv[1:])))
