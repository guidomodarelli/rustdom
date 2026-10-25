"""Preserve read-only export qualification and its exact current code/data bytes; no DOM or measurement is executed."""
import hashlib
import json
from pathlib import Path
import shutil
import zipfile

repository = Path.cwd()
base = Path(r'\\?\UNC\wsl.localhost\Rustdom-Validation-20261025\home\guido\rustdom-validation')
attempts = ['combined-resource-export-qualification-20261025', 'combined-resource-export-qualification-20261025-ci',
    'combined-resource-export-qualification-20261025-ci-final', 'combined-resource-export-qualification-20261025-ci-alias']
final = base / attempts[-1]
validation = repository / 'reports/validation/combined-process-exports/20261025'; validation.mkdir(parents=True)
(validation / '.gitattributes').write_bytes(b'* -text\n')
archive = validation / 'qa.zip'; members = []
with zipfile.ZipFile(archive, 'x', compression=zipfile.ZIP_DEFLATED, compresslevel=6) as output:
    for attempt in attempts:
        root = base / attempt
        for subtree in ['proof', 'source/reports/benchmarks/native-class-ownership/combined-process-exports']:
            for filename in sorted((root / subtree).rglob('*')):
                if filename.is_file() and '__pycache__' not in filename.parts:
                    raw = filename.read_bytes(); name = attempt + '/' + filename.relative_to(root).as_posix()
                    output.writestr(name, raw)
                    members.append({'name': name, 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()})
    for filename in sorted((repository / '.cache').glob('qualify-combined-resource-export*-linux.py')):
        raw = filename.read_bytes(); name = 'audit-only/' + filename.name; output.writestr(name, raw)
        members.append({'name': name, 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()})
with zipfile.ZipFile(archive) as output:
    assert output.testzip() is None and len(output.infolist()) == len(members)
    for member in members: assert hashlib.sha256(output.read(member['name'])).hexdigest() == member['sha256']
result = json.loads((final / 'proof/result.json').read_bytes())
assert len(result['commands']) == 6 and all(command['exitCode'] == 0 for command in result['commands'])
assert result['sameScientificInputs'] and result['CSVAndJSONLByteIdenticalBetweenSDKs'] and result['memoryGroupsIdenticalBetweenSDKs']
benchmarks = repository / 'reports/benchmarks/native-class-ownership/combined-process-export-qualification/20261025'
benchmarks.mkdir(parents=True); (benchmarks / '.gitattributes').write_bytes(b'* -text\n')
results = []
for label in ['node22', 'node24']:
    tests = (final / ('proof/' + label + '-tests.stdout.log')).read_text(encoding='utf-8')
    assert ('# tests 3' in tests and '# pass 3' in tests) or ('ℹ tests 3' in tests and 'ℹ pass 3' in tests)
    assert '"failures":8,"descriptorsBefore":22,"descriptorsAfter":22' in tests
    memory = json.loads((final / (label + '-export/memory.json')).read_bytes())
    assert memory['functionalOnly'] and memory['totals']['processes'] == 64 and memory['totals']['firstUnclearStates'] == 8
    assert memory['performanceAccepted'] is None and memory['newMeasurements'] == 0
    shutil.copyfile(final / (label + '-export/memory.json'), benchmarks / (label + '-memory.json'))
    results.append({'node': memory['readerNode'], 'executableSha256': memory['readerExecutableSha256'],
        'contracts': 3, 'errorCycles': 8, 'descriptorsBefore': 22, 'descriptorsAfter': 22,
        'readerSha256': memory['readerSha256'], 'totals': memory['totals']})
for name in ['spans.csv', 'resources-native.jsonl']:
    raw = (final / 'node22-export' / name).read_bytes()
    assert raw == (final / 'node24-export' / name).read_bytes()
    (benchmarks / name).write_bytes(raw)
data_files = {filename.name: {'bytes': filename.stat().st_size, 'sha256': hashlib.sha256(filename.read_bytes()).hexdigest()}
    for filename in benchmarks.iterdir() if filename.is_file() and filename.name != '.gitattributes'}
summary = {'qualification': result, 'SDKs': results, 'sourceDependencies': 738,
    'frozenMethodFilesPreserved': 724, 'historicalPinsPreserved': 599, 'newMeasurementProcesses': 0,
    'exports': data_files, 'performanceAccepted': None, 'gateReevaluated': False,
    'liveStudyUnchanged': {'runId': 40184510898, 'jobId': 121142337986, 'attempt': 1,
        'sourceCommit': '95e64bd20711975b08864cf1bef1dee362b79663'},
    'QA': {'bytes': archive.stat().st_size, 'sha256': hashlib.sha256(archive.read_bytes()).hexdigest(), 'members': members}}
(validation / 'summary.json').write_text(json.dumps(summary, indent=2) + '\n', encoding='utf-8', newline='\n')
shutil.copyfile(Path(__file__), validation / Path(__file__).name)
memory_directory = repository / 'reports/memory/combined-process-exports/20261025'; memory_directory.mkdir(parents=True)
(memory_directory / 'observations.json').write_text(json.dumps({'SDKs': results,
    'CSVAndJSONLByteIdenticalBetweenSDKs': True, 'newMeasurementProcesses': 0, 'performanceAccepted': None,
    'limits': 'Finite reader error paths and historical data; no peak-memory or universal leak claim'}, indent=2) + '\n', encoding='utf-8', newline='\n')
print(json.dumps({'QA_members': len(members), 'QA_bytes': archive.stat().st_size, 'SDKs': results, 'dataFiles': data_files}))
