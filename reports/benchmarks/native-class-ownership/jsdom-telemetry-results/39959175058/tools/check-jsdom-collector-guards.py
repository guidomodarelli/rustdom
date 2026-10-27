import json
import os
from pathlib import Path
import subprocess
import sys

if sys.flags.optimize:
    raise RuntimeError('Guard validation requires non-optimized Python')
repository = Path(__file__).resolve().parents[1]
results = []
for name, message in [('collect-jsdom-telemetry.py', 'collection'), ('extract-jsdom-telemetry.py', 'extraction'), ('summarize-jsdom-telemetry-result.py', 'summary')]:
    for mode in ['flag', 'environment']:
        environment = os.environ.copy()
        arguments = [sys.executable]
        if mode == 'flag': arguments.append('-O')
        else: environment['PYTHONOPTIMIZE'] = '1'
        result = subprocess.run([*arguments, str(repository / '.cache' / name)], env=environment, capture_output=True, text=True)
        assert result.returncode != 0
        assert f'JSDOM telemetry {message} requires non-optimized Python' in result.stderr
        assert result.stdout == ''
        results.append({'script': name, 'mode': mode, 'exitCode': result.returncode, 'stdout': result.stdout, 'stderr': result.stderr})
record = {'passed': len(results), 'samplerExecuted': False, 'cases': results}
(repository / '.cache/jsdom-telemetry-guard-tests.json').write_text(json.dumps(record, indent=2) + '\n', encoding='utf8')
print(json.dumps({'passed': len(results), 'samplerExecuted': False}))
