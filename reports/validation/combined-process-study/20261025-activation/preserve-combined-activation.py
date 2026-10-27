"""Preserve both read-only preparation phases and the actual reviewed SDK contract logs without archiving or executing DOM code."""
import hashlib
import json
from pathlib import Path
import shutil
import zipfile

repository = Path.cwd()
base = Path(r'\\?\UNC\wsl.localhost\Rustdom-Validation-20261025\home\guido\rustdom-validation')
destination = repository / 'reports/validation/combined-process-study/20261025-activation'
destination.mkdir()
(destination / '.gitattributes').write_bytes(b'* -text\n')
members = []
archive = destination / 'qa.zip'
with zipfile.ZipFile(archive, 'x', compression=zipfile.ZIP_DEFLATED, compresslevel=6) as output:
    for attempt in ['combined-process-activation-ci-20261025-prepublication', 'combined-process-activation-ci-20261025-reviewed']:
        proof = base / attempt / 'proof'
        for filename in sorted(proof.rglob('*')):
            if filename.is_file():
                name = attempt + '/proof/' + filename.relative_to(proof).as_posix(); raw = filename.read_bytes()
                output.writestr(name, raw)
                members.append({'name': name, 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()})
    for filename in sorted((repository / '.cache').glob('reproduce-combined-activation-*-linux.py')):
        raw = filename.read_bytes(); name = 'tools/' + filename.name
        output.writestr(name, raw)
        members.append({'name': name, 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()})
with zipfile.ZipFile(archive) as output:
    assert output.testzip() is None and len(output.infolist()) == len(members)
    for member in members: assert hashlib.sha256(output.read(member['name'])).hexdigest() == member['sha256']
proof = base / 'combined-process-activation-ci-20261025-reviewed/proof'
commands = json.loads((proof / 'commands.json').read_bytes())
assert len(commands) == 13 and all(command['exitCode'] == 0 for command in commands)
results = []
for node in ['node22', 'node24']:
    tests = (proof / (node + '-tests.stdout.log')).read_text(encoding='utf-8')
    assert ('# tests 36' in tests and '# pass 36' in tests) or ('â„¹ tests 36' in tests and 'â„¹ pass 36' in tests)
    transport_log = (proof / (node + '-transport.stderr.log')).read_text()
    assert 'Ran 14 tests' in transport_log and '\nOK\n' in transport_log
    observed = [json.loads(line) for line in (proof / (node + '-transport.stdout.log')).read_text().splitlines()]
    results.append({'runtime': json.loads((proof / (node + '-runtime.stdout.log')).read_bytes()),
        'nodeContracts': 36, 'transportContracts': 14, 'transportObservations': observed})
review = repository / 'reports/validation/combined-process-capture-method/review.json'
publication = json.loads(review.read_bytes())
assert len(publication['files']) == 724 and publication['executionReady'] is True
summary = {'sourceCommit': '3735c616cee124a7e7550512a03f9b964de7afc4',
    'sourceOverlay': 'Actual authored WIP; not represented as a clean producer checkout',
    'commands': commands, 'results': results, 'sourceDependencies': 723, 'sourceSnapshotFiles': 724,
    'methodFilesSha256': publication['methodFilesSha256'], 'publicationSha256': hashlib.sha256(review.read_bytes()).hexdigest(),
    'qa': {'bytes': archive.stat().st_size, 'sha256': hashlib.sha256(archive.read_bytes()).hexdigest(), 'members': members},
    'historicalPinsPreserved': 599, 'measurementProcesses': 0, 'invalidManifestContractProcessesPerNode': 1,
    'archivedCodeExecuted': False, 'executionReady': True, 'newStudyActivated': False,
    'performanceAccepted': None, 'gateReevaluated': False,
    'scientificPositiveReplayComplete': False, 'requiredPublishedHeadCIPending': True,
    'jobTimeoutMinutes': 201, 'setupBudgetMinutes': 14, 'captureTimeoutMinutes': 175,
    'archiveTimeoutMinutes': 4, 'uploadTimeoutMinutes': 3, 'marginMinutes': 5}
(destination / 'summary.json').write_text(json.dumps(summary, indent=2) + '\n', encoding='utf-8', newline='\n')
shutil.copyfile(Path(__file__), destination / Path(__file__).name)
shutil.copyfile(repository / '.cache/create-combined-method-receipt.cjs', destination / 'create-combined-method-receipt.cjs')
memory = repository / 'reports/memory/combined-process-study/20261025-activation'; memory.mkdir()
(memory / 'observations.json').write_text(json.dumps({'results': results, 'measurementProcesses': 0,
    'scope': 'Finite read-only method/transport/progress contracts; no DOM teardown, peak-memory or universal leak claim'},
    indent=2) + '\n', encoding='utf-8', newline='\n')
print(json.dumps({'nodeContractsPerSDK': 36, 'transportContractsPerSDK': 14, 'commands': len(commands),
                  'qaMembers': len(members), 'qaBytes': archive.stat().st_size, 'activated': False}))
