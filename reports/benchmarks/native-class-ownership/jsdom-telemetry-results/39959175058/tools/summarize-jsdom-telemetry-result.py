"""Describe every saved process; never rerun, drop samples, or decide acceptance."""
import collections
import hashlib
import json
from pathlib import Path
import statistics
import sys

if sys.flags.optimize:
    raise RuntimeError('JSDOM telemetry summary requires non-optimized Python')

repository = Path('/mnt/c/Users/guido/.codex/worktrees/native-class-ownership/rustdom')
replay22 = json.loads((repository / '.cache/jsdom-telemetry-replay-node22.json').read_text())
replay24 = json.loads((repository / '.cache/jsdom-telemetry-replay-node24.json').read_text())
assert replay22['rows'] == replay24['rows']
state = json.loads((repository / '.cache/jsdom-telemetry-result-extraction.json').read_text())
root = Path(state['root'])
groups = {}
trajectories = []
for row in replay22['rows']:
    analysis = row['analysis']
    report = json.loads((root / row['directory'] / 'report.json').read_text())
    telemetry = json.loads((root / row['directory'] / 'report.json.telemetry.json').read_text())
    group = groups.setdefault(analysis['node'] + '/' + analysis['mode'], {
        'processes': 0, 'spans': 0, 'windows': 0, 'documents': 0, 'cleanupStates': 0,
        'firstUnclearStates': 0, 'requiredFinalClearStates': 0, 'negativeCpuDeltas': None if analysis['mode'] == 'jit' else 0,
        'gcEvents': 0, 'cpuTicks': None if analysis['mode'] == 'jit' else 0,
        'inspectorStopped': 0, 'inspectorDisconnected': 0,
        'memoryValues': collections.defaultdict(list), 'stages': {}})
    group['processes'] += 1; group['spans'] += len(analysis['spans'])
    group['windows'] += analysis['trackedOwners']['window']; group['documents'] += analysis['trackedOwners']['document']
    group['cleanupStates'] += len(analysis['cleanupTrace']); group['firstUnclearStates'] += not analysis['cleanupTrace'][0]['clear']
    if group['negativeCpuDeltas'] is not None: group['negativeCpuDeltas'] += len(analysis['outOfOrderCpuSamples'])
    group['gcEvents'] += analysis['totalGcEvents']
    if group['cpuTicks'] is not None: group['cpuTicks'] += analysis['cpuProfileTicks']
    group['inspectorStopped'] += telemetry['profiler']['stopped']
    group['inspectorDisconnected'] += telemetry['profiler']['connected'] and telemetry['profiler']['disconnected']
    for endpoint in analysis['cleanupTrace']:
        for name, value in endpoint['memory'].items(): group['memoryValues'][name].append(value)
    for endpoint in analysis['cleanupTrace'][-report['settings']['requiredClearRounds']:]:
        assert endpoint['clear'] and endpoint['survivors'] == {'window': 0, 'document': 0}
        group['requiredFinalClearStates'] += 1
    frames = collections.Counter()
    spans = []
    for span in analysis['spans']:
        gc_overlap = sum(max(0, min(event['startMs'] + event['durationMs'], span['startMs'] + span['durationMs']) - max(event['startMs'], span['startMs'])) for event in span['gcEvents'])
        spans.append({'index': span['index'], 'stage': span['stage'], 'durationMs': span['durationMs'],
            'cpuUserUs': span['cpuUserUs'], 'cpuSystemUs': span['cpuSystemUs'],
            'overlappingGcEvents': len(span['gcEvents']), 'sumGcIntersectionMs': gc_overlap,
            'cpuTicksPossible': span['cpuTicksPossible'], 'cpuTicksGuaranteed': span['cpuTicksGuaranteed'],
            'jitEventsPossible': len(span['jitEvents']) if span['jitEvents'] is not None else None,
            'jitEventsGuaranteed': sum(event['guaranteed'] for event in span['jitEvents']) if span['jitEvents'] is not None else None})
        if span['stage'] == 'measured':
            for frame in span['cpuFrames'] or []:
                frames[json.dumps(frame['frame'], sort_keys=True)] += frame['possibleTicks']
        for stage in span['stages']:
            bucket = group['stages'].setdefault(stage['stage'], {'spans': 0, 'spansWithGc': 0, 'cpuPossible': None if analysis['mode'] == 'jit' else 0,
                'jitPossible': None if analysis['mode'] == 'cpu' else 0})
            bucket['spans'] += 1; bucket['spansWithGc'] += bool(stage['gcEvents'])
            if bucket['cpuPossible'] is not None: bucket['cpuPossible'] += stage['cpuTicksPossible']
            if bucket['jitPossible'] is not None: bucket['jitPossible'] += len(stage['jitEvents'])
    measured = [span for span in spans if span['stage'] == 'measured']
    assert len(measured) == 9
    trajectories.append({'node': analysis['node'], 'mode': analysis['mode'], 'key': analysis['key'],
        'position': analysis['position'], 'seed': analysis['seed'], 'physical': analysis['physical'],
        'directory': row['directory'], 'spans': spans,
        'firstThreeMedianMs': statistics.median(span['durationMs'] for span in measured[:3]),
        'lastThreeMedianMs': statistics.median(span['durationMs'] for span in measured[-3:]),
        'measuredSpansWithGc': sum(bool(span['overlappingGcEvents']) for span in measured),
        'measuredSpansWithPossibleJit': sum(bool(span['jitEventsPossible']) for span in measured) if analysis['mode'] == 'jit' else None,
        'topMeasuredLeafFramesByPossibleTicks': [{'frame': json.loads(frame), 'possibleTicks': ticks} for frame, ticks in frames.most_common(10)] if analysis['mode'] == 'cpu' else None})
for group in groups.values():
    group['memoryRangesBytes'] = {name: {'min': min(values), 'max': max(values)} for name, values in group.pop('memoryValues').items()}
totals = {name: sum(group[name] for group in groups.values() if group[name] is not None) for name in ['processes', 'spans', 'windows', 'documents', 'cleanupStates', 'firstUnclearStates',
    'requiredFinalClearStates', 'negativeCpuDeltas', 'gcEvents', 'inspectorStopped', 'inspectorDisconnected']}
assert totals['processes'] == 64 and totals['spans'] == totals['windows'] == totals['documents'] == 768
assert totals['requiredFinalClearStates'] == 128 and totals['inspectorStopped'] == totals['inspectorDisconnected'] == 32
result = {'diagnosticOnly': True, 'accepted': None, 'gateReevaluated': False, 'samplerRepeated': False,
    'runId': 39959175058, 'methodCommit': '22aeb0ba709f9a2959f4fe482b043f43d59794ad',
    'totals': totals, 'groups': groups, 'trajectories': trajectories,
    'limits': ['Instrumented observations; not acceptance timings or causal identification',
        'GC interval intersections may overlap and are not exclusive pause time',
        'CPU leaf sample counts are not weighted CPU durations; signed negative deltas preserved',
        'JIT emission points and CPU samples come from distinct processes',
        'Clock membership conditional on observed endpoint envelopes, not universal drift bounds',
        'All 64 processes retained, no cross-mode timing comparisons or sample exclusion']}
(repository / '.cache/jsdom-telemetry-summary.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps({'totals': totals, 'groups': groups}, indent=2))
