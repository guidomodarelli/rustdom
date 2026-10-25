"""Preserve actual validation bytes using extended UNC paths and independently hash every archived member."""
import hashlib
import json
from pathlib import Path
import shutil
import zipfile

repository = Path.cwd()
base = Path(r'\\?\UNC\wsl.localhost\Rustdom-Validation-20261025\home\guido\rustdom-validation')
validation = repository / 'reports/validation/combined-process-study/20261025-transport'
validation.mkdir()
(validation / '.gitattributes').write_bytes(b'* -text\n')
archive = validation / 'qa.zip'
members = []
with zipfile.ZipFile(archive, 'x', compression=zipfile.ZIP_DEFLATED, compresslevel=6) as output:
    for attempt in ['combined-process-transport-ci-20261025', 'combined-process-transport-ci-20261025-configuration-fix',
                    'combined-process-transport-ci-20261025-final', 'combined-process-transport-ci-20261025-tar-recovery']:
        proof = base / attempt / 'proof'
        for filename in sorted(proof.rglob('*')):
            if filename.is_file():
                name = attempt + '/proof/' + filename.relative_to(proof).as_posix()
                raw = filename.read_bytes()
                output.writestr(name, raw)
                members.append({'name': name, 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()})
    for filename in sorted((repository / '.cache/combined-transport-environment-failure-20261025').iterdir()):
        if filename.is_file():
            raw = filename.read_bytes(); name = 'environment-failure/' + filename.name
            output.writestr(name, raw)
            members.append({'name': name, 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()})
    for filename in sorted((repository / '.cache').glob('reproduce-combined-transport-ci*.py')):
        raw = filename.read_bytes(); name = 'readers/' + filename.name
        output.writestr(name, raw)
        members.append({'name': name, 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()})
with zipfile.ZipFile(archive) as output:
    assert output.testzip() is None and len(output.infolist()) == len(members)
    for member in members:
        assert hashlib.sha256(output.read(member['name'])).hexdigest() == member['sha256']
final = base / 'combined-process-transport-ci-20261025-tar-recovery/proof'
commands = json.loads((final / 'commands.json').read_bytes())
assert len(commands) == 13 and all(command['exitCode'] == 0 for command in commands)
results = []
for node in ['node22', 'node24']:
    tests = (final / (node + '-tests.stdout.log')).read_text(encoding='utf-8')
    assert ('# tests 29' in tests and '# pass 29' in tests) or ('ℹ tests 29' in tests and 'ℹ pass 29' in tests)
    transport_log = (final / (node + '-transport.stderr.log')).read_text(encoding='utf-8')
    assert 'Ran 14 tests' in transport_log and '\nOK\n' in transport_log
    observed = [json.loads(line) for line in (final / (node + '-transport.stdout.log')).read_text().splitlines()]
    extraction = next(item for item in observed if 'members' in item)
    resources = next(item for item in observed if 'descriptorsBefore' in item)
    assert extraction['members'] == 19214 and extraction['rawRegularBytes'] == 1404005115
    assert resources['descriptorsBefore'] == resources['descriptorsAfter'] == 4
    results.append({'runtime': json.loads((final / (node + '-runtime.stdout.log')).read_bytes()),
                    'nodeContracts': 29, 'transportContracts': 14, 'extraction': extraction, 'resources': resources})
summary = {'sourceCommit': '9b31d4cc3c85ba9e64d58ba1a92cf13caca89be6', 'sourceOverlay': 'Actual authored WIP, not declared clean',
    'commands': commands, 'results': results, 'historicalPins': 599, 'contractDependencies': 714,
    'qa': {'bytes': archive.stat().st_size, 'sha256': hashlib.sha256(archive.read_bytes()).hexdigest(), 'members': members},
    'measurementProcesses': 0, 'collectorExecutedDOM': False, 'archivedCodeExecuted': False,
    'performanceAccepted': None, 'gateReevaluated': False, 'executionReady': False,
    'environment': {'distribution': 'Rustdom-Validation-20261025', 'previousDistribution': 'Ubuntu-22.04',
        'previousDistributionFailed': True, 'previousDiskPreserved': True, 'destructiveRepairPerformed': False,
        'imageURL': 'https://cloud-images.ubuntu.com/wsl/jammy/current/ubuntu-jammy-wsl-amd64-ubuntu22.04lts.rootfs.tar.gz',
        'imageSha256': '1483cc5c1dce13064f774834cbffdff226559fd522a67a381a8ea77d63fb4109'}}
(validation / 'summary.json').write_text(json.dumps(summary, indent=2) + '\n', encoding='utf-8', newline='\n')
shutil.copyfile(Path(__file__), validation / Path(__file__).name)
memory = repository / 'reports/memory/combined-process-study/20261025-transport'
memory.mkdir()
(memory / 'observations.json').write_text(json.dumps({'results': results, 'measurementProcesses': 0,
    'scope': 'Finite read-only reader and error-path descriptor cycles; no DOM teardown, peak-memory or universal leak claim'},
    indent=2) + '\n', encoding='utf-8', newline='\n')
print(json.dumps({'qaBytes': archive.stat().st_size, 'qaMembers': len(members), 'SDKs': len(results), 'nodeTestsPerSDK': 29,
                  'transportTestsPerSDK': 14, 'allCommandsPassed': True}))
