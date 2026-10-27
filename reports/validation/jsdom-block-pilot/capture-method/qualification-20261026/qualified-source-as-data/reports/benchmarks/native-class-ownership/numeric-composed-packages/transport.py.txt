"""Bind the current reviewed strict archive reader to a new independent numeric payload; no archived code execution."""
import hashlib
import json
from pathlib import Path
import sys
import types

if sys.flags.optimize:
    raise RuntimeError('Numeric package transport requires non-optimized Python')

SOURCE = Path(__file__).resolve().parent
REPOSITORY = SOURCE.parents[3]
POLICY = json.loads((SOURCE / 'constants/transport.json').read_bytes())

def current_module(binding):
    location = REPOSITORY / binding['path']
    assert location.is_file() and not location.is_symlink()
    raw = location.read_bytes()
    assert hashlib.sha256(raw).hexdigest() == binding['sha256']
    module = types.ModuleType('numeric_package_archive_reader')
    module.__file__ = str(location)
    exec(compile(raw, str(location), 'exec'), module.__dict__)
    return module

def reader():
    """Authenticate all transitive legacy inputs before loading the current source reader, without changing historical pins."""
    binding = POLICY['assemblyPolicy']
    assert hashlib.sha256((REPOSITORY / binding['path']).read_bytes()).hexdigest() == binding['sha256']
    assembler = current_module(POLICY['assembler'])
    assembler.verify_reader_graph()
    archive_reader = current_module(POLICY['reader'])
    archive_reader.POLICY = {**archive_reader.POLICY, **POLICY['archivePolicy']}
    return archive_reader

def verify(archive):
    return reader().verify(archive)

def extract(archive, destination):
    return reader().extract(archive, destination)

if __name__ == '__main__':
    if len(sys.argv) == 3 and sys.argv[1] == '--verify':
        print(json.dumps(verify(Path(sys.argv[2]))))
    else:
        assert len(sys.argv) == 4 and sys.argv[1] == '--extract', 'Provide --verify archive or --extract archive new-output'
        print(json.dumps(extract(*map(Path, sys.argv[2:]))))
