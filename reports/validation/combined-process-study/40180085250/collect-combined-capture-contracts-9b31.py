"""Authenticate the already completed 9b31 contract run, preserving provider bytes without executing an artifact."""
from pathlib import Path
import subprocess

repository = Path.cwd()
output = repository / '.cache/combined-capture-contract-ci-9b31'
output.mkdir(exist_ok=True)
run_id = 40180085250
(output / 'run-id.txt').write_text(str(run_id) + '\n', encoding='utf-8')
for endpoint, filename in [(f'actions/runs/{run_id}', 'run.json'), (f'actions/runs/{run_id}/attempts/1/jobs', 'jobs.json')]:
    (output / filename).write_bytes(subprocess.check_output(['gh', 'api', 'repos/guidomodarelli/rustdom/' + endpoint]))
source = (repository / '.cache/collect-combined-worker-contracts-d149-transport.py').read_text(encoding='utf-8')
for before, after in [('combined-worker-contract-ci-d149', 'combined-capture-contract-ci-9b31'),
    ('40176086547', str(run_id)), ('d14941173bf80e354b0935f4a79cea2edcfa1dca', '9b31d4cc3c85ba9e64d58ba1a92cf13caca89be6'),
    ('tests 17', 'tests 29'), ('pass 17', 'pass 29'), ("'tests':17", "'tests':29"), ('==688', '==700')]:
    source = source.replace(before, after)
script = repository / '.cache/collect-combined-capture-contracts-9b31-transport.py'
script.write_text(source, encoding='utf-8', newline='\n')
subprocess.run(['python', str(script)], check=True)
