"""Lossless derived tables at distinct task, block, process and resource grains."""
import csv
import gzip
import io
from contextlib import ExitStack


def flat_native(value, prefix=''):
    fields = {}
    for name, item in value.items():
        key = prefix + '.' + name if prefix else name
        if isinstance(item, dict):
            fields.update(flat_native(item, key))
        else:
            if type(item) not in [bool, int]:
                raise ValueError('Owner batch export: native scalar type changed for ' + key)
            fields[key] = item
    return fields


def cell(value):
    if value is None:
        return ''
    if type(value) is bool:
        return 'true' if value else 'false'
    return value


def export_tables(decision, parts, directory, configuration, sampler, transport, archive_reader):
    """Stream all validated raw intervals/resources without changing process means, statistical units or missing native baselines."""
    counts = {'processes': 0, 'measuredDurations': 0, 'warmupDurations': 0, 'blocks': 0,
              'windows': 0, 'documents': 0, 'cleanupEndpoints': 0, 'parentSnapshots': 0,
              'nativeCounterRows': 0, 'nativeProcesses': 0, 'nonNativeProcesses': 0, 'firstCleanupNotClear': 0}
    process_keys = set()
    with ExitStack() as stack:
        writers = {}
        for name, definition in configuration['tables'].items():
            raw = stack.enter_context((directory / definition['filename']).open('xb'))
            compressed = stack.enter_context(gzip.GzipFile(filename='', fileobj=raw, mode='wb',
                compresslevel=configuration['compressionLevel'], mtime=0))
            text = stack.enter_context(io.TextIOWrapper(compressed, encoding='utf-8', newline=''))
            headers = definition.get('standaloneDimensions', configuration['dimensions']) + definition['columns']
            writer = csv.DictWriter(text, fieldnames=headers, lineterminator='\n', extrasaction='raise')
            writer.writeheader()
            writers[name] = writer

        def write(table, dimensions, values):
            writers[table].writerow({key: cell(value) for key, value in {**dimensions, **values}.items()})

        for record in decision['transport']['tarFiles']:
            node = 'v' + record['node']
            part = parts[node]
            root = transport['captureRoot'] + '/capture' if decision['mode'] == 'capture' else transport['functionalRoot']
            index = archive_reader['read_index'](record, root, configuration['maximumJSONBytes'])
            assert index['sourceCommit'] == part['sourceCommit'] and index['sourceChangesRaw'] == part['sourceChangesRaw']
            assert index['sourceGitErrors'] == part['sourceGitErrors'] and index['runtime']['node'] == node
            observations = {tuple(entry[key] for key in ['phase', 'engine', 'label', 'position', 'rowIndex']): entry['observation'] for entry in part['entries']}
            seen_observations = set()
            for sequence, process, report in archive_reader['reports'](record, root, index, configuration['maximumJSONBytes']):
                key = tuple(report[field] for field in ['phase', 'engine', 'label', 'position', 'rowIndex'])
                assert key not in seen_observations and key in observations
                seen_observations.add(key)
                observation = observations[key]
                assert report['measurement']['measuredSamplesMs'] == observation['samplesMs']
                assert report['measurement']['warmupSamplesMs'] == observation['warmupSamplesMs']
                dimensions = {'nodeVersion': node, 'sourceCommit': index['sourceCommit'], 'phase': report['phase'],
                    'engine': report['engine'], 'label': report['label'], 'position': report['position'],
                    'physicalDistribution': report['schedule']['physical'],
                    'rowIndex': report['rowIndex'], 'rowKey': observation['key'], 'pid': report['pid']}
                primary = (node,) + key
                assert primary not in process_keys
                process_keys.add(primary)
                assert [block['blockIndex'] for block in report['blocks']] == list(range(len(observation['blockMeans'])))
                for block, mean in zip(report['blocks'], observation['blockMeans']):
                    assert block['blockIndex'] == mean['blockIndex'] and block['stage'] == mean['stage']
                    assert [task['index'] for task in block['tasks']] == list(range(sampler['logicalTasksPerBlock']))
                    for task in block['tasks']:
                        write('tasks', dimensions, {'blockIndex': block['blockIndex'], 'stage': block['stage'],
                            'taskIndex': task['index'], 'processMonotonicStartMs': task['startMs'],
                            'durationMs': task['durationMs'], 'outputHash': task['outputHash']})
                        if block['stage'] == sampler['stages']['measured']:
                            counts['measuredDurations'] += 1
                        else:
                            assert block['stage'] == sampler['stages']['warmup']
                            counts['warmupDurations'] += 1
                    write('blocks', dimensions, {'blockIndex': block['blockIndex'], 'stage': block['stage'],
                        'tasks': len(block['tasks']), 'withinRealmWarmupRounds': block['withinRealmWarmupRounds'],
                        'meanMs': mean['meanMs'], 'nativeCreatedBeforeWarmup': block['nativeCreatedBeforeWarmup'],
                        'nativeCreatedBefore': block['nativeCreatedBefore'], 'nativeCreatedAfter': block['nativeCreatedAfter']})
                    counts['blocks'] += 1
                native = report['nativeBaseline'] is not None
                counts['nativeProcesses' if native else 'nonNativeProcesses'] += 1
                baseline = flat_native(report['nativeBaseline']) if native else None
                snapshots = [(0, baseline)] if native else []
                for ordinal, endpoint in enumerate(report['cleanupTrace'], start=1):
                    write('cleanup', dimensions, {'round': ordinal, 'clear': endpoint['clear'],
                        'survivingWindows': endpoint['survivors']['window'], 'survivingDocuments': endpoint['survivors']['document'],
                        **{field + 'Bytes': endpoint['memory'][field] for field in ['rss', 'heapTotal', 'heapUsed', 'external', 'arrayBuffers']},
                        'nativeApplicable': native})
                    counts['cleanupEndpoints'] += 1
                    if ordinal == 1 and not endpoint['clear']:
                        counts['firstCleanupNotClear'] += 1
                    if native:
                        snapshots.append((ordinal, flat_native(endpoint['nativeTree'])))
                    else:
                        assert 'nativeTree' not in endpoint
                for ordinal, fields in snapshots:
                    assert set(fields) == set(baseline)
                    for field in sorted(fields):
                        value = fields[field]; initial = baseline[field]
                        assert type(value) is type(initial)
                        write('nativeCounters', dimensions, {'stage': configuration['nativeStages']['baseline'] if ordinal == 0 else configuration['nativeStages']['cleanup'],
                            'round': ordinal, 'field': field, 'valueType': 'boolean' if type(value) is bool else 'number',
                            'value': value, 'baselineValue': initial, 'delta': None if type(value) is bool else value - initial})
                        counts['nativeCounterRows'] += 1
                final_clear = report['cleanupTrace'][-sampler['requiredFinalClearStates']:]
                assert len(final_clear) == sampler['requiredFinalClearStates'] and all(endpoint['clear'] for endpoint in final_clear)
                write('processes', dimensions, {'sequence': sequence, 'measuredDurations': len(observation['samplesMs']),
                    'warmupDurations': len(observation['warmupSamplesMs']), 'processMeanMs': observation['processMeanMs'],
                    'measuredBlocks': observation['measuredBlocks'], 'warmupBlocks': observation['warmupBlocks'],
                    'windows': observation['observedWindows'], 'documents': observation['observedDocuments'],
                    'nativeApplicable': native, 'firstCleanupClear': report['cleanupTrace'][0]['clear'], 'finalClearStates': len(final_clear)})
                counts['processes'] += 1
                counts['windows'] += observation['observedWindows']; counts['documents'] += observation['observedDocuments']
            assert seen_observations == set(observations)
            for parent in index['parentMemory']:
                write('parents', {'nodeVersion': node, 'sourceCommit': index['sourceCommit'], 'parentPid': parent['pid']},
                    {'stage': parent['stage'], 'completedWorkers': parent['completedWorkers'], 'observedAtUTC': parent['observedAt'],
                     'processMonotonicMs': parent['monotonicMs'],
                     **{field + 'Bytes': parent['memory'][field] for field in ['rss', 'heapTotal', 'heapUsed', 'external', 'arrayBuffers']},
                     'cpuUserMicroseconds': parent['cpu']['user'], 'cpuSystemMicroseconds': parent['cpu']['system']})
                counts['parentSnapshots'] += 1
    for field in ['processes', 'measuredDurations', 'warmupDurations', 'windows', 'documents', 'parentSnapshots']:
        assert counts[field] == sum(part[field] for part in parts.values()), 'Owner batch export: count mismatch for ' + field
    assert counts['processes'] == len(process_keys)
    return counts
