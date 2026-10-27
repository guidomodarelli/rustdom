"""Materialize the read-only exporter dependency superset from the actual current Git tree, never altering the scientific catalog."""
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys

if sys.flags.optimize:
    raise RuntimeError('Combined resource checkout requires non-optimized Python')


def configure(repository):
    repository = repository.resolve(strict=True)
    assert Path(__file__).resolve().is_relative_to(repository)
    assert (repository / '.git').is_dir() and not (repository / '.git').is_symlink()
    policy = json.loads((Path(__file__).parent.parent / 'constants/ci-files.json').read_bytes())
    patterns = ['/' + re.sub(r'([\\*?\[\]])', r'\\\1', name) for name in policy['files']]
    patterns.append('/' + policy['readerDirectory'] + '/')
    result = subprocess.run(['git', 'sparse-checkout', 'set', '--no-cone', '--stdin'], cwd=repository,
        input='\n'.join(patterns) + '\n', capture_output=True, text=True, timeout=policy['checkoutTimeoutSeconds'])
    if result.returncode:
        raise RuntimeError('Combined resource checkout: sparse-checkout failed: ' + result.stderr)
    for name, checksum in policy['files'].items():
        assert hashlib.sha256((repository / name).read_bytes()).hexdigest() == checksum, name
    return {'sourceCommit': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=repository, text=True).strip(),
        'verifiedFiles': len(policy['files']), 'historicalPins': policy['historicalPins'],
        'scientificMethodUnchanged': True, 'samplerInvoked': False, 'performanceAccepted': None}


if __name__ == '__main__':
    assert len(sys.argv) == 2, 'Provide the current real Git checkout'
    print(json.dumps(configure(Path(sys.argv[1]))))
