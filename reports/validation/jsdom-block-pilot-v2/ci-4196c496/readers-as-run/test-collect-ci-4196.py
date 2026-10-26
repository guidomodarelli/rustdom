"""Exercise real ZIP bytes and exclusive output behavior without invoking GitHub or DOM."""
from pathlib import Path
import hashlib
import json
import stat
import subprocess
import sys
import zipfile

source = Path('/mnt/c/Users/guido/.codex/worktrees/native-class-ownership/rustdom')
script = source/'.cache/collect-ci-4196-bounded.py'
namespace = {'__name__':'current_collector_test','__file__':str(script)}
exec(compile(script.read_bytes(),str(script),'exec'),namespace)
root = Path('/run/rustdom-ci-4196-reader-tests-pinned-20261026')
root.mkdir(exist_ok=False)
cases = []
def archive(name, entries):
    target = root/(name+'.zip')
    with zipfile.ZipFile(target,'x') as writer:
        for path, payload in entries:
            writer.writestr(path,payload)
    return target
def rejected(label, target):
    try:
        namespace['inventory_zip'](target)
    except (ValueError,zipfile.BadZipFile):
        cases.append({'name':label,'passed':True})
    else:
        raise AssertionError('Unsafe ZIP was accepted: '+label)
payload = b'unchanged original bytes\x00\xff\r\n'
valid = archive('valid',[('nested/data.bin',payload)])
inventory = namespace['inventory_zip'](valid)
assert inventory[0]['sha256'] == hashlib.sha256(payload).hexdigest()
assert inventory[0]['bytes'] == len(payload)
cases.append({'name':'real-binary-member-digest','passed':True})
rejected('path-traversal',archive('escape',[('../escape',payload)]))
rejected('portable-collision',archive('collision',[('Data.bin',payload),('data.bin',payload)]))
rejected('file-directory-collision',archive('file-directory',[('folder',payload),('folder/data',payload)]))
member = zipfile.ZipInfo('link')
member.create_system = 3
member.external_attr = (stat.S_IFLNK | 0o777) << 16
rejected('symbolic-link',archive('link',[(member,b'../outside')]))
corrupt = archive('corrupt',[('data.bin',payload)])
raw = corrupt.read_bytes()
assert raw.count(payload) == 1
corrupt.write_bytes(raw.replace(payload,b'X'+payload[1:],1))
rejected('crc-corruption',corrupt)
existing = root/'existing'
existing.mkdir()
sentinel = existing/'preserve.bin'
sentinel.write_bytes(payload)
namespace['ROOT'] = existing
try:
    namespace['collect']()
except FileExistsError:
    assert list(existing.iterdir()) == [sentinel] and sentinel.read_bytes() == payload
    cases.append({'name':'existing-output-unchanged','passed':True})
else:
    raise AssertionError('Existing collection output was modified')
completed = subprocess.run([sys.executable,'-O',str(script)],capture_output=True)
assert completed.returncode != 0 and b'non-optimized Python' in completed.stderr
assert not Path('/run/rustdom-ci-4196-artifacts-20261026').exists()
cases.append({'name':'optimized-python-refused-before-output','passed':True})
dependencies = root/'dependencies'
for relative in namespace['READER_DEPENDENCIES']:
    target = dependencies/relative
    target.parent.mkdir(parents=True,exist_ok=True)
    target.write_bytes((source/relative).read_bytes())
namespace['verify_reader_dependencies'](dependencies)
cases.append({'name':'closed-reader-dependencies-admitted','passed':True})
for index,relative in enumerate(namespace['READER_DEPENDENCIES']):
    target = dependencies/relative
    original = target.read_bytes()
    target.write_bytes(original+b'\nchanged dependency\n')
    try:
        namespace['verify_reader_dependencies'](dependencies)
    except ValueError:
        cases.append({'name':'changed-transitive-dependency-'+str(index),'passed':True})
    else:
        raise AssertionError('Reader accepted a modified policy or executable dependency')
    target.write_bytes(original)
receipt = {'collectorSha256':hashlib.sha256(script.read_bytes()).hexdigest(),'cases':cases,
    'GitHubInvoked':False,'DOMExecuted':False,'scientificCaptureExecuted':False}
(root/'summary.json').write_bytes(json.dumps(receipt,indent=2).encode()+b'\n')
print(json.dumps(receipt),flush=True)
