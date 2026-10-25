"""Describe every AA group, clock interval and native counter without evaluating a performance gate."""
import collections
import csv
import hashlib
import json
from pathlib import Path
import sys

if sys.flags.optimize:
    raise RuntimeError('Range AA description requires non-optimized Python')

POLICY = json.loads((Path(__file__).parent / 'constants/description.json').read_bytes())


def digest(filename):
    observed = hashlib.sha256()
    with filename.open('rb') as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b''):
            observed.update(chunk)
    return observed.hexdigest()


def leaves(value, pointer=''):
    """Preserve all JSON leaves and empty containers with reversible JSON Pointer paths."""
    if isinstance(value, dict) and value:
        for name, child in value.items():
            escaped = name.replace('~', '~0').replace('/', '~1')
            yield from leaves(child, pointer + '/' + escaped)
    elif isinstance(value, list) and value:
        for ordinal, child in enumerate(value):
            yield from leaves(child, pointer + '/' + str(ordinal))
    else:
        yield pointer, value


def value_type(value):
    if value is None:
        return 'null'
    if isinstance(value, bool):
        return 'boolean'
    if isinstance(value, (int, float)):
        return 'number'
    if isinstance(value, str):
        return 'string'
    return 'object' if isinstance(value, dict) else 'array'


def write_csv(filename, fields, rows):
    with filename.open('x', encoding='utf-8', newline='') as output:
        writer = csv.DictWriter(output, fieldnames=fields, lineterminator='\n')
        writer.writeheader()
        writer.writerows(rows)


def describe(packet, output):
    """Read only hash-bound original exports, refuse overlap and retain adverse descriptive observations."""
    packet = packet.resolve(strict=True)
    output = output.parent.resolve(strict=True) / output.name
    assert output != packet and not output.is_relative_to(packet) and not packet.is_relative_to(output), \
        'Range AA description: output overlaps the authenticated packet'
    inputs = {role: packet / declared['path'] for role, declared in POLICY['inputs'].items()}
    for role, filename in inputs.items():
        assert digest(filename) == POLICY['inputs'][role]['sha256'], 'Range AA description: changed input ' + role
    analysis = json.loads(inputs['analysis'].read_bytes())
    index = json.loads(inputs['index'].read_bytes())
    assert analysis['runId'] == index['hostedRunId'] and analysis['sourceCommit'] == index['sourceCommit']
    assert analysis['performanceAccepted'] is None and analysis['gateReevaluated'] is False
    output.mkdir()

    groups = collections.defaultdict(dict)
    for cell in analysis['cells']:
        if cell['stage'] == POLICY['measuredStage']:
            groups[(cell['node'], cell['mode'], cell['engine'])][cell['label']] = cell
    comparisons = []
    for (node, mode, engine), cells in sorted(groups.items()):
        first, second = (cells[label] for label in POLICY['labels'])
        comparisons.append({'node': node, 'mode': mode, 'engine': engine,
                            'medianLabelAMs': first['medianDurationMs'], 'medianLabelBMs': second['medianDurationMs'],
                            'differencePct': (second['medianDurationMs'] / first['medianDurationMs'] - 1) * 100,
                            'spansLabelA': first['spans'], 'spansLabelB': second['spans']})
    write_csv(output / POLICY['outputs']['comparisons'], list(comparisons[0]), comparisons)

    frames = collections.defaultdict(lambda: collections.defaultdict(lambda: [0, 0]))
    with inputs['frames'].open(encoding='utf-8', newline='') as source:
        for row in csv.DictReader(source):
            if row['stage'] != POLICY['measuredStage']:
                continue
            frame = tuple(row[name] for name in ['origin', 'functionName', 'url', 'lineNumber', 'columnNumber'])
            counts = frames[(row['node'], row['engine'])][frame]
            counts[0] += int(row['possibleTicks'])
            counts[1] += int(row['guaranteedTicks'])
    top = []
    for (node, engine), counted in sorted(frames.items()):
        selected = sorted(counted.items(), key=lambda item: (-item[1][1], -item[1][0], item[0]))[:POLICY['topFrameLimit']]
        for frame, (possible, guaranteed) in selected:
            top.append(dict(zip(['origin', 'functionName', 'url', 'lineNumber', 'columnNumber'], frame),
                            node=node, engine=engine, possibleTicks=possible, guaranteedTicks=guaranteed))
    write_csv(output / POLICY['outputs']['topFrames'], list(top[0]), top)

    resources = [json.loads(line) for line in inputs['resources'].read_text(encoding='utf-8').splitlines()]
    native = [record for record in resources if 'nativeBaseline' in record]
    families = {}
    for family in POLICY['summaryFamilies']:
        families[family] = {'baselineLiveValues': sorted({record['nativeBaseline'][family]['live'] for record in native}),
                            'finalLiveValues': sorted({record['cleanupTrace'][-1]['nativeTree'][family]['live'] for record in native}),
                            'createdAfterBaseline': sum(record['cleanupTrace'][-1]['nativeTree'][family]['created'] - record['nativeBaseline'][family]['created'] for record in native),
                            'releasedAfterBaseline': sum(record['cleanupTrace'][-1]['nativeTree'][family]['released'] - record['nativeBaseline'][family]['released'] for record in native)}

    def counter_rows():
        for record in native:
            identity = {name: record[name] for name in ['ordinal', 'pid', 'node', 'mode', 'engine', 'label', 'physical']}
            for pointer, value in leaves(record['nativeBaseline']):
                yield {**identity, 'observation': POLICY['observationTypes']['baseline'], 'round': '', 'pointer': pointer,
                       'valueType': value_type(value), 'jsonValue': json.dumps(value, separators=(',', ':'), ensure_ascii=False)}
            for ordinal, state in enumerate(record['cleanupTrace']):
                for pointer, value in leaves(state['nativeTree']):
                    yield {**identity, 'observation': POLICY['observationTypes']['cleanup'], 'round': ordinal, 'pointer': pointer,
                           'valueType': value_type(value), 'jsonValue': json.dumps(value, separators=(',', ':'), ensure_ascii=False)}
    write_csv(output / POLICY['outputs']['nativeCounters'],
              ['ordinal', 'pid', 'node', 'mode', 'engine', 'label', 'physical', 'observation', 'round', 'pointer', 'valueType', 'jsonValue'], counter_rows())

    clocks = [json.loads(line) for line in inputs['clocks'].read_text(encoding='utf-8').splitlines()]
    clock_rows = []
    for record in clocks:
        row = {name: record[name] for name in ['ordinal', 'pid', 'node', 'mode', 'engine', 'label', 'physical']}
        for name in ['cpu', 'jit']:
            interval = record[name + 'Offsets']
            row[name + 'OffsetMinUs'] = interval['min'] if interval is not None else None
            row[name + 'OffsetMaxUs'] = interval['max'] if interval is not None else None
            row[name + 'IntervalWidthUs'] = interval['max'] - interval['min'] if interval is not None else None
        clock_rows.append(row)
    write_csv(output / POLICY['outputs']['clocks'], list(clock_rows[0]), clock_rows)

    memory = {'processes': len(resources), 'nativeProcesses': len(native),
              'cleanupRounds': sum(len(record['cleanupTrace']) for record in resources),
              'measuredEndpoints': sum(len(record['memoryAfterCleanup']) for record in resources),
              'windows': sum(record['trackedOwners']['window'] for record in resources),
              'documents': sum(record['trackedOwners']['document'] for record in resources),
              'firstUnclearStates': sum(not record['cleanupTrace'][0]['clear'] for record in resources),
              'nativeFamilies': families, 'parentMemory': index['parentMemory'],
              'performanceAccepted': None, 'gateReevaluated': False}
    summary = {'revision': POLICY['revision'], 'diagnosticOnly': True, 'performanceAccepted': None,
               'gateReevaluated': False, 'newMeasurements': 0, 'sourceCommit': index['sourceCommit'],
               'runId': index['hostedRunId'], 'inputDigests': POLICY['inputs'], 'comparisons': comparisons,
               'negativeCpuDeltas': analysis['negativeCpuDeltas'], 'machine': index['machine']}
    for role, value in [('memory', memory), ('summary', summary)]:
        with (output / POLICY['outputs'][role]).open('x', encoding='utf-8', newline='\n') as destination:
            json.dump(value, destination, ensure_ascii=False, indent=2)
            destination.write('\n')
    return summary


if __name__ == '__main__':
    assert len(sys.argv) == 3, 'Provide the authenticated result packet and a fresh output directory'
    result = describe(*map(Path, sys.argv[1:]))
    print(json.dumps({'runId': result['runId'], 'groups': len(result['comparisons']),
                      'performanceAccepted': None, 'gateReevaluated': False, 'newMeasurements': 0}))
