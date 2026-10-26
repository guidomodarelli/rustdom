"""Hydrate the unchanged v1 ancestor and numeric package in an actual clean Git checkout."""
import hashlib
import json
from pathlib import Path
import sys
import types

if sys.flags.optimize:
    raise RuntimeError('Pilot source preparation requires non-optimized Python')
SOURCE = Path(__file__).resolve().parent
REPOSITORY = SOURCE.parents[5]
POLICY = json.loads((SOURCE.parent / 'constants/capture.json').read_bytes())


def current_checkout(repository=REPOSITORY):
    """Load only independently pinned source bytes; never consult executable Python caches."""
    binding = POLICY['checkoutAuthenticator']
    path = repository / binding['path']
    if not path.is_file() or path.is_symlink():
        raise ValueError('Pilot source preparation requires a physical current hydrator')
    raw = path.read_bytes()
    if hashlib.sha256(raw).hexdigest() != binding['sha256']:
        raise ValueError('Pilot source hydrator changed before execution: ' + binding['path'])
    checkout = types.ModuleType('current_numeric_checkout')
    checkout.__file__ = str(path)
    exec(compile(raw, str(path), 'exec'), checkout.__dict__)
    return checkout


def populate(repository):
    """Reuse the real Git hydrator, then require every independently pinned ancestor byte."""
    checkout = current_checkout()
    checkout.populate(repository, checkout.required(repository))
    # The ancestor publication itself is a separate fixed input, never the new method's self-produced catalog.
    checkout.populate(repository, [POLICY['historicalReceipt']])
    receipt = repository / POLICY['historicalReceipt']
    raw = receipt.read_bytes()
    assert hashlib.sha256(raw).hexdigest() == POLICY['historicalReceiptSha256']
    files = json.loads(raw)['files']
    assert len(files) == POLICY['historicalPins']
    result = checkout.populate(repository, files)
    for relative, checksum in files.items():
        assert hashlib.sha256((repository / relative).read_bytes()).hexdigest() == checksum, relative
    return {**result, 'ancestorPinsVerified': len(files), 'DOMExecuted': False}


if __name__ == '__main__':
    assert len(sys.argv) == 2, 'Provide the actual clean sparse Git source checkout'
    print(json.dumps(populate(Path(sys.argv[1]).resolve(strict=True))))
