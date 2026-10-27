"""Reconstruct both authenticated original transports from published parts; never execute archive contents."""
import hashlib
import json
from pathlib import Path
import shutil
import sys

if sys.flags.optimize:
    raise RuntimeError('Native telemetry materialization requires non-optimized Python')

from collect import POLICY, authenticate_artifact, authenticate_run


def materialize(packet, destination):
    """Write original ZIP and tar to a fresh caller-owned directory, checking every byte boundary."""
    destination = destination.parent.resolve(strict=True) / destination.name
    destination.mkdir()
    parts = json.loads((packet / 'parts.json').read_text(encoding='utf-8'))
    assert set(parts) == {'artifact.zip', POLICY['tarName']}
    for name, kind in [('artifact.zip', 'zip'), (POLICY['tarName'], 'tar')]:
        declared = parts[name]
        assert declared['bytes'] == POLICY[kind + 'Bytes']
        assert declared['sha256'] == POLICY[kind + 'Sha256']
        total = hashlib.sha256()
        size = 0
        with (destination / name).open('xb') as output:
            for ordinal, part in enumerate(declared['parts']):
                assert part['name'] == f'{name}.part-{ordinal:03d}'
                source = packet / 'parts' / part['name']
                assert source.is_file() and not source.is_symlink()
                assert source.stat().st_size == part['bytes']
                observed = hashlib.sha256()
                with source.open('rb') as content:
                    for chunk in iter(lambda: content.read(1024 * 1024), b''):
                        output.write(chunk)
                        total.update(chunk)
                        observed.update(chunk)
                        size += len(chunk)
                assert observed.hexdigest() == part['sha256'], part['name']
        assert size == declared['bytes'] and total.hexdigest() == declared['sha256'], name
    for filename in (packet / 'metadata').iterdir():
        if filename.name in ['run.json', 'jobs.json', 'artifacts.json', 'collection.json', 'job.log', 'observation.json']:
            shutil.copyfile(filename, destination / filename.name)
    run = json.loads((destination / 'run.json').read_text(encoding='utf-8'))
    jobs = json.loads((destination / 'jobs.json').read_text(encoding='utf-8'))
    authenticate_run(run, jobs)
    artifacts = json.loads((destination / 'artifacts.json').read_text(encoding='utf-8'))
    matches = [artifact for artifact in artifacts['artifacts'] if artifact['id'] == POLICY['artifactId']]
    assert len(matches) == 1
    authenticate_artifact(matches[0], destination / 'artifact.zip')
    return {'runId': POLICY['runId'], 'artifactId': POLICY['artifactId'], 'transportAuthenticated': True,
        'zipSha256': parts['artifact.zip']['sha256'], 'tarSha256': parts[POLICY['tarName']]['sha256'],
        'DOMExecuted': False, 'newMeasurements': 0}


if __name__ == '__main__':
    assert len(sys.argv) == 3, 'Provide published packet and fresh reconstruction destination'
    print(json.dumps(materialize(*map(Path, sys.argv[1:]))))
