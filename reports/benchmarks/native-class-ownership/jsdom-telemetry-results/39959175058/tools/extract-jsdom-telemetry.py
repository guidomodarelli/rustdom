import gzip
import importlib.util
import json
from pathlib import Path
import tempfile
import sys

if sys.flags.optimize:
    raise RuntimeError('JSDOM telemetry extraction requires non-optimized Python')

repository = Path('/mnt/c/Users/guido/.codex/worktrees/native-class-ownership/rustdom')
spec = importlib.util.spec_from_file_location('reviewed_extractor', repository / '.cache/extract-current-ownership-result.py')
extractor = importlib.util.module_from_spec(spec); spec.loader.exec_module(extractor)
cache = repository / '.cache/jsdom-telemetry-original-39959175058'
receipt = json.loads((cache / 'collection.json').read_text())
assert receipt['transportAuthenticated'] and receipt['status'] == 'completed'
assert extractor.digest(cache / 'artifact.zip') == receipt['zipSha256']
source = cache / 'jsdom-telemetry-results.tar.xz'
assert extractor.digest(source) == receipt['tarSha256']
outer = Path(tempfile.mkdtemp(prefix='jsdom-telemetry-result-39959175058-', dir='/home/guido/rustdom-validation'))
members = extractor.extract_archive(source, outer / 'archive', {'jsdom-telemetry'})
manifest = outer / 'raw-members.json.gz'
manifest.write_bytes(gzip.compress(json.dumps(members, indent=2).encode(), mtime=0))
state = {'root': str(outer / 'archive/jsdom-telemetry'), 'members': len(members),
    'regularFiles': sum(member['kind'] == 'file' for member in members),
    'rawRegularBytes': sum(member.get('bytes', 0) for member in members),
    'manifest': str(manifest), 'transportAuthenticated': True, 'samplerExecuted': False}
(repository / '.cache/jsdom-telemetry-result-extraction.json').write_text(json.dumps(state, indent=2) + '\n')
print(json.dumps(state))
