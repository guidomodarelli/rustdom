import hashlib
import json
import pathlib
import shutil
import subprocess
import tempfile

cache = pathlib.Path('/mnt/c/Users/guido/ghq/projects/rustdom/.cache')
repository = pathlib.Path('/mnt/c/Users/guido/.codex/worktrees/native-class-ownership/rustdom')
proof = json.loads((cache / 'inline-published-harness.json').read_text())
assert proof['publishedCommit'] == 'eaeca4af3084a23b96fc0214240b552204018c22'
assert proof['harness']['sha256'] == '96491ee1de34a5f98b4c6e69a7c2e62fab4fa682e7992e9b0ded067e02e8b303'
marker = cache / 'paired-inline-study-root.json'
assert not marker.exists(), 'An inline study root is already prepared; inspect it, never replace it.'
root = pathlib.Path(tempfile.mkdtemp(prefix='rustdom-paired-inline-study-', dir='/home/guido'))
harness = root / 'harness-source'
harness.mkdir()
for entry in proof['gitFiles']:
    raw = (repository / entry['path']).read_bytes()
    assert len(raw) == entry['bytes'] and hashlib.sha256(raw).hexdigest() == entry['sha256']
    assert hashlib.sha1(b'blob ' + str(len(raw)).encode() + b'\0' + raw).hexdigest() == entry['gitBlob']
    destination = harness / entry['path']
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(raw)
node = '/mnt/c/Users/guido/ghq/projects/rustdom/.tools/node-22/bin/node'
module = str(harness / 'reports/benchmarks/native-class-ownership/paired-inline-experiment.cjs')
identity = json.loads(subprocess.check_output([node, '-p', f'JSON.stringify(require({json.dumps(module)}).captureHarness())']))
assert identity['sha256'] == proof['harness']['sha256'] and len(identity['files']) == 357
assert identity['identity']['sourceHash'] == '0d67e1d821c70371ca1b82817870b7ad6a053f534161ae9096591d7199d0b947'
for source, destination in (
    ('inline-published-harness.json', 'published-harness-proof.json'),
    ('native-inline-runtime-manifest.json', 'runtime-manifest.json'),
    ('native-inline-identities.json', 'runtime-identities.json'),
    ('launch-paired-inline-study.sh', 'launcher.sh'),
    ('prepare-paired-inline-study.py', 'prepare.py'),
):
    shutil.copyfile(cache / source, root / destination)
validation = repository / 'reports/validation/native-class-ownership/inline-candidate'
build = root / 'build-provenance'
build.mkdir()
for filename in ('build-inputs.json', 'native-build.json', 'native-inline.patch', 'validation.json'):
    shutil.copyfile(validation / filename, build / filename)
result = {'root': str(root), 'harness': str(harness), 'publishedCommit': proof['publishedCommit'],
    'harnessSha256': identity['sha256'], 'files': len(identity['files']),
    'status': 'Prepared only. Review receipt and provenance must be attached before measuring.'}
(root / 'prepared.json').write_text(json.dumps(result, indent=2) + '\n')
with marker.open('x') as stream:
    stream.write(json.dumps(result, indent=2) + '\n')
print(json.dumps(result))
