"""Compare fixed first/last measured blocks in every existing batch, without new samples."""
import collections
import hashlib
import json
import pathlib
import statistics
import sys


source, output = map(pathlib.Path, sys.argv[1:3])
content = source.read_bytes()
analysis = json.loads(content)
settings = json.loads(pathlib.Path(__file__).with_name('constants').joinpath('settings.json').read_bytes())
block_size = settings['comparisonSampleCount']
rows = []
for batch in analysis['batches']:
    matching = [entry for entry in analysis['intervals'] if entry['node'] == batch['node']
                and entry['physical'] == batch['physical'] and entry['row'] == batch['row']]
    measured = sorted((entry for entry in matching if entry['stage'] == 'measured'), key=lambda entry: entry['index'])
    assert len(measured) == len(batch['measuredDurationsMs'])
    assert [entry['durationMs'] for entry in measured] == batch['measuredDurationsMs']
    blocks = {}
    for name, selected in [('first', measured[:block_size]), ('last', measured[-block_size:])]:
        counts = collections.Counter()
        for entry in selected:
            for frame in entry['leafFrames']:
                counts[(frame['functionName'], frame['url'], frame['lineNumber'], frame['columnNumber'])] += frame['ticks']
        blocks[name] = {'indices': [entry['index'] for entry in selected],
                        'medianDurationMs': statistics.median(entry['durationMs'] for entry in selected),
                        'cpuTicks': sum(counts.values()),
                        'framesBySourceLocation': [{'functionName': key[0], 'url': key[1], 'lineNumber': key[2],
                                                   'columnNumber': key[3], 'ticks': count}
                                                  for key, count in counts.most_common()]}
        assert blocks[name]['cpuTicks'] == sum(entry['cpuTickCountAtMidpointAlignment'] for entry in selected)
    rows.append({'node': batch['node'], 'physical': batch['physical'], 'engine': batch['engine'],
                 'row': batch['row'], 'blocks': blocks,
                 'lastVersusFirstPercent': (blocks['last']['medianDurationMs'] / blocks['first']['medianDurationMs'] - 1) * 100})
result = {'diagnosticOnly': True, 'gateReevaluated': False, 'measurementExecuted': False,
          'sourceSha256': hashlib.sha256(content).hexdigest(), 'settings': settings,
          'limits': 'One local profiled process per package/Node. Leaf groups combine source locations, not tiers or closure identities. No causal attribution or acceptance decision.',
          'rows': rows}
with output.open('x') as stream:
    json.dump(result, stream, indent=2)
    stream.write('\n')
print(json.dumps({'batchesCompared': len(rows), 'blocks': len(rows) * 2,
                  'selectedIntervalsPerBatch': block_size * 2, 'originalIntervalsPreserved': len(analysis['intervals'])}))
