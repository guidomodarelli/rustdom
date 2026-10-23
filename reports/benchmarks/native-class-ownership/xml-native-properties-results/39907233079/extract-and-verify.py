import hashlib
import json
import os
from pathlib import Path
import subprocess
import tarfile
import tempfile

repository = Path('/mnt/c/Users/guido/.codex/worktrees/native-class-ownership/rustdom')
collection = repository / '.cache/xml-native-properties-original-39907233079'
receipt = json.loads((collection / 'collection.json').read_text())
transport = collection / 'xml-full-inputs.tar.xz'
assert hashlib.sha256(transport.read_bytes()).hexdigest() == receipt['tarSha256']
root = Path(tempfile.mkdtemp(prefix='xml-native-properties-39907233079-', dir='/home/guido/rustdom-validation'))
with tarfile.open(transport) as archive:
    for entry in archive:
        assert not Path(entry.name).is_absolute() and '..' not in Path(entry.name).parts
        assert not entry.isdev()
        if entry.issym():
            assert ((root / entry.name).parent / entry.linkname).resolve().is_relative_to(root)
        if entry.islnk():
            assert (root / entry.linkname).resolve().is_relative_to(root)
    archive.extractall(root, filter=tarfile.tar_filter)
study = root / 'xml-full-inputs'
command = ['python3', str(repository / 'reports/benchmarks/native-class-ownership/verify-xml-current-capture.py'),
           str(study / 'capture'), str(study / 'preparation'),
           '/mnt/c/Users/guido/ghq/projects/rustdom/.tools/node/bin/node']
result = subprocess.run(command, capture_output=True)
(root / 'verification.stdout.json').write_bytes(result.stdout)
(root / 'verification.stderr.log').write_bytes(result.stderr)
state = {'root': str(root), 'command': command, 'exitCode': result.returncode, 'measurementExecuted': False}
(repository / '.cache/xml-native-properties-verification-state.json').write_text(json.dumps(state, indent=2) + '\n')
print(json.dumps(state), flush=True)
if result.returncode:
    print(result.stderr.decode(), flush=True)
else:
    verification = json.loads(result.stdout)
    print(json.dumps({name: value for name, value in verification.items() if name != 'summaries'}), flush=True)

raise SystemExit(result.returncode)
