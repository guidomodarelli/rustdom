"""Reconstruct the two exact AA transports from published parts, without executing archive contents."""
import hashlib
import json
from pathlib import Path
import shutil
import sys

if sys.flags.optimize:
    raise RuntimeError('Range AA materialization requires non-optimized Python')

from collect import POLICY, current_reader


def materialize(repository, packet, destination):
    """Authenticate the source metadata, preserve foreign destinations and reconstruct byte-identical archives."""
    packet = packet.resolve(strict=True)
    destination = destination.parent.resolve(strict=True) / destination.name
    assert destination != packet and not destination.is_relative_to(packet) and not packet.is_relative_to(destination), \
        'Range AA materialization: output overlaps the published packet'
    reader = current_reader(repository.resolve(strict=True))
    layout = POLICY['materialization']
    names = layout['metadataFiles']
    metadata = packet / layout['metadataDirectory']
    assert metadata.is_dir() and not metadata.is_symlink(), 'Range AA materialization: metadata must be a regular directory'
    run = json.loads((metadata / names['run']).read_bytes())
    jobs = json.loads((metadata / names['jobs']).read_bytes())
    reader.authenticate_run(run, jobs)
    artifacts = json.loads((metadata / names['artifacts']).read_bytes())
    matches = [artifact for artifact in artifacts['artifacts'] if artifact['id'] == POLICY['artifactId']]
    assert len(matches) == 1, 'Range AA materialization: missing the pinned artifact metadata'
    artifact = matches[0]
    assert artifact['digest'] == 'sha256:' + POLICY['zipSha256'], 'Range AA materialization: artifact digest differs from the pinned ZIP'
    parts = json.loads((packet / layout['partsManifest']).read_bytes())
    assert set(parts) == {POLICY['files']['zip'], POLICY['tarName']}, 'Range AA materialization: expected both original archives'
    part_directory = packet / layout['partsDirectory']
    assert part_directory.is_dir() and not part_directory.is_symlink(), 'Range AA materialization: parts must be a regular directory'
    destination.mkdir()
    for name, kind in [(POLICY['files']['zip'], 'zip'), (POLICY['tarName'], 'tar')]:
        declared = parts[name]
        assert declared['bytes'] == POLICY[kind + 'Bytes'] and declared['sha256'] == POLICY[kind + 'Sha256'], name
        assert len(declared['parts']) == (declared['bytes'] + POLICY['partBytes'] - 1) // POLICY['partBytes'], name
        total = hashlib.sha256()
        size = 0
        with (destination / name).open('xb') as output:
            for ordinal, part in enumerate(declared['parts']):
                expected_name = layout['partNameFormat'].format(archive=name, ordinal=ordinal)
                assert part['name'] == expected_name, 'Range AA materialization: invalid part name for ' + expected_name
                assert part['bytes'] == min(POLICY['partBytes'], declared['bytes'] - ordinal * POLICY['partBytes']), expected_name
                source = packet / layout['partsDirectory'] / expected_name
                assert source.is_file() and not source.is_symlink(), expected_name
                assert source.stat().st_size == part['bytes'], expected_name
                observed = hashlib.sha256()
                with source.open('rb') as content:
                    for chunk in iter(lambda: content.read(1024 * 1024), b''):
                        output.write(chunk)
                        total.update(chunk)
                        observed.update(chunk)
                        size += len(chunk)
                assert observed.hexdigest() == part['sha256'], expected_name
        assert size == declared['bytes'] and total.hexdigest() == declared['sha256'], name
    for name in [*names.values(), POLICY['files']['state'], POLICY['ownerFile']]:
        source = metadata / name
        assert source.is_file() and not source.is_symlink(), name
        shutil.copyfile(source, destination / name)
    reader.authenticate_artifact(artifact, destination / POLICY['files']['zip'])
    return {'runId': POLICY['runId'], 'artifactId': POLICY['artifactId'], 'transportAuthenticated': True,
            'zipSha256': parts[POLICY['files']['zip']]['sha256'], 'tarSha256': parts[POLICY['tarName']]['sha256'],
            'DOMExecuted': False, 'newMeasurements': 0}


if __name__ == '__main__':
    assert len(sys.argv) == 4, 'Provide repository, published packet and fresh reconstruction destination'
    print(json.dumps(materialize(*map(Path, sys.argv[1:]))))
