"""Describe the current ordinary CI reports without pooling hosts or changing any decision."""
import csv
import hashlib
import json
import math
from pathlib import Path
import re
import sys

if sys.flags.optimize:
    raise RuntimeError('Recorded CI analysis requires non-optimized Python')

collection = Path('/run/rustdom-ci-4196-artifacts-20261026')
replay = Path('/run/rustdom-ci-4196-replay-20261026')
root = Path('/run/rustdom-ci-4196-analysis-20261026')
root.mkdir(exist_ok=False)
receipt = json.loads((collection/'receipt.json').read_bytes())
assert receipt['sourceCommit'] == '4196c496187c88c92304516287a7e644659a8536' and receipt['allFourteenArtifactsAuthenticated']
artifacts = {artifact['name']:artifact for artifact in receipt['artifacts']}


def read_member(artifact, relative):
    matches = [member for member in artifact['members'] if member['path'] == relative]
    assert len(matches) == 1
    path = replay/('artifact-'+str(artifact['id']))/relative
    raw = path.read_bytes()
    assert len(raw) == matches[0]['bytes'] and hashlib.sha256(raw).hexdigest() == matches[0]['sha256']
    return raw


inputs = []
rows = []
controls = []
for shard in range(4):
    artifact = artifacts['benchmark-linux-'+str(shard)]
    candidates = []
    for member in artifact['members']:
        name = member['path']
        if not name.endswith('.json') or name == 'artifact-manifest.json':
            continue
        report = json.loads(read_member(artifact,name))
        if report.get('complete') is True and report.get('shard') == {'index':shard,'count':4}:
            candidates.append((name,report))
        else:
            controls.append({'artifactId':artifact['id'],'shard':shard,'member':name,'complete':report.get('complete'),
                'partition':report.get('shard'),'requestedWorkloads':report.get('requestedWorkloads'),'failure':report.get('failure')})
    assert len(candidates) == 1
    name,report = candidates[0]
    assert report['sourceChanges'] == [] and report['sourceGitErrors'] == [] and report['comparisons']
    inputs.append({'shard':shard,'artifactId':artifact['id'],'member':name,'sourceCommit':report['sourceCommit'],
        'sourceChanges':report['sourceChanges'],'sourceGitErrors':report['sourceGitErrors'],'node':report['node'],
        'machine':report['machine'],'nativeBinarySha256':report['nativeBinarySha256'],
        'completionScope':report['completionScope'],'methodology':report['methodology'],'rows':len(report['comparisons'])})
    for comparison in report['comparisons']:
        baseline = comparison['jsdom']['medianMs']
        candidate = comparison['rustdom']['medianMs']
        assert math.isfinite(baseline) and baseline > 0 and math.isfinite(candidate) and candidate > 0
        rows.append({'shard':shard,'workload':comparison['workload'],'rows':comparison['rows'],
            'jsdomSamples':comparison['jsdom']['samples'],'rustdomSamples':comparison['rustdom']['samples'],
            'jsdomMedianMs':baseline,'rustdomMedianMs':candidate,'rustdomOverJsdomMedianRatio':candidate/baseline,
            'rustdomMedianSlower':candidate > baseline})
assert len({(row['workload'],row['rows']) for row in rows}) == len(rows)
assert len({record['sourceCommit'] for record in inputs}) == 1
with (root/'all-main-comparisons.csv').open('x',encoding='utf-8',newline='') as writer:
    table = csv.DictWriter(writer,fieldnames=list(rows[0]))
    table.writeheader()
    table.writerows(rows)
benchmarks = {'runId':40395416750,'attempt':1,'prHeadCommit':receipt['sourceCommit'],
    'actualBenchmarkCheckoutCommit':inputs[0]['sourceCommit'],'sourceIdentityNormalized':False,
    'selection':'Una única partición completa count=4 por índice de matriz; selección independiente de tiempos o nombres de archivo.',
    'mainRows':len(rows),'rowsWithSlowerRustdomMedian':sum(row['rustdomMedianSlower'] for row in rows),
    'rowsWithFasterRustdomMedian':sum(row['rustdomOverJsdomMedianRatio'] < 1 for row in rows),
    'descriptiveOnly':True,'hostsPooled':False,'statisticalRegressionCertified':False,'inputs':inputs,
    'otherContractReportsPreserved':controls,'worstMedianRatios':sorted(rows,key=lambda row:row['rustdomOverJsdomMedianRatio'],reverse=True)[:10],
    'newMeasurementExecuted':False,'ownershipPerformanceAccepted':None,'ownershipGateReevaluated':False}
(root/'benchmark-analysis.json').write_bytes(json.dumps(benchmarks,indent=2,ensure_ascii=False).encode()+b'\n')

linux = artifacts['validation-ubuntu-22.04']
memory_members = [member for member in linux['members'] if member['path'].endswith('-valgrind.json')]
assert len(memory_members) == 1
report = json.loads(read_member(linux,memory_members[0]['path']))
tests = [name for run in report['runs'] for name in run['tests']]
assert len(tests) == len(set(tests))
batches = []
for run in report['runs']:
    assert run['testsCompleted'] and run['exitCode'] == 0 and run['signal'] is None
    relative = run['logPath'].removeprefix('reports/')
    raw = read_member(linux,relative)
    summaries = [line.strip() for line in raw.decode('utf-8').splitlines()
        if re.search(r'(definitely lost:|indirectly lost:|possibly lost:|still reachable:|ERROR SUMMARY:|All heap blocks)',line)]
    batches.append({'batchIndex':run['batchIndex'],'tests':len(run['tests']),'executableSha256':run['executableSha256'],
        'log':relative,'testsCompleted':run['testsCompleted'],'exitCode':run['exitCode'],'signal':run['signal'],
        'reportedLeakAndErrorSummaries':summaries})
resources = {'runId':40395416750,'attempt':1,'artifactId':linux['id'],'report':memory_members[0]['path'],
    'valgrindVersion':report['version'],'methodology':report['methodology'],'reportedPass':report['pass'],
    'uniqueRustTestsCompleted':len(tests),'batches':batches,'cargoLockSha256':report['cargoLockSha256'],
    'scope':'Ejecutable real de tests Rust; excluye V8 y el addon cargado en Node. Posibles fugas y memoria alcanzable siguen visibles en cada log.',
    'universalLeakAbsenceProven':False,'peakMemoryMeasured':False,'newMeasurementExecuted':False}
(root/'native-memory-analysis.json').write_bytes(json.dumps(resources,indent=2,ensure_ascii=False).encode()+b'\n')

replayed = json.loads((replay/'summary.json').read_bytes())
criteria = {}
for record in replayed['replays']:
    key = record['dataSdk']+'/'+record['phase']
    if key in criteria:
        assert criteria[key]['totals'] == record['totals']
        criteria[key]['readers'].append(record['readerSdk'])
    else:
        criteria[key] = {'totals':record['totals'],'readers':[record['readerSdk']]}
assert len(criteria) == 4 and all(len(record['readers']) == 2 for record in criteria.values())
totals = {name:sum(record['totals'][name] for record in criteria.values()) for name in next(iter(criteria.values()))['totals']}
endpoints = {'runId':40395417183,'attempt':1,'sourceCommit':receipt['sourceCommit'],'criteria':criteria,
    'uniqueObservedTotals':totals,'readerResultsNotCountedAsNewSamples':True,
    'scope':'Cuatro criterios funcionales jsdom de CI, leídos por dos SDK; no son el piloto científico de 16384 procesos ni miden Rust.',
    'universalLeakAbsenceProven':False,'peakMemoryMeasured':False,'newMeasurementExecuted':False,
    'performanceAccepted':None,'gateReevaluated':False}
(root/'functional-endpoints.json').write_bytes(json.dumps(endpoints,indent=2,ensure_ascii=False).encode()+b'\n')
print(json.dumps({'mainBenchmarkRows':len(rows),'slowerRustdomMedians':benchmarks['rowsWithSlowerRustdomMedian'],
    'otherContractReports':len(controls),'uniqueRustMemcheckTests':len(tests),'memcheckBatches':len(batches),
    'functionalUniqueTotals':totals,'newMeasurementExecuted':False}),flush=True)
