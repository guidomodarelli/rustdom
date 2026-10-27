"""Authenticate and extract the functional qualification without executing any archived script."""
import hashlib
import importlib.util
import json
from pathlib import Path
import sys
import tarfile

if sys.flags.optimize:
    raise RuntimeError('Shared worker extraction requires non-optimized Python')


def extract(destination):
    location = Path(__file__).resolve().parent
    receipt = json.loads((location / 'receipt.json').read_text())
    source = location / 'qualification.tar.xz'
    if source.stat().st_size != receipt['archiveBytes'] or hashlib.sha256(source.read_bytes()).hexdigest() != receipt['archiveSha256']:
        raise ValueError('Shared worker extraction: archive differs from the canonical publication receipt')
    repository = location.parents[3]
    helper = repository / 'reports/benchmarks/native-class-ownership/jsdom-telemetry-results/39959175058/tools/extract-current-ownership-result.py'
    if not hasattr(tarfile, 'tar_filter'):
        raise RuntimeError('Shared worker extraction requires Python with tarfile.tar_filter; use Python 3.12')
    spec = importlib.util.spec_from_file_location('reviewed_archive_extraction', helper)
    extraction = importlib.util.module_from_spec(spec); spec.loader.exec_module(extraction)
    members = extraction.extract_archive(source, destination, {'shared-worker-qualification'})
    if len(members) != receipt['regularFiles'] or any(member['kind'] != 'file' for member in members):
        raise ValueError('Shared worker extraction: unexpected member count or type')
    if sum(member['bytes'] for member in members) != receipt['rawRegularBytes']:
        raise ValueError('Shared worker extraction: raw bytes differ')
    print(json.dumps({'regularFiles': len(members), 'archiveSha256': receipt['archiveSha256'], 'samplerInvoked': False}))


if __name__ == '__main__':
    if len(sys.argv) != 2:
        raise ValueError('Provide a fresh extraction directory with an existing parent')
    extract(Path(sys.argv[1]))
