"""Recount recorded release observations without executing a runtime or collecting new samples."""
import json
import pathlib
import sys

root = pathlib.Path(sys.argv[1])
result = {'newSamplesCollected': False, 'groups': [], 'totals': {}}
inventory_owners = parser_windows = parser_documents = recovered_documents = created_documents = factory_windows = 0
endpoints = required_clear = non_clear = 0
for node in ['node22', 'node24']:
    directory = root / 'validation' / node
    inventory = json.loads((directory / 'memory.stdout.log').read_bytes())
    assert inventory['cycles'] == inventory['reportsRetained'] == 3 and inventory['released']
    inventory_owners += inventory['cycles']
    for stage in inventory['endpointTrace'][-2:]:
        assert stage['clear'] and all(value == 0 for value in stage['survivors'].values())
    memory_root = directory / 'runtime-observations/reports/memory'
    parser_file, = (memory_root / 'dom-parser').glob('*.json')
    factory_file, = memory_root.glob('*-document-implementation.json')
    parser = json.loads(parser_file.read_bytes())
    factory = json.loads(factory_file.read_bytes())
    assert parser['pass'] and factory['pass']
    assert parser['documentsPerCycle'] == 20 and parser['measuredCycles'] == 4 and len(parser['cases']) == 20
    assert len(factory['cycles']) == 12
    parser_windows += len(parser['cases']) * parser['documentsPerCycle']
    parser_documents += len(parser['cases']) * parser['documentsPerCycle']
    recovered_documents += len(parser['cases']) * parser['documentsPerCycle']
    created_documents += len(factory['cycles']) * 100
    factory_windows += len(factory['cycles'])
    for domain, cases, key in [('DOMParser', parser['cases'], 'endpoint'), ('DOMImplementation', factory['cycles'], 'released')]:
        for engine in ['jsdom', 'rustdom']:
            for mode in ['default', 'vm']:
                selected = [case for case in cases if case['engine'] == engine and case['mode'] == mode]
                assert len(selected) == (5 if domain == 'DOMParser' else 3)
                trace = []
                for case in selected:
                    endpoint = case[key]
                    assert endpoint['reached'] and endpoint['requiredClearSamples'] == 2
                    assert all(value == 0 for value in endpoint['state']['survivors'].values())
                    for stage in endpoint['trace'][-2:]:
                        assert stage['clear'] and all(value == 0 for value in stage['survivors'].values())
                    trace.extend(endpoint['trace'])
                    required_clear += 2
                endpoints += len(trace)
                non_clear += sum(not stage['clear'] for stage in trace)
                result['groups'].append({'node': node, 'domain': domain, 'engine': engine, 'realm': mode,
                    'recordedCycles': len(selected), 'observations': len(trace),
                    'initialNotClearPreserved': sum(not stage['clear'] for stage in trace),
                    **{name + 'RangeBytes': [min(stage['memory'][name] for stage in trace), max(stage['memory'][name] for stage in trace)]
                       for name in ['heapUsed', 'external', 'rss']}})
result['totals'] = {'inventoryWindowAndDocumentReferencesEach': inventory_owners,
    'parserWindowReferencesIncludingWarmups': parser_windows, 'parserOwnerDocumentReferencesIncludingWarmups': parser_documents,
    'recoveredDocumentReferencesIncludingWarmups': recovered_documents,
    'factoryCreatedDocumentReferencesRecordedCycles': created_documents, 'factoryOwnerWindowReferencesRecordedCycles': factory_windows,
    'domainCleanupObservations': endpoints, 'requiredFinalClearObservations': required_clear,
    'initialNotClearObservationsPreserved': non_clear}
result['limits'] = 'DOMParser includes recorded warmups; DOMImplementation counts only recorded measured cycles, excluding unrecorded warmup traces. Post-GC process memory is not peak memory or universal leak proof.'
print(json.dumps(result, indent=2))
