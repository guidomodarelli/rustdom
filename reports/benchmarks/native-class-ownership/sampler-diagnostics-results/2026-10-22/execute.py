import hashlib
import json
import os
import pathlib
import platform
import shutil
import subprocess
import tempfile
import time

repository = pathlib.Path('/mnt/c/Users/guido/.codex/worktrees/native-class-ownership/rustdom')
validated = pathlib.Path('/tmp/rustdom-sampler-diagnostics-final-tktpjoet')
base = pathlib.Path('/tmp/rustdom-ownership-results-m7jq3638/independent-order')
root = pathlib.Path(tempfile.mkdtemp(prefix='rustdom-sampler-diagnostics-capture-'))
shutil.copyfile(__file__, root / 'execute.py')
shutil.copyfile(validated / 'manifest.json', root / 'manifest.json')
(root / 'host.json').write_text(json.dumps({'platform': platform.platform(), 'cpuCount': os.cpu_count(),
    'cpuModel': next(line.split(':', 1)[1].strip() for line in pathlib.Path('/proc/cpuinfo').read_text().splitlines() if line.startswith('model name')),
    'memoryTotal': next(line for line in pathlib.Path('/proc/meminfo').read_text().splitlines() if line.startswith('MemTotal:')),
    'scope': 'Local WSL diagnostic CPU/GC capture; not acceptance'}, indent=2) + '\n')
shutil.copyfile(repository / 'reports/benchmarks/native-class-ownership/sampler-diagnostics/PROTOCOL.md', root / 'PROTOCOL.md')
published = json.loads((repository / 'reports/validation/native-class-ownership/sampler-diagnostics-method/published-source-verification.json').read_bytes())
assert published['allPublishedSourcesMatch'] and published['methodSourceCount'] == 7
index = {'diagnosticOnly': True, 'gateReevaluated': False, 'accepted': None, 'complete': False,
         'methodCommit': published['commit'], 'startedAt': time.time(), 'root': str(root), 'processes': []}
manifest = json.loads((root / 'manifest.json').read_bytes())
ledger = json.loads((validated / 'source-method-files.json').read_bytes())
for name, checksum in ledger.items():
    assert hashlib.sha256((validated / 'source' / name).read_bytes()).hexdigest() == checksum
assert hashlib.sha256((validated / 'derived/worker.cjs').read_bytes()).hexdigest() == ledger['worker.cjs']
derived = json.loads((validated / 'derived/preparation.json').read_bytes())
for name, checksum in derived['derivedFiles'].items():
    assert hashlib.sha256((validated / 'derived' / name).read_bytes()).hexdigest() == checksum

def save():
    (root / 'index.json').write_text(json.dumps(index, indent=2) + '\n')

def preparation(node, label):
    command = [node, '-e', 'const study=require(process.argv[1]); process.stdout.write(JSON.stringify(study.inspectPreparation(process.argv[2])));',
               str(base / 'node-22/harness/reports/benchmarks/native-class-ownership/hosted-main-experiment.cjs'), str(base / 'prepared/ownership-build')]
    result = subprocess.run(command, capture_output=True, text=True)
    (root / (label + '.stdout.log')).write_text(result.stdout)
    (root / (label + '.stderr.log')).write_text(result.stderr)
    assert result.returncode == 0, result.stderr
    assert json.loads(result.stdout) == manifest['preparationBefore']

save()
print(json.dumps({'root': str(root)}), flush=True)
plans = [('J0', 'AA', 'jsdom', 'A'), ('A0', 'AA', 'rustdom', 'A'),
         ('J1', 'AA', 'jsdom', 'B'), ('A1', 'AA', 'rustdom', 'B'), ('B', 'AB', 'rustdom', 'B')]
try:
    for label, binary in [('node-22', 'node-22'), ('node-24', 'node')]:
        node = str(pathlib.Path('/mnt/c/Users/guido/ghq/projects/rustdom/.tools') / binary / 'bin/node')
        preparation(node, label + '-before')
        ordered_plans = plans if label == 'node-22' else list(reversed(plans))
        for physical, phase, engine, treatment in ordered_plans:
            directory = root / label / physical
            directory.mkdir(parents=True)
            command = [node, '--expose-gc', '--cpu-prof', '--cpu-prof-interval=100',
                       '--cpu-prof-dir=' + str(directory), '--cpu-prof-name=cpu-profile.json',
                       str(validated / 'derived/worker.cjs'), str(root / 'manifest.json'), phase, engine, '0', treatment, str(directory / 'report.json')]
            record = {'node': label, 'physical': physical, 'command': command, 'startedAt': time.time()}
            index['processes'].append(record)
            with (directory / 'stdout.log').open('x') as stdout, (directory / 'stderr.log').open('x') as stderr:
                child = subprocess.Popen(command, stdout=stdout, stderr=stderr)
                record['pid'] = child.pid
                save()
                record['exitCode'] = child.wait()
            record['finishedAt'] = time.time()
            save()
            assert record['exitCode'] == 0, str(directory)
            report = json.loads((directory / 'report.json').read_bytes())
            telemetry = json.loads((directory / 'report.json.telemetry.json').read_bytes())
            assert report['complete'] and telemetry['complete'] and report['schedule']['physical'] == physical
            assert len(report['batches']) == 8 and all(len(batch['sampleTimings']) == 12 for batch in report['batches'])
            profile = directory / 'cpu-profile.json'
            assert profile.stat().st_size > 0
            record['profileSha256'] = hashlib.sha256(profile.read_bytes()).hexdigest()
            save()
            print(json.dumps({'node': label, 'physical': physical, 'exitCode': record['exitCode']}), flush=True)
        preparation(node, label + '-after')
    index['complete'] = True
except BaseException as error:
    index['failure'] = {'type': type(error).__name__, 'message': str(error)}
    raise
finally:
    index['finishedAt'] = time.time()
    save()
