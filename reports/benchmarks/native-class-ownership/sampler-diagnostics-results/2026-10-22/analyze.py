"""Describe every observed GC overlap and CPU tick; never recalculate acceptance."""
import bisect
import collections
import json
import pathlib
import statistics
import sys


def union_overlap(start, end, events):
    intervals = sorted((max(start, event['startMs']), min(end, event['startMs'] + event['durationMs']))
                       for event in events if event['startMs'] < end and event['startMs'] + event['durationMs'] > start)
    merged = []
    for left, right in intervals:
        if merged and left <= merged[-1][1]:
            merged[-1][1] = max(merged[-1][1], right)
        else:
            merged.append([left, right])
    return sum(right - left for left, right in merged), len(intervals)


def sample_timestamps(profile):
    timestamped_samples, timestamp = [], profile['startTime']
    for position, (delta, node_id) in enumerate(zip(profile['timeDeltas'], profile['samples'])):
        timestamp += delta
        timestamped_samples.append((timestamp, position, node_id))
    # DevTools sorts reconstructed timestamps together with their sample IDs.
    return sorted(timestamped_samples)


assert union_overlap(10, 20, [{'startMs': 9, 'durationMs': 3}, {'startMs': 11, 'durationMs': 2}]) == (3, 2)
assert union_overlap(10, 20, [{'startMs': 0, 'durationMs': 10}, {'startMs': 20, 'durationMs': 5}]) == (0, 0)
assert union_overlap(10, 20, [{'startMs': 0, 'durationMs': 50}]) == (10, 1)
assert sample_timestamps({'startTime': 100, 'timeDeltas': [10, -4, 8], 'samples': [11, 22, 33]}) == [(106, 1, 22), (110, 0, 11), (114, 2, 33)]
assert sample_timestamps({'startTime': 100, 'timeDeltas': [10, 0, 2], 'samples': [11, 22, 33]}) == [(110, 0, 11), (110, 1, 22), (112, 2, 33)]
root, output = map(pathlib.Path, sys.argv[1:3])
index = json.loads((root / 'index.json').read_bytes())
assert index['complete'] and len(index['processes']) == 10
intervals, batches, clocks = [], [], []
for process in index['processes']:
    assert process['exitCode'] == 0
    directory = root / process['node'] / process['physical']
    report = json.loads((directory / 'report.json').read_bytes())
    telemetry = json.loads((directory / 'report.json.telemetry.json').read_bytes())
    profile = json.loads((directory / 'cpu-profile.json').read_bytes())
    assert report['complete'] and telemetry['complete']
    offsets = [(anchor['beforeUs'] + anchor['afterUs']) / 2 - anchor['performanceMs'] * 1000 for anchor in [telemetry['start'], telemetry['end']]]
    offset = statistics.mean(offsets)
    uncertainty = max(abs(observed - offset) + (anchor['afterUs'] - anchor['beforeUs']) / 2 for observed, anchor in zip(offsets, [telemetry['start'], telemetry['end']]))
    assert profile['startTime'] < telemetry['start']['beforeUs'] < telemetry['end']['afterUs'] < profile['endTime']
    assert len(profile['samples']) == len(profile['timeDeltas'])
    # Preserve negative deltas and every original tick in the raw CPU profile.
    timestamped_samples = sample_timestamps(profile)
    timestamps = [entry[0] for entry in timestamped_samples]
    sorted_samples = [entry[2] for entry in timestamped_samples]
    frames = {node['id']: node['callFrame'] for node in profile['nodes']}
    clocks.append({'node': report['node'], 'physical': process['physical'], 'offsetMidpointUs': offset,
                   'observedEndpointUncertaintyUs': uncertainty, 'endpointOffsetChangeUs': offsets[1] - offsets[0],
                   'cpuTicks': len(timestamps), 'requestedIntervalUs': 100,
                   'observedTickDeltaMedianUs': statistics.median(profile['timeDeltas']),
                   'rawNegativeDeltas': sum(delta < 0 for delta in profile['timeDeltas']),
                   'rawDeltaRangeUs': [min(profile['timeDeltas']), max(profile['timeDeltas'])],
                   'gcEvents': len(telemetry['gcEvents'])})
    for batch in report['batches']:
        chosen = []
        for span in batch['sampleTimings']:
            start, end = span['startMs'], span['startMs'] + span['durationMs']
            overlap, count = union_overlap(start, end, telemetry['gcEvents'])
            first, last = bisect.bisect_left(timestamps, start * 1000 + offset), bisect.bisect_left(timestamps, end * 1000 + offset)
            ticks = sorted_samples[first:last]
            record = {'node': report['node'], 'physical': process['physical'], 'engine': report['engine'],
                      'row': batch['name'] + '/' + str(batch['size']), **span, 'gcOverlapMs': overlap,
                      'gcEventsIntersecting': count, 'cpuTickCountAtMidpointAlignment': len(ticks),
                      'leafFrames': [{'ticks': total, **frames[node_id]} for node_id, total in collections.Counter(ticks).most_common()]}
            intervals.append(record)
            chosen.append(record)
        batches.append({'node': report['node'], 'physical': process['physical'], 'engine': report['engine'],
                        'row': batch['name'] + '/' + str(batch['size']),
                        'warmupGcIntervals': sum(record['gcEventsIntersecting'] > 0 for record in chosen[:3]),
                        'measuredGcIntervals': sum(record['gcEventsIntersecting'] > 0 for record in chosen[3:]),
                        'warmupDurationsMs': [record['durationMs'] for record in chosen[:3]],
                        'measuredDurationsMs': batch['samplesMs']})
assert len(intervals) == 960 and len(batches) == 80
result = {'diagnosticOnly': True, 'gateReevaluated': False, 'accepted': None,
          'limits': 'Local profiled processes differ from Azure acceptance runs. GC overlap is temporal, not causal. CPU leaf ticks use midpoint clock alignment with observed endpoint uncertainty; zero ticks is not absence of work or compilation.',
          'processes': clocks, 'batches': batches, 'intervals': intervals}
with output.open('x') as stream:
    json.dump(result, stream, indent=2)
    stream.write('\n')
print(json.dumps({'intervals': len(intervals), 'batches': len(batches), 'intervalsWithGcOverlap': sum(record['gcEventsIntersecting'] > 0 for record in intervals), 'cpuTicksInsideIntervals': sum(record['cpuTickCountAtMidpointAlignment'] for record in intervals)}))
