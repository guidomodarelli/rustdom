"""Observe this exact published contract run; never launch or retry a workflow."""
import datetime
import json
from pathlib import Path
import subprocess

repo = Path.cwd(); run_id = 40176086547
head = 'd14941173bf80e354b0935f4a79cea2edcfa1dca'
output = repo / '.cache/combined-worker-contract-ci-d149'; output.mkdir(exist_ok=True)
raw = subprocess.check_output(['gh', 'api', f'repos/guidomodarelli/rustdom/actions/runs/{run_id}'])
observed = json.loads(raw)
assert observed['id'] == run_id and observed['head_sha'] == head and observed['run_attempt'] == 1
assert observed['path'] == '.github/workflows/combined-process-study-contracts.yml'
timestamp = datetime.datetime.now(datetime.timezone.utc)
(output / ('run-' + timestamp.strftime('%Y%m%dT%H%M%S%fZ') + '.json')).write_bytes(raw)
jobs_raw = subprocess.check_output(['gh', 'api', f'repos/guidomodarelli/rustdom/actions/runs/{run_id}/attempts/1/jobs'])
jobs = json.loads(jobs_raw); (output / ('jobs-' + timestamp.strftime('%Y%m%dT%H%M%S%fZ') + '.json')).write_bytes(jobs_raw)
status = {'run': run_id, 'attempt': 1, 'head': head, 'status': observed['status'], 'conclusion': observed['conclusion'],
    'url': observed['html_url'], 'jobs': [{'id': job['id'], 'name': job['name'], 'status': job['status'], 'conclusion': job['conclusion']} for job in jobs['jobs']],
    'observedAtUTC': timestamp.isoformat(), 'workflowRelaunched': False}
for state_file in [repo / '.cache/range-inventory-operational-state.json', Path('C:/Users/guido/ghq/projects/rustdom/.codex-autofix/watch-80.range-telemetry-enabled-d5ec4186.json')]:
    state = json.loads(state_file.read_bytes())
    qualification = state['combinedRangeCandidate']['prospectiveProcessMethod']['workerQualification']
    assert qualification['publishedHead'] == head
    qualification['hostedContractCI'] = status
    state['observedAtUTC'] = timestamp.isoformat()
    state_file.write_text(json.dumps(state, indent=2) + '\n', encoding='utf-8')
print(json.dumps(status))
