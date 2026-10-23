"""Authenticate published CSV/summary and describe every original trajectory without executing DOM."""
import csv
import hashlib
import io
import json
from pathlib import Path
import subprocess
import sys

if sys.flags.optimize:
    raise RuntimeError('Shared trajectories require non-optimized Python for input authentication')

policy = json.loads((Path(__file__).parent / 'constants/diagnostics.json').read_text(encoding='utf-8'))


def prepare(packet):
    """Read only pinned published outputs; preserve measured and warmup observations separately."""
    manifest_bytes = (packet / 'files.json').read_bytes()
    assert hashlib.sha256(manifest_bytes).hexdigest() == policy['packetManifestSha256'], 'Shared trajectories: published input manifest differs'
    manifest = json.loads(manifest_bytes)
    inputs = {}
    hashes = {}
    for name in policy['inputs']:
        content = (packet / name).read_bytes()
        hashes[name] = hashlib.sha256(content).hexdigest()
        assert hashes[name] == manifest[name]['sha256'], f'Shared trajectories: changed published input {name}'
        inputs[name] = content
    analysis = json.loads(inputs['analysis.json'])
    replay = json.loads(inputs['replay.json'])
    assert analysis['runId'] == replay['runId'] == policy['runId']
    assert analysis['verified'] and analysis['executionComplete']
    assert analysis['performanceAccepted'] is False and replay['performanceAccepted'] is False
    processes = {}
    for row in csv.DictReader(io.StringIO(inputs['spans.csv'].decode('utf-8'))):
        identity = (row['node'], row['phase'], row['engine'], row['label'], row['rowIndex'], row['position'])
        entry = processes.setdefault(identity, {'node': row['node'], 'phase': row['phase'], 'engine': row['engine'],
            'label': row['label'], 'key': f"{row['name']}/{row['size']}", 'position': int(row['position']),
            'v8Seed': int(row['seed']), 'pid': int(row['pid']), 'physical': row['physical'],
            'report': '/'.join(identity), 'samplesMs': [], 'warmupMs': []})
        if row['stage'] == 'warmup':
            entry['warmupMs'].append(float(row['durationMs']))
        else:
            assert row['stage'] == 'measured'
            entry['samplesMs'].append(float(row['durationMs']))
    samples = list(processes.values())
    assert len(samples) == analysis['totals']['processes']
    assert sum(len(entry['samplesMs']) for entry in samples) == analysis['totals']['measuredSpans']
    assert sum(len(entry['warmupMs']) for entry in samples) == analysis['totals']['warmupSpans']
    summary = {'runId': analysis['runId'], 'accepted': False, 'verified': True,
        'rows': [dict(row, jsdomAms=row['A']['jsdom']['medianMs'], jsdomBms=row['B']['jsdom']['medianMs'],
            rustdomAms=row['A']['rustdom']['medianMs'], rustdomBms=row['B']['rustdom']['medianMs']) for row in analysis['comparisons']]}
    return {'samples': samples, 'summary': summary, 'receipt': {'runId': analysis['runId'], 'accepted': False,
        'executionComplete': True, 'processes': analysis['totals']['processes'], 'measuredDurations': analysis['totals']['measuredSpans']},
        'sourceSha256': hashes, 'warmupDurations': analysis['totals']['warmupSpans']}


def analyze(repository, packet, node, output):
    """Run the existing descriptive reader on authenticated values; never run a producer."""
    packet = packet.resolve(strict=True)
    output = output.parent.resolve(strict=True) / output.name
    assert output != packet and packet not in output.parents, 'Shared trajectories: preserve the published input packet'
    assert not output.exists(), 'Shared trajectories: output must be fresh'
    prepared = prepare(packet)
    output.mkdir()
    source = output / policy['files']['compact']
    source.write_text(json.dumps(prepared, indent=2) + '\n', encoding='utf-8')
    with (output / 'reader.stdout.log').open('xb') as stdout, (output / 'reader.stderr.log').open('xb') as stderr:
        result = subprocess.run([str(node), str(Path(__file__).with_name('analyze.cjs')), str(repository), str(source),
            str(output / policy['files']['diagnostics'])], stdout=stdout, stderr=stderr)
    assert result.returncode == 0, 'Shared trajectories: preserve failed reader output for diagnosis'
    return {'runId': policy['runId'], 'newMeasurements': 0, 'gateReevaluated': False, 'output': str(output)}


if __name__ == '__main__':
    assert len(sys.argv) == 5, 'Provide repository, published packet, pinned Node executable and fresh output directory'
    print(json.dumps(analyze(*map(Path, sys.argv[1:]))))
