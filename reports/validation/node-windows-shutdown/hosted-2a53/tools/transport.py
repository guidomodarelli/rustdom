"""Preserve transport failures separately; only verified complete bytes can be reused."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys

if sys.flags.optimize:
    raise RuntimeError('Transport verification requires non-optimized Python')

def fetch(endpoint, target, command, expected=None):
    """Run an actual transport command, preserving partial bytes and an exclusive success receipt."""
    target = Path(target)
    receipt = target.with_name(target.name + '.fetch.json')
    if target.is_symlink() or receipt.is_symlink():
        raise RuntimeError('Transport destinations cannot be symlinks: ' + str(target))
    def authenticate(raw):
        digest = hashlib.sha256(raw).hexdigest()
        if expected is not None:
            assert len(raw) == expected['bytes'] and digest == expected['sha256']
        return {'endpoint': endpoint, 'bytes': len(raw), 'sha256': digest}
    if target.exists():
        raw = target.read_bytes()
        observed = authenticate(raw)
        if receipt.exists():
            assert json.loads(receipt.read_bytes()) == observed
        elif expected is not None:
            with receipt.open('x', encoding='utf-8', newline='\n') as stream:
                stream.write(json.dumps(observed, indent=2) + '\n')
        else:
            raise RuntimeError('Existing unreceipted transport must remain partial: ' + str(target))
        return raw
    partial = target.with_name(target.name + '.partial')
    with partial.open('xb') as stream:
        result = subprocess.run(command, stdout=stream, stderr=subprocess.PIPE, timeout=120)
    with target.with_name(target.name + '.stderr.log').open('xb') as stream:
        stream.write(result.stderr)
    if result.returncode:
        raise RuntimeError('Failed transport preserved as partial: ' + endpoint)
    raw = partial.read_bytes()
    observed = authenticate(raw)
    assert not receipt.exists()
    # Hard-link publication fails if any destination appeared, including dangling symlinks.
    os.link(partial, target)
    partial.unlink()
    with receipt.open('x', encoding='utf-8', newline='\n') as stream:
        stream.write(json.dumps(observed, indent=2) + '\n')
    return raw
