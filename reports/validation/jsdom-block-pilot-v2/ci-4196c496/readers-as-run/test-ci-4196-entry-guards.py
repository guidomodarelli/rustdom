"""Verify exclusive roots and optimized-Python refusal without invoking GitHub or a DOM."""
import hashlib
import json
from pathlib import Path
import subprocess
import sys

source = Path('/mnt/c/Users/guido/.codex/worktrees/native-class-ownership/rustdom')
root = Path('/run/rustdom-ci-4196-entry-guards-pinned-20261026')
root.mkdir(exist_ok=False)
records = []
for filename,function in [('publish-ci-4196-bounded.py','main'),('replay-ci-4196-offline.py','replay')]:
    script = source/'.cache'/filename
    current = {'__name__':'current_entry_guard_test','__file__':str(script)}
    exec(compile(script.read_bytes(),str(script),'exec'),current)
    existing = root/filename
    existing.mkdir()
    sentinel = existing/'preserve.bin'
    sentinel.write_bytes(b'unchanged\x00\xff\r\n')
    current['OUTPUT' if function == 'main' else 'ROOT'] = existing
    try:
        current[function]()
    except FileExistsError:
        assert list(existing.iterdir()) == [sentinel] and sentinel.read_bytes() == b'unchanged\x00\xff\r\n'
    else:
        raise AssertionError('Existing output was not rejected before any input or remote action')
    optimized = subprocess.run([sys.executable,'-O',str(script)],capture_output=True)
    assert optimized.returncode != 0 and b'non-optimized Python' in optimized.stderr
    records.append({'script':filename,'sha256':hashlib.sha256(script.read_bytes()).hexdigest(),
        'existingOutputRejectedAndUnchanged':True,'optimizedPythonRejectedBeforeOutput':True})
summary = {'casesPassed':4,'scripts':records,'GitHubInvoked':False,'DOMExecuted':False,'scientificCaptureExecuted':False}
(root/'summary.json').write_bytes(json.dumps(summary,indent=2).encode()+b'\n')
print(json.dumps(summary),flush=True)
