"""Read every native event and operation span without changing performance acceptance."""
import bisect
import collections
import hashlib
import json
import pathlib
import statistics
import sys


def intersecting(starts, ends, event_start, event_end):
    """Return intersected half-open windows; zero-duration events are timestamped points."""
    first = bisect.bisect_right(ends, event_start)
    last = bisect.bisect_right(starts, event_start) if event_end == event_start else bisect.bisect_left(starts, event_end)
    return range(first, max(first, last))


assert list(intersecting([10, 20], [12, 22], 12, 20)) == []
assert list(intersecting([10, 20], [12, 22], 11, 21)) == [0, 1]
assert list(intersecting([10, 20], [12, 22], 10, 10)) == [0]
assert list(intersecting([10, 20], [12, 22], 12, 12)) == []
assert list(intersecting([9], [13], 12.5, 12.5)) == [0]
assert list(intersecting([11], [11], 11, 11)) == []
assert list(intersecting([11], [11], 10, 12)) == [0]

root, output = map(pathlib.Path, sys.argv[1:3])
index = json.loads((root / 'index.json').read_bytes())
settings = json.loads((root / 'method-sources/constants/trace.json').read_bytes())
planned_processes = len(settings['capturePlan']) * len(settings['nodeVersions'])
assert len(index['processes']) <= planned_processes
processes, rows = [], []
planned_intervals_per_process = None
for record in index['processes']:
    # Rebase absolute runtime paths when reading an extracted archive elsewhere.
    directory = root / record['nodeVersion'] / record['physical']
    report = json.loads((directory / 'report.json').read_bytes())
    telemetry = json.loads((directory / 'report.json.telemetry.json').read_bytes())
    expected_intervals = len(report['settings']['rows']) * (report['settings']['warmupSamples'] + report['settings']['measuredSamples'])
    if planned_intervals_per_process is None:
        planned_intervals_per_process = expected_intervals
    assert expected_intervals == planned_intervals_per_process
    if record['exitCode'] != 0:
        partial = [{'node': report['node'], 'physical': record['physical'], 'engine': report['engine'],
                    'row': batch['name'] + '/' + str(batch['size']), **span,
                    'eventsAvailable': False, 'events': None}
                   for batch in report['batches'] for span in batch.get('sampleTimings', [])]
        rows.extend(partial)
        processes.append({'node': report['node'], 'physical': record['physical'], 'pid': report['pid'],
                          'status': 'failed', 'exitCode': record['exitCode'], 'signal': record.get('signal'),
                          'nativeEventsAvailable': False, 'traceFilePresent': (directory / 'trace.json').exists(),
                          'recordedIntervals': len(partial), 'unrecordedPlannedIntervals': expected_intervals - len(partial),
                          'compilerCategoryCompleteEvents': None, 'traceEvents': None})
        continue
    trace_bytes = (directory / 'trace.json').read_bytes()
    assert hashlib.sha256(trace_bytes).hexdigest() == record['traceSha256']
    trace = json.loads(trace_bytes)
    assert report['complete'] and telemetry['complete'] and report['pid'] == record['pid']
    offsets = [(anchor['beforeUs'] + anchor['afterUs']) / 2 - anchor['performanceMs'] * 1000 for anchor in [telemetry['start'], telemetry['end']]]
    midpoint = statistics.mean(offsets)
    uncertainty = max(abs(offset - midpoint) + (anchor['afterUs'] - anchor['beforeUs']) / 2 for offset, anchor in zip(offsets, [telemetry['start'], telemetry['end']]))
    spans = [{'node': report['node'], 'physical': record['physical'], 'engine': report['engine'],
              'row': batch['name'] + '/' + str(batch['size']), **span, 'eventsAvailable': True, 'events': {}}
             for batch in report['batches'] for span in batch['sampleTimings']]
    starts = [span['startMs'] * 1000 + midpoint for span in spans]
    ends = [(span['startMs'] + span['durationMs']) * 1000 + midpoint for span in spans]
    assert all(starts[position] < ends[position] <= starts[position + 1] for position in range(len(spans) - 1))
    envelopes = {'nominal': (starts, ends),
                 'someOffsetsInObservedEnvelope': ([value - uncertainty for value in starts], [value + uncertainty for value in ends]),
                 'everyOffsetInObservedEnvelope': ([value + uncertainty for value in starts], [value - uncertainty for value in ends])}
    counts = collections.Counter()
    compiler_events, other_compiler_phases, zero_duration = 0, 0, 0
    for event in trace['traceEvents']:
        thread = 'main' if event.get('tid') == report['pid'] else 'background'
        counts[(event.get('cat', ''), event.get('name', ''), event.get('ph', ''), thread)] += 1
        if event.get('pid') != report['pid'] or 'disabled-by-default-v8.compile' not in event.get('cat', '').split(','):
            continue
        if event.get('ph') != 'X':
            other_compiler_phases += 1
            continue
        compiler_events += 1
        point = event['dur'] == 0
        zero_duration += point
        for envelope, (lefts, rights) in envelopes.items():
            for position in intersecting(lefts, rights, event['ts'], event['ts'] + event['dur']):
                entry = spans[position]['events'].setdefault(thread, {}).setdefault(event['name'], {
                    'nominal': 0, 'someOffsetsInObservedEnvelope': 0, 'everyOffsetInObservedEnvelope': 0,
                    'nominalZeroDurationPoints': 0})
                entry[envelope] += 1
                if envelope == 'nominal' and point:
                    entry['nominalZeroDurationPoints'] += 1
    for span in spans:
        for thread in span['events'].values():
            for event in thread.values():
                assert event['everyOffsetInObservedEnvelope'] <= event['nominal'] <= event['someOffsetsInObservedEnvelope']
    rows.extend(spans)
    processes.append({'node': report['node'], 'physical': record['physical'], 'pid': report['pid'],
                      'status': 'complete', 'exitCode': record['exitCode'], 'signal': record.get('signal'),
                      'nativeEventsAvailable': True, 'recordedIntervals': len(spans), 'unrecordedPlannedIntervals': 0,
                      'traceEvents': len(trace['traceEvents']), 'compilerCategoryCompleteEvents': compiler_events,
                      'compilerCategoryOtherPhases': other_compiler_phases, 'compilerCategoryZeroDurationEvents': zero_duration,
                      'offsetMidpointUs': midpoint, 'observedEndpointUncertaintyUs': uncertainty,
                      'allEventGroups': [{'category': key[0], 'name': key[1], 'phase': key[2], 'thread': key[3], 'count': count}
                                         for key, count in sorted(counts.items())]})
planned_intervals = planned_processes * planned_intervals_per_process
result = {'diagnosticOnly': True, 'gateReevaluated': False, 'accepted': None,
          'numericCases': 7, 'sourceCommit': index['sourceCommit'],
          'fullCaptureComplete': index['complete'], 'failure': index.get('failure'),
          'plannedProcesses': planned_processes, 'recordedProcesses': len(processes),
          'plannedIntervals': planned_intervals, 'recordedIntervals': len(rows),
          'nativeEventIntervalsAvailable': sum(span['eventsAvailable'] for span in rows),
          'unrecordedPlannedIntervals': planned_intervals - len(rows),
          'limits': 'Counts are native events, not unique compilations or CPU/pause time. X compiler events are assigned to spans; other phases remain in raw/group counts. Every/some refer only to the observed endpoint offset envelope, not a universal clock bound. No function identity or causal/Azure attribution.',
          'processes': processes, 'intervals': rows}
with output.open('x') as stream:
    json.dump(result, stream, indent=2)
    stream.write('\n')
print(json.dumps({'processes': len(processes), 'intervals': len(rows),
                  'fullCaptureComplete': index['complete'],
                  'nativeEventsObserved': sum(process['traceEvents'] or 0 for process in processes),
                  'compilerCategoryCompleteEventsObserved': sum(process['compilerCategoryCompleteEvents'] or 0 for process in processes)}))
