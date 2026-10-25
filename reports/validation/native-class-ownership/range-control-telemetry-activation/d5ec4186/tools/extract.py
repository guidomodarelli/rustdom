"""Extract only independently authenticated transport using current reviewed code, never code from an archive."""
import hashlib
import json
from pathlib import Path
import sys
import types
from collect import POLICY

if sys.flags.optimize:
    raise RuntimeError('Range study extraction requires non-optimized Python')


def current_extractor(repository, transport_policy=None):
    """Configure the authenticated generic reader; an independent historical policy keeps its own original identity."""
    filename = repository / POLICY['sourceExtractionReaderPath']
    content = filename.read_bytes()
    assert hashlib.sha256(content).hexdigest() == POLICY['sourceExtractionReaderSha256']
    module = types.ModuleType('current_range_study_extraction')
    module.__file__ = str(filename)
    exec(compile(content, str(filename), 'exec'), module.__dict__)
    module.POLICY = dict(POLICY if transport_policy is None else transport_policy)
    module.FILES = module.POLICY['files']
    return module


def extract(repository, collection, destination):
    """Fail before reading evidence when the actual completed artifact pins remain unqualified."""
    return current_extractor(repository).extract(repository, collection, destination)


if __name__ == '__main__':
    assert len(sys.argv) == 4, 'Provide repository, authenticated collection and fresh extraction destination'
    print(json.dumps(extract(*map(Path, sys.argv[1:4]))))
