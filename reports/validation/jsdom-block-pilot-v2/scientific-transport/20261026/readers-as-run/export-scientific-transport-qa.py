"""Export transport receipts and finite QA files; reference exact originals already committed in source4196."""
import hashlib
import io
import json
from pathlib import Path
import sys
import tarfile
import subprocess

if sys.flags.optimize or sys.platform != 'linux':
    raise RuntimeError('Scientific transport QA export requires non-optimized Linux Python')
ROOTS = {
    'collection-initial-failure':'/run/rustdom-scientific-collection-v1-20261026',
    'collection':'/run/rustdom-scientific-collection-v2-20261026',
    'publication':'/run/rustdom-scientific-publish-20261026',
    'boundaries-v2':'/run/rustdom-artifacts-boundaries-v2-20261026',
    'boundaries-v3':'/run/rustdom-artifacts-boundaries-v3-20261026',
    'boundaries-v4':'/run/rustdom-artifacts-boundaries-v4-20261026',
    'boundaries-current':'/run/rustdom-artifacts-boundaries-v5-20261026',
    'loader-initial':'/run/rustdom-pinned-loader-20261026',
    'loader-current':'/run/rustdom-pinned-loader-v2-20261026',
    'sparse-storage-recovery':'/run/rustdom-source-sparse-storage-20261026',
}
intent = json.loads(Path(ROOTS['sparse-storage-recovery'],'intent.json').read_bytes())
canonical = {(item['bytes'],item['sha256']):item for item in intent['files']}
if len(canonical) != 65 or sum(item['bytes'] for item in canonical.values()) != 812492330:
    raise ValueError('Verified committed original catalog differs')
inventory = []
source = Path('/dev/shm/rustdom-pilot-v2-published-525e2be6')
publication_raw = (source/'reports/validation/jsdom-block-pilot-v2/capture-method/review.json').read_bytes()
if hashlib.sha256(publication_raw).hexdigest() != 'dd019dc36e3921287f8bf1d7591f196e5a62866401d37cae7236ad2197aa3beb':
    raise ValueError('Current method publication changed')
publication = json.loads(publication_raw)
historical_raw = (source/'reports/validation/jsdom-block-pilot/capture-method/review.json').read_bytes()
if hashlib.sha256(historical_raw).hexdigest() != 'f85ec2b26d1839f7130a7bee4e02e560f6497f4003c7c0b2cf3f8c140402f2c1':
    raise ValueError('Historical method publication changed')
historical = json.loads(historical_raw)
catalog_relative = 'reports/benchmarks/native-class-ownership/control-precision/pilot-v2/capture/files.json'
catalog = json.loads((source/catalog_relative).read_bytes())
if len(publication['files']) != 903 or len(catalog['files']) != 902 or len(historical['files']) != 850:
    raise ValueError('Method source graph cardinality changed')
for relative,expected in catalog['files'].items():
    if publication['files'].get(relative) != expected:
        raise ValueError('Source catalog differs from the publication binding')
for relative,expected in publication['files'].items():
    checksum = hashlib.sha256()
    with (source/relative).open('rb') as reader:
        for chunk in iter(lambda:reader.read(1048576),b''):
            checksum.update(chunk)
    if checksum.hexdigest() != expected:
        raise ValueError('Current method dependency changed: '+relative)
for relative,expected in historical['files'].items():
    if publication['files'].get(relative) != expected:
        raise ValueError('Historical source pin changed: '+relative)
git = ['git','--no-optional-locks','-C',str(source)]
if subprocess.check_output(git+['rev-parse','HEAD']).strip() != b'4196c496187c88c92304516287a7e644659a8536' or subprocess.check_output(git+['status','--porcelain']) != b'':
    raise ValueError('Actual reader checkout changed')
buffer = io.BytesIO()
with tarfile.open(fileobj=buffer,mode='w:gz') as archive:
    for role,directory in ROOTS.items():
        root = Path(directory)
        if root.is_symlink() or not root.is_dir():
            raise ValueError('Expected QA root missing: '+role)
        for filename in sorted(root.rglob('*')):
            if filename.is_symlink():
                raise ValueError('QA evidence exporter refuses symlinks')
            if not filename.is_file():
                continue
            relative = filename.relative_to(root)
            checksum = hashlib.sha256()
            with filename.open('rb') as reader:
                for chunk in iter(lambda:reader.read(1048576),b''):
                    checksum.update(chunk)
            record = {'path':role+'/'+relative.as_posix(),'bytes':filename.stat().st_size,'sha256':checksum.hexdigest()}
            original = canonical.get((record['bytes'],record['sha256']))
            if record['bytes'] > 2*1024*1024:
                if original is None:
                    raise ValueError('Large QA input has no exact committed original reference: '+record['path'])
                record['storage'] = 'exact-original-already-committed'
                record['canonical'] = {'sourceCommit':intent['sourceCommit'],'path':original['path'],
                    'gitBlob':original['gitBlob'],'bytes':original['bytes'],'sha256':original['sha256']}
            else:
                stored = record['path'].replace('/__pycache__/','/bytecode-cache/')
                if stored.endswith('.pyc'):
                    stored += '.bin'
                record['storage'] = 'included-byte-for-byte'
                record['storedAs'] = stored
                archive.add(filename,arcname=stored,recursive=False)
            inventory.append(record)
    content = json.dumps({'files':inventory,'originalSourceCommit':intent['sourceCommit'],
        'newDOMExecuted':False,'scope':'Transport QA only; large duplicates reference exact committed originals. Cached fixture bytes are data-only .bin files.'},indent=2).encode()+b'\n'
    item = tarfile.TarInfo('export-inventory.json')
    item.size = len(content)
    item.mode = 0o600
    archive.addfile(item,io.BytesIO(content))
    proof = json.dumps({'sourceCommit':'4196c496187c88c92304516287a7e644659a8536',
        'cleanRealLinuxGitCheckout':True,'publicationSha256':hashlib.sha256(publication_raw).hexdigest(),
        'currentSourceFilesFromCatalog':902,'currentPublicationFileBindings':903,
        'publicationReceiptAuthenticatedSeparately':True,'historicalPinsPreserved':850,
        'newDOMExecuted':False,'sealedCandidateRebuilt':False,'performanceAccepted':None,'gateReevaluated':False},indent=2).encode()+b'\n'
    item = tarfile.TarInfo('source-invariants.json')
    item.size = len(proof)
    item.mode = 0o600
    archive.addfile(item,io.BytesIO(proof))
sys.stdout.buffer.write(buffer.getvalue())
