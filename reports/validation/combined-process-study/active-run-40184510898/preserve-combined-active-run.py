"""Preserve completed exact-source CI and the one observed live scientific run without touching its frozen method or invoking measurement."""
import hashlib
import json
from pathlib import Path
import shutil
import zipfile

repository = Path.cwd()
ci_source = repository / '.cache/combined-activation-contract-ci-95e6'
ci_target = repository / 'reports/validation/combined-process-study/40183945744'; ci_target.mkdir()
for name in ['run.json', 'jobs.json', 'artifacts.json', 'collection.json', 'run-logs.zip', 'run-logs.json', 'run-id.txt']:
    shutil.copyfile(ci_source / name, ci_target / name)
for directory in ci_source.glob('artifact-*'):
    if directory.is_dir(): shutil.copytree(directory, ci_target / directory.name)
shutil.copyfile(repository / '.cache/collect-combined-activation-contracts-95e6.py', ci_target / 'collect-combined-activation-contracts-95e6.py')
(ci_target / '.gitattributes').write_bytes(b'* -text\n')

source = repository / '.cache/combined-process-run-40184510898'
trigger = repository / '.cache/combined-process-trigger-95e64bd2'
target = repository / 'reports/validation/combined-process-study/active-run-40184510898'; target.mkdir()
(target / '.gitattributes').write_bytes(b'* -text\n')
for name in ['binding.activation.json', 'latest.json']:
    shutil.copyfile(source / name, target / name)
for name in ['intent.json', 'application-receipt.json', 'application.stdout.log', 'application.stderr.log', 'operator-review.json']:
    shutil.copyfile(trigger / name, target / name)
shutil.copyfile(repository / '.cache/combined-activation-published-review-95e64bd2.json', target / 'published-source-review.json')
archive = target / 'observations.zip'; members = []
with zipfile.ZipFile(archive, 'x', compression=zipfile.ZIP_DEFLATED, compresslevel=6) as output:
    for root, prefix in [(source / 'observations', 'run'), (trigger / 'observations', 'activation')]:
        for filename in sorted(root.iterdir()):
            if filename.is_file():
                raw = filename.read_bytes(); name = prefix + '/' + filename.name; output.writestr(name, raw)
                members.append({'name': name, 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()})
    for name in ['activate-combined-process-95e64bd2.py', 'observe-combined-science-40184510898.py']:
        raw = (repository / '.cache' / name).read_bytes(); key = 'audit-only/' + name
        output.writestr(key, raw)
        members.append({'name': key, 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()})
with zipfile.ZipFile(archive) as output:
    assert output.testzip() is None and len(output.infolist()) == len(members)
    for member in members: assert hashlib.sha256(output.read(member['name'])).hexdigest() == member['sha256']
latest = json.loads((target / 'latest.json').read_bytes())
binding = json.loads((target / 'binding.activation.json').read_bytes())
assert latest['runId'] == binding['runId'] == 40184510898 and latest['jobId'] == binding['jobId'] == 121142337986
assert latest['status'] == latest['jobStatus'] == 'in_progress'
assert 'Ejecutar una secuencia completa, sin reintentos' in latest['activeSteps']
assert binding['head'] == '95e64bd20711975b08864cf1bef1dee362b79663' and binding['attempt'] == 1
assert latest['performanceAccepted'] is None and latest['processesObserved'] is None
record = {'runId': binding['runId'], 'jobId': binding['jobId'], 'head': binding['head'], 'attempt': 1,
    'snapshotAtUTC': latest['observedAtUTC'], 'statusAtSnapshot': latest['status'],
    'captureStepActiveAtSnapshot': True, 'labelAppliedOnce': True, 'plannedProcesses': 2048, 'processesObserved': None,
    'intentCountMeaning': 'intent.measurementProcesses records the prospective plan, not observed completion',
    'publicationSha256': binding['publicationSha256'], 'methodFilesSha256': binding['methodFilesSha256'],
    'observations': {'bytes': archive.stat().st_size, 'sha256': hashlib.sha256(archive.read_bytes()).hexdigest(), 'members': members},
    'scientificArtifactAvailable': False, 'scientificDecisionComplete': False,
    'performanceAccepted': None, 'gateReevaluated': False, 'archivedCodeExecuted': False,
    'historicalPinsPreserved': 599, 'sourceHarnessFiles': 434, 'foreignEntriesPreserved': 48}
(target / 'receipt.json').write_text(json.dumps(record, indent=2) + '\n', encoding='utf-8', newline='\n')
shutil.copyfile(Path(__file__), target / Path(__file__).name)
print(json.dumps({'run': binding['runId'], 'job': binding['jobId'], 'statusAtSnapshot': latest['status'],
                  'observations': len(members), 'scientificDecisionComplete': False}))
