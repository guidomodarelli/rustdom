"""Preserve only the exact published resource reader CI, including failed artifacts, without executing saved code."""
import datetime
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import zipfile

if sys.flags.optimize:
    raise RuntimeError('CI collection requires non-optimized Python')
repository = Path.cwd(); run_id = 40188827176; head = 'fc99401e790d517f7a1f1abec43f0c42c2d2b716'
output = repository / '.cache/combined-resource-contracts-40188827176'
owner = {'runId': run_id, 'head': head, 'attempt': 1, 'reader': 'combined-resource-contracts-collector-v1'}
assert not output.is_symlink()
if output.exists():
    assert json.loads((output / 'owner.json').read_bytes()) == owner
else:
    output.mkdir(); (output / 'owner.json').write_text(json.dumps(owner, indent=2) + '\n', encoding='utf-8', newline='\n')

def sha(raw):
    return hashlib.sha256(raw).hexdigest()

def api(endpoint):
    return subprocess.check_output(['gh', 'api', 'repos/guidomodarelli/rustdom/' + endpoint])

def save(name, raw):
    filename = output / name
    assert not filename.is_symlink()
    filename.write_bytes(raw)
    return json.loads(raw)

run = save('run.json', api(f'actions/runs/{run_id}'))
jobs = save('jobs.json', api(f'actions/runs/{run_id}/attempts/1/jobs?per_page=100'))['jobs']
assert run['id'] == run_id and run['head_sha'] == head and run['run_attempt'] == 1
assert run['path'] == '.github/workflows/combined-resource-exports.yml'
assert {job['id'] for job in jobs} == {121155235262, 121155235433}
for job in jobs:
    assert job['head_sha'] == head and job['run_id'] == run_id and job['run_attempt'] == 1
if run['status'] != 'completed':
    print(json.dumps({'runId': run_id, 'status': run['status'], 'terminal': False, 'workflowRelaunched': False})); sys.exit(0)
artifacts = save('artifacts.json', api(f'actions/runs/{run_id}/artifacts?per_page=100'))
assert artifacts['total_count'] == len(artifacts['artifacts'])
hashes = json.loads((repository / 'reports/benchmarks/native-class-ownership/constants/current-ownership.json').read_bytes())['runtimeExecutableHashes']
results = []
for artifact in artifacts['artifacts']:
    assert artifact['workflow_run']['id'] == run_id and artifact['workflow_run']['head_sha'] == head and not artifact['expired']
    versions = [version for version in ['22.12.0', '24.14.1'] if artifact['name'] == f'combined-resource-contracts-{version}-{head}']
    assert len(versions) == 1
    directory = output / ('artifact-' + str(artifact['id'])); directory.mkdir(exist_ok=True)
    filename = directory / 'artifact.zip'; assert not filename.is_symlink()
    if not filename.exists():
        raw = api('actions/artifacts/' + str(artifact['id']) + '/zip')
        partial = directory / 'artifact.zip.part'; assert not partial.exists()
        partial.write_bytes(raw)
        assert len(raw) == artifact['size_in_bytes'] and 'sha256:' + sha(raw) == artifact['digest']
        partial.rename(filename)
    raw = filename.read_bytes()
    assert len(raw) == artifact['size_in_bytes'] and 'sha256:' + sha(raw) == artifact['digest']
    (directory / 'metadata.json').write_text(json.dumps(artifact, indent=2) + '\n', encoding='utf-8', newline='\n')
    result = {'artifactId': artifact['id'], 'name': artifact['name'], 'bytes': len(raw), 'sha256': sha(raw), 'node': 'v' + versions[0]}
    with zipfile.ZipFile(filename) as archive:
        assert archive.testzip() is None
        members = [{'name': member.filename, 'bytes': member.file_size, 'sha256': sha(archive.read(member))} for member in archive.infolist()]
        (directory / 'members.json').write_text(json.dumps(members, indent=2) + '\n', encoding='utf-8', newline='\n')
        by_name = {Path(member['name']).name: member['name'] for member in members}; assert len(by_name) == len(members)
        def read(name):
            return archive.read(by_name[name])
        result['contractsPassed'] = False
        result['runtimeAuthenticated'] = False
        result['sourceAuthenticated'] = False
        result['readerErrors'] = []
        if 'tests.exit-code' in by_name:
            result['testExitCode'] = read('tests.exit-code').decode().strip()
            logs = read('tests.stdout.log').decode('utf-8')
            result['contractsPassed'] = result['testExitCode'] == '0' and (
                ('# tests 3' in logs and '# pass 3' in logs) or ('ℹ tests 3' in logs and 'ℹ pass 3' in logs))
        try:
            runtime = json.loads(read('runtime.json')); assert runtime['node'] == result['node']
            assert runtime['sha256'] == hashes[runtime['node']]
            result['runtimeSha256'] = runtime['sha256']; result['runtimeAuthenticated'] = True
        except (ValueError, KeyError, AssertionError) as error:
            result['readerErrors'].append({'phase': 'runtime', 'error': str(error)})
        try:
            checkout = json.loads(read('checkout.stdout.log'))
            assert checkout['sourceCommit'] == head and checkout['verifiedFiles'] == 738 and checkout['historicalPins'] == 599
            assert checkout['scientificMethodUnchanged'] is True and checkout['samplerInvoked'] is False
            result['sourceDependencies'] = checkout['verifiedFiles']; result['sourceAuthenticated'] = True
        except (ValueError, KeyError, AssertionError) as error:
            result['readerErrors'].append({'phase': 'source', 'error': str(error)})
    results.append(result)
logs = output / 'run-logs.zip'
if not logs.exists():
    partial = output / 'run-logs.zip.part'; assert not partial.exists()
    partial.write_bytes(api(f'actions/runs/{run_id}/attempts/1/logs'))
    with zipfile.ZipFile(partial) as archive:
        assert archive.testzip() is None
    partial.rename(logs)
with zipfile.ZipFile(logs) as archive:
    assert archive.testzip() is None
    members = [{'name': member.filename, 'bytes': member.file_size, 'sha256': sha(archive.read(member))} for member in archive.infolist()]
(output / 'run-logs.json').write_text(json.dumps({'bytes': logs.stat().st_size, 'sha256': sha(logs.read_bytes()), 'members': members}, indent=2) + '\n', encoding='utf-8', newline='\n')
complete = (run['conclusion'] == 'success' and len(results) == 2 and {item['node'] for item in results} == {'v22.12.0', 'v24.14.1'}
    and all(job['conclusion'] == 'success' for job in jobs)
    and all(item['contractsPassed'] and item['runtimeAuthenticated'] and item['sourceAuthenticated'] for item in results))
receipt = {'runId': run_id, 'head': head, 'attempt': 1, 'status': run['status'], 'conclusion': run['conclusion'],
    'completeSuccess': complete, 'results': results, 'newMeasurementProcesses': 0, 'collectorExecutedDOM': False,
    'archivedCodeExecuted': False, 'performanceAccepted': None, 'gateReevaluated': False,
    'observedAtUTC': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'workflowRelaunched': False}
(output / 'collection.json').write_text(json.dumps(receipt, indent=2) + '\n', encoding='utf-8', newline='\n')
print(json.dumps(receipt))
