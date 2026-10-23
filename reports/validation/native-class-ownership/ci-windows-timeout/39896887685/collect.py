import gzip
import hashlib
import json
from pathlib import Path
import subprocess

repository = Path(r'C:\Users\guido\.codex\worktrees\native-class-ownership\rustdom')
run_id, job_id = 39896887685, 120229286098
expected_head = '8fc28d6706a30c1e1179b5799b909c99f71a15c1'
endpoint = 'repos/guidomodarelli/rustdom/actions'
def github(path): return subprocess.check_output(['gh', 'api', path], cwd=repository)
run_bytes, job_bytes = github(f'{endpoint}/runs/{run_id}'), github(f'{endpoint}/jobs/{job_id}')
run, job = json.loads(run_bytes), json.loads(job_bytes)
assert run['head_sha'] == expected_head and job['run_id'] == run_id
assert job['name'] == 'validate (windows-latest)' and job['conclusion'] == 'success'
for name in ['Run npm run validate', 'Run npm run test:memory', 'Run npm run test:package']:
    assert next(step for step in job['steps'] if step['name'] == name)['conclusion'] == 'success'
log_bytes = github(f'{endpoint}/jobs/{job_id}/logs')
lines = log_bytes.decode('utf-8-sig').splitlines()
diagnostics = [json.loads(line[line.index('{'):]) for line in lines
               if '"file":"dom/ranges/Range-mutations-dataChange.html","testCount":2808' in line]
assert len(diagnostics) == 1
diagnostic = diagnostics[0]
for label in ['reference', 'candidate']:
    assert diagnostic[label]['timeoutMultiplier'] == 3
    assert diagnostic[label]['exitCode'] == 0 and diagnostic[label]['signal'] is None
target = repository / f'reports/validation/native-class-ownership/ci-windows-timeout/{run_id}'
target.mkdir(exist_ok=True)
(target / 'run.json').write_bytes(run_bytes)
(target / 'job.json').write_bytes(job_bytes)
(target / 'job.log.gz').write_bytes(gzip.compress(log_bytes, mtime=0))
(target / 'range-execution.json').write_text(json.dumps(diagnostic, indent=2) + '\n', encoding='utf8')
receipt = {'runId': run_id, 'jobId': job_id, 'head': expected_head,
    'windowsJobConclusion': 'success', 'generalWorkflowConclusionAtCollection': run['conclusion'],
    'logBytes': len(log_bytes), 'logSha256': hashlib.sha256(log_bytes).hexdigest(),
    'logGzipSha256': hashlib.sha256((target / 'job.log.gz').read_bytes()).hexdigest(),
    'rangeFixtureCasesPerEngine': 2808, 'rangeTimeoutMultiplier': 3,
    'independentFixtureResultsIncluded': False,
    'scope': 'Successful actual Windows CI job and scalar fixture diagnostics; full vectors are asserted by the unchanged parity comparison'}
(target / 'receipt.json').write_text(json.dumps(receipt, indent=2) + '\n', encoding='utf8')
print(json.dumps(receipt))
