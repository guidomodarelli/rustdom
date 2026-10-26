"""Export finite receiver QA evidence; reference already published large byte-identical ZIPs."""
import hashlib
import io
import json
import os
from pathlib import Path
import sys
import tarfile

if sys.flags.optimize or sys.platform != 'linux':
    raise RuntimeError('Stream QA export requires non-optimized Linux Python')
roots = {
    'initial-failure':'/run/rustdom-stream-qualification-20261026',
    'v2':'/run/rustdom-stream-qualification-v2-20261026',
    'v3-cancelled':'/run/rustdom-stream-qualification-v3-20261026',
    'v4':'/run/rustdom-stream-qualification-v4-20261026',
    'v5':'/run/rustdom-stream-qualification-v5-20261026',
    'authenticated-initial':'/run/rustdom-stream-authenticated-20261026',
    'authenticated-current':'/run/rustdom-stream-authenticated-v2-20261026',
    'entry-guards':'/run/rustdom-stream-entry-guards-20261026',
}
canonical_large = {
    'sha256':'914dccda28284f206e1e077f9805e652f66209694ef7c7bbe405c520ed2ecff7',
    'bytes':111209731,'artifactId':12688150146,'runId':40395416750,'attempt':1,
    'evidenceCommit':'c2255acaf9bb3b759abd6fca5ecb492aa59afade',
    'partsDirectory':'reports/validation/jsdom-block-pilot-v2/ci-4196c496/artifacts/general/12688150146/zip.parts',
    'transportSummary':'reports/validation/jsdom-block-pilot-v2/ci-4196c496/transport/summary.json',
}
inventory = []
buffer = io.BytesIO()
with tarfile.open(fileobj=buffer,mode='w:gz') as archive:
    for role,root_name in roots.items():
        root = Path(root_name)
        if root.is_symlink() or not root.is_dir():
            raise ValueError('Expected finite QA root is missing: '+role)
        for filename in sorted(root.rglob('*')):
            if filename.is_symlink():
                raise ValueError('QA export refuses symlinks: '+str(filename))
            if not filename.is_file():
                continue
            relative = filename.relative_to(root)
            checksum = hashlib.sha256()
            with filename.open('rb') as reader:
                for chunk in iter(lambda:reader.read(1048576),b''):
                    checksum.update(chunk)
            record = {'path':role+'/'+relative.as_posix(),'bytes':filename.stat().st_size,'sha256':checksum.hexdigest()}
            if 'work' in relative.parts:
                record['storage'] = 'derived-local-Git-fixture-inventory-only'
                record['purpose'] = 'Disposable local Git tree fixture; canonical source and original artifact remain published.'
            elif filename.stat().st_size > 2*1024*1024:
                if record['sha256'] != canonical_large['sha256'] or record['bytes'] != canonical_large['bytes']:
                    raise ValueError('Large QA buffer has no exact previously published original: '+str(filename))
                record['storage'] = 'canonical-already-published-original'
                record['canonical'] = canonical_large
            else:
                record['storage'] = 'included-byte-for-byte'
                archive.add(filename,arcname=record['path'],recursive=False)
            inventory.append(record)
    content = json.dumps({'files':inventory,'captureExecuted':False,
        'scope':'Receiver QA only; large duplicate buffers reference exact canonical originals; local Git fixtures inventoried.'},indent=2).encode()+b'\n'
    item = tarfile.TarInfo('export-inventory.json')
    item.size = len(content)
    item.mode = 0o600
    archive.addfile(item,io.BytesIO(content))
sys.stdout.buffer.write(buffer.getvalue())
