"""Materialize only the fixed contract dependencies in a real Git checkout, preserving the frozen historical graph."""
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys

if sys.flags.optimize:
    raise RuntimeError('Combined contract checkout requires non-optimized Python')


def configure(repository):
    """Apply deterministic sparse patterns and verify every required source/data byte before tests."""
    repository = repository.resolve(strict=True)
    assert Path(__file__).resolve().is_relative_to(repository), 'Combined contract checkout: use its own current source checkout'
    assert (repository / '.git').is_dir() and not (repository / '.git').is_symlink(), 'Combined contract checkout: real Git directory required'
    policy = json.loads((Path(__file__).parent.parent / 'constants/ci-files.json').read_bytes())
    patterns = ['/' + re.sub(r'([\\*?\[\]])', r'\\\1', name) for name in policy['files']]
    patterns.append('/' + policy['methodDirectory'] + '/')
    result = subprocess.run(['git', 'sparse-checkout', 'set', '--no-cone', '--stdin'], cwd=repository,
                            input='\n'.join(patterns) + '\n', capture_output=True, text=True,
                            timeout=policy['checkoutTimeoutSeconds'])
    if result.returncode:
        raise RuntimeError('Combined contract checkout: git sparse-checkout failed: ' + result.stderr)
    for name, expected in policy['files'].items():
        assert hashlib.sha256((repository / name).read_bytes()).hexdigest() == expected, 'Combined contract checkout: changed source/data ' + name
    head = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=repository, text=True).strip()
    return {'sourceCommit': head, 'verifiedFiles': len(policy['files']), 'historicalPins': policy['historicalPins'],
            'samplerInvoked': False, 'performanceAccepted': None, 'gateReevaluated': False}


if __name__ == '__main__':
    assert len(sys.argv) == 2, 'Provide the current real Git checkout'
    print(json.dumps(configure(Path(sys.argv[1]))))
