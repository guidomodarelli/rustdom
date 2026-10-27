"""Collect only the completed d149 contract run with the existing authenticated transport reader."""
from pathlib import Path
import subprocess

repo = Path.cwd(); out = repo / '.cache/combined-worker-contract-ci-d149'
out.mkdir(exist_ok=True)
(out / 'run-id.txt').write_text('40176086547\n', encoding='utf-8')
(out / 'run.json').write_bytes(subprocess.check_output(['gh', 'api', 'repos/guidomodarelli/rustdom/actions/runs/40176086547']))
(out / 'jobs.json').write_bytes(subprocess.check_output(['gh', 'api', 'repos/guidomodarelli/rustdom/actions/runs/40176086547/attempts/1/jobs']))
source = (repo / '.cache/collect-combined-prospective-contracts-c6cf.py').read_text(encoding='utf-8')
for before, after in [('combined-prospective-contract-ci-c6cf', 'combined-worker-contract-ci-d149'),
    ('40173536771', '40176086547'), ('c6cf340ef1d46f64f4512ec976ec1a50a07c660f', 'd14941173bf80e354b0935f4a79cea2edcfa1dca'),
    ('tests 10', 'tests 17'), ('pass 10', 'pass 17'), ("'tests':10", "'tests':17"), ('==679', '==688')]:
    source = source.replace(before, after)
source = source.replace("'samplerInvoked':False,'archivedCodeExecuted':False", "'collectorExecutedDOM':False,'measurementProcesses':0,'invalidManifestContractProcessesPerNode':1,'archivedCodeExecuted':False")
code = repo / '.cache/collect-combined-worker-contracts-d149-transport.py'
code.write_text(source, encoding='utf-8')
subprocess.run(['python', str(code)], check=True)
