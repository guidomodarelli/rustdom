"""Preserve all ordinary CI data and reproduce reported medians without executing archives or accepting ownership performance."""
import csv
import hashlib
import json
import math
import os
from pathlib import Path
import re
import shutil
import stat
import statistics
import sys
import zipfile

if sys.flags.optimize:
    raise RuntimeError('Benchmark data analysis requires non-optimized Python')
repository = Path.cwd()
source_root = Path(__file__).resolve().parent
config_file = source_root / 'constants/ci-validation.json'
if not config_file.is_file():
    config_file = repository / 'reports/benchmarks/ci-validation/40191262985/constants/ci-validation.json'
config = json.loads(config_file.read_bytes())

def physical_metadata(filename):
    """Reject links, Windows reparse points and unsupported filesystem entries before following input paths."""
    metadata = filename.lstat()
    reparse = getattr(metadata, 'st_file_attributes', 0) & getattr(stat, 'FILE_ATTRIBUTE_REPARSE_POINT', 0)
    assert not stat.S_ISLNK(metadata.st_mode) and not reparse and not getattr(filename, 'is_junction', lambda: False)(), \
        'Ordinary CI data: input tree contains a link or junction: ' + str(filename)
    return metadata

def file_digest(filename):
    """Read authenticated transport with bounded buffers; never interpret its programs."""
    checksum = hashlib.sha256()
    with filename.open('rb') as source:
        for chunk in iter(lambda: source.read(config['hashChunkBytes']), b''):
            checksum.update(chunk)
    return checksum.hexdigest()

def validate_transport(directory):
    """Require exactly the physical files pinned outside the downloaded data, including metadata and logs."""
    assert stat.S_ISDIR(physical_metadata(directory).st_mode)
    expected = config['transportFiles']; actual = set()
    directories = {parent.as_posix() for name in expected for parent in Path(name).parents if parent.as_posix() != '.'}
    for parent, children, filenames in os.walk(directory, followlinks=False):
        parent = Path(parent)
        for name in children:
            child = parent / name; metadata = physical_metadata(child)
            assert stat.S_ISDIR(metadata.st_mode) and child.relative_to(directory).as_posix() in directories, \
                'Ordinary CI data: unlisted input directory: ' + str(child)
        for name in filenames:
            filename = parent / name; metadata = physical_metadata(filename)
            relative = filename.relative_to(directory).as_posix()
            assert relative in expected and stat.S_ISREG(metadata.st_mode) and metadata.st_nlink == 1, \
                'Ordinary CI data: unlisted or aliased input file: ' + relative
            assert metadata.st_size == expected[relative]['bytes'] and file_digest(filename) == expected[relative]['sha256'], \
                'Ordinary CI data: pinned input bytes differ: ' + relative
            actual.add(relative)
    assert actual == set(expected), 'Ordinary CI data: pinned transport files are missing'

if len(sys.argv) == 3 and sys.argv[1] == '--verify':
    collection = Path(sys.argv[2]).resolve(strict=True); destination = None
elif len(sys.argv) == 3:
    collection = Path(sys.argv[1]).resolve(strict=True)
    requested = Path(sys.argv[2]).absolute()
    destination = requested.parent.resolve(strict=True) / requested.name
else:
    raise SystemExit('Provide --verify TRANSPORT or TRANSPORT FRESH_OUTPUT; no DOM or measurement is executed')
if destination is not None:
    assert not destination.exists() and not destination.is_symlink()
    for protected in [collection, source_root]:
        assert not destination.is_relative_to(protected) and not protected.is_relative_to(destination)

validate_transport(collection)
receipt = json.loads((collection / 'collection.json').read_bytes())
assert receipt['runId'] == config['runId'] and receipt['head'] == config['head'] and receipt['attempt'] == config['attempt']
assert next(job for job in receipt['jobs'] if job['name'] == 'benchmarks')['conclusion'] == 'success'
merge = json.loads((collection / 'measured-merge-commit.json').read_bytes())
head = json.loads((collection / 'PR-head-commit.json').read_bytes())
assert head['sha'] == receipt['head'] and head['sha'] in [parent['sha'] for parent in merge['parents']]
assert merge['tree']['sha'] == head['tree']['sha'] == config['gitTree']
assert merge['sha'] == config['measuredCommit']
rows = []; auxiliaries = []; profiles = []; seen = set(); spans = []; resources = []
for artifact in receipt['artifacts']:
    if not artifact['name'].startswith('benchmark-linux-'):
        continue
    expected = config['artifacts'][str(artifact['id'])]
    assert artifact == expected, 'Preserve independent Git-published artifact pins'
    shard = int(artifact['name'].removeprefix('benchmark-linux-'))
    directory = collection / ('artifact-' + str(artifact['id'])); archive_file = directory / 'artifact.zip'
    assert archive_file.stat().st_size == artifact['bytes'] and hashlib.sha256(archive_file.read_bytes()).hexdigest() == artifact['sha256'], f"Ordinary CI data: artifact {artifact['id']} bytes or SHA256 differ from pinned transport"
    with zipfile.ZipFile(archive_file) as archive:
        reports = [(name, json.loads(archive.read(name))) for name in archive.namelist()
            if name.endswith('.json') and name != 'artifact-manifest.json']
        full = [(name, report) for name, report in reports if report.get('shard') == {'index': shard, 'count': config['shards']} and report.get('requestedWorkloads') == []]
        assert len(full) == 1, 'Do not select among multiple full benchmark captures'
        name, report = full[0]
        assert report['complete'] is True and report['sourceCommit'] == merge['sha']
        assert len(report['runs']) == len(config['engineOrder']) and [run['engine'] for run in report['runs']] == config['engineOrder']
        manifest = json.loads(archive.read('artifact-manifest.json'))
        assert manifest['sourceCommit'] == report['sourceCommit'] and manifest['githubRunId'] == str(receipt['runId'])
        assert manifest['githubRunAttempt'] == '1' and manifest['complete'] is True
        assert report['node'] == config['node'] and report['nativeBinarySha256'] == config['nativeBinarySha256']
        identity = {key: report[key] for key in ['sourceCommit', 'sourceChanges', 'sourceGitErrors', 'node', 'jsdom', 'rustc', 'cargo',
            'nativeBinarySha256', 'runtimeSource', 'machine', 'methodology']}
        profiles.append({'artifactId': artifact['id'], 'shard': shard, 'report': name, **identity})
        by_case = {}
        for run_index, run in enumerate(report['runs']):
            assert run['warmupSamples'] == config['warmupSamples'] and run['measuredSamples'] == config['measuredSamples']
            for workload in run['workloads']:
                key = (workload['name'], workload['rows'])
                assert len(workload['samplesMs']) == config['measuredSamples'] and len(workload['memoryAfterCleanup']) == config['measuredSamples']
                assert re.fullmatch('[a-f0-9]{64}', workload['outputHash'])
                by_case.setdefault(key, {}).setdefault(run['engine'], []).append(workload)
                resources.append({'artifactId': artifact['id'], 'shard': shard, 'reportRunIndex': run_index,
                    'engine': run['engine'], 'node': report['node'], 'sourceCommit': report['sourceCommit'], 'workloadReport': workload})
                for sample_index, duration in enumerate(workload['samplesMs']):
                    assert isinstance(duration, (int, float)) and math.isfinite(duration) and duration > 0
                    spans.append({'shard': shard, 'reportRunIndex': run_index, 'engine': run['engine'], 'workload': key[0],
                        'rows': key[1], 'sampleIndex': sample_index, 'durationMs': duration, 'outputHash': workload['outputHash']})
        assert len(by_case) == len(report['comparisons'])
        for comparison in report['comparisons']:
            key = (comparison['workload'], comparison['rows']); assert key not in seen; seen.add(key)
            group = by_case[key]
            assert set(group) == {'jsdom', 'rustdom'} and all(len(workloads) == 2 for workloads in group.values())
            assert len({entry['outputHash'] for workloads in group.values() for entry in workloads}) == 1
            for engine in ['jsdom', 'rustdom']:
                samples = [sample for entry in group[engine] for sample in entry['samplesMs']]
                assert len(samples) == comparison[engine]['samples'] == config['samplesPerEngine']
                assert statistics.median(samples) == comparison[engine]['medianMs']
                assert min(samples) == comparison[engine]['minMs'] and max(samples) == comparison[engine]['maxMs']
            assert comparison['speedup'] == comparison['jsdom']['medianMs'] / comparison['rustdom']['medianMs']
            rows.append({'artifactId': artifact['id'], 'shard': shard, 'workload': key[0], 'rows': key[1],
                'jsdomSamples': config['samplesPerEngine'], 'rustdomSamples': config['samplesPerEngine'], 'jsdomMedianMs': comparison['jsdom']['medianMs'],
                'rustdomMedianMs': comparison['rustdom']['medianMs'], 'speedupJsdomOverRustdom': comparison['speedup'],
                'rustdomSlowerMedian': comparison['speedup'] < 1, 'reportedComparison': comparison})
        for auxiliary_name, auxiliary in reports:
            if auxiliary_name == name:
                continue
            auxiliaries.append({'artifactId': artifact['id'], 'file': auxiliary_name, 'complete': auxiliary.get('complete'),
                'shard': auxiliary.get('shard'), 'requestedWorkloads': auxiliary.get('requestedWorkloads'),
                'failure': auxiliary.get('failure'), 'purpose': 'Runner-contract output, kept distinct from the declared four-shard cohort'})
assert sorted(profile['shard'] for profile in profiles) == list(range(config['shards']))
assert len(rows) == config['cases'] and len(spans) == config['durations'] and len(resources) == config['resourceRecords']
assert sum(len(entry['workloadReport']['memoryAfterCleanup']) for entry in resources) == config['durations']
assert len(auxiliaries) == config['auxiliaryReports'] and sum(auxiliary['complete'] is False for auxiliary in auxiliaries) == config['negativeContractReports']
assert len({profile['nativeBinarySha256'] for profile in profiles}) == 1 and len({profile['node'] for profile in profiles}) == 1
rows.sort(key=lambda row: (row['workload'], row['rows']))
fields = ['artifactId', 'shard', 'workload', 'rows', 'jsdomSamples', 'rustdomSamples', 'jsdomMedianMs', 'rustdomMedianMs',
    'speedupJsdomOverRustdom', 'rustdomSlowerMedian']
if destination is not None:
    destination.mkdir(parents=True); (destination / '.gitattributes').write_bytes(b'* -text\n')
    for name, expected in config['transportFiles'].items():
        source = collection / name; metadata = physical_metadata(source)
        assert stat.S_ISREG(metadata.st_mode) and metadata.st_nlink == 1
        target = destination / 'transport' / name; target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, target)
        assert target.stat().st_size == expected['bytes'] and file_digest(target) == expected['sha256'], \
            'Ordinary CI data: transport changed while copying: ' + name
    shutil.copyfile(Path(__file__), destination / 'analyze-current-ci-data.py')
    (destination / 'constants').mkdir()
    shutil.copyfile(config_file, destination / 'constants/ci-validation.json')
    collector = source_root / 'collect-current-ci.py'
    if not collector.is_file():
        collector = repository / '.cache/collect-general-CI-40191262985.py'
    shutil.copyfile(collector, destination / 'collect-current-ci.py')
    with (destination / 'comparisons.csv').open('x', encoding='utf-8', newline='') as stream:
        writer = csv.DictWriter(stream, fieldnames=fields, extrasaction='ignore'); writer.writeheader(); writer.writerows(rows)
    with (destination / 'timing-spans.csv').open('x', encoding='utf-8', newline='') as stream:
        writer = csv.DictWriter(stream, fieldnames=list(spans[0])); writer.writeheader(); writer.writerows(spans)
    with (destination / 'memory-endpoints.jsonl').open('x', encoding='utf-8', newline='\n') as stream:
        for entry in resources:
            stream.write(json.dumps(entry, separators=(',', ':')) + '\n')
summary = {'runId': receipt['runId'], 'PRHead': head['sha'], 'observedSourceCommit': merge['sha'], 'identicalGitTree': head['tree']['sha'],
    'benchmarkCohortComplete': True, 'overallCIStatusAtCollection': receipt['status'], 'cases': len(rows), 'durations': len(spans),
    'memorySnapshots': config['durations'], 'rustdomSlowerMedianCases': sum(row['rustdomSlowerMedian'] for row in rows),
    'rustdomFasterMedianCases': sum(row['speedupJsdomOverRustdom'] > 1 for row in rows), 'profiles': profiles,
    'comparisons': rows, 'auxiliaryReports': auxiliaries, 'pooledMediansReproducedExactly': True,
    'outputHashesMatch': True, 'warmupDurationsRecorded': False, 'declaredWarmupsPerCaseAndProcess': config['warmupSamples'],
    'rawSourcesRewritten': False, 'analyzerExecutedDOM': False, 'newMeasurementProcesses': 0,
    'scientificStudyReplaced': False, 'performanceAccepted': None, 'gateReevaluated': False,
    'limits': ['Ordinary CI public-operation probes on the hybrid runtime; not the frozen ownership candidate or Node22/24 study',
        'Each of four worker processes in a shard runs many workloads; pooled medians have no new confidence or causal claim',
        'Process endpoints after one event-loop turn and GC are not peak memory or proof that Window/Document were collected',
        'Warmup counts are declared; raw warmup durations were not retained by this ordinary benchmark harness']}
if destination is not None:
    (destination / 'analysis.json').write_text(json.dumps(summary, indent=2) + '\n', encoding='utf-8', newline='\n')
    lines = ['# Comparaciones ordinarias del CI', '', 'Todas las filas se conservan. Un cociente menor que 1 indica mayor mediana de rustdom en esta corrida; no significa una regresión causal ni una decisión estadística de aceptación.', '',
        '| Workload | rows | jsdom mediana ms | rustdom mediana ms | jsdom/rustdom |', '| --- | ---: | ---: | ---: | ---: |']
    for row in rows:
        lines.append(f"| {row['workload']} | {row['rows']} | {row['jsdomMedianMs']:.6g} | {row['rustdomMedianMs']:.6g} | {row['speedupJsdomOverRustdom']:.6g} |")
    (destination / 'comparisons.md').write_text('\n'.join(lines) + '\n', encoding='utf-8', newline='\n')
    manifest = {filename.relative_to(destination).as_posix(): {'bytes': filename.stat().st_size, 'sha256': hashlib.sha256(filename.read_bytes()).hexdigest()}
        for filename in sorted(destination.rglob('*')) if filename.is_file()}
    (destination / 'manifest.json').write_text(json.dumps({'files': manifest, 'performanceAccepted': None, 'gateReevaluated': False}, indent=2) + '\n', encoding='utf-8', newline='\n')
print(json.dumps({key: summary[key] for key in ['cases', 'durations', 'memorySnapshots', 'rustdomSlowerMedianCases', 'rustdomFasterMedianCases',
    'observedSourceCommit', 'benchmarkCohortComplete', 'overallCIStatusAtCollection', 'performanceAccepted']}))
