"""Verify the preserved v1 failure bytes without executing archive members or DOM."""
from pathlib import Path, PurePosixPath
import hashlib
import json
import sys


def verify_file(repository, entry):
    """Require a bounded repository-relative physical file and its complete original bytes."""
    relative = entry['path']
    path = PurePosixPath(relative)
    if not relative or path.is_absolute() or any(part in ['', '.', '..'] for part in relative.split('/')) or '\\' in relative or ':' in relative:
        raise ValueError('Preserved evidence path is not canonical: ' + repr(relative))
    file = repository
    for part in path.parts:
        file = file / part
        if file.is_symlink():
            raise ValueError('Preserved evidence contains a linked path: ' + relative)
    if not file.is_file() or file.stat().st_size != entry['bytes']:
        raise ValueError('Preserved evidence size differs: ' + relative)
    checksum = hashlib.sha256()
    with file.open('rb') as reader:
        for chunk in iter(lambda: reader.read(1024 * 1024), b''):
            checksum.update(chunk)
    if checksum.hexdigest() != entry['sha256']:
        raise ValueError('Preserved evidence digest differs: ' + relative)


def verify(repository):
    manifest = json.loads((repository / 'reports/benchmarks/native-class-ownership/jsdom-block-pilot-results/40366685759/preservation.json').read_bytes())
    if manifest['runId'] != 40366685759 or manifest['attempt'] != 1 or manifest['criteriaAudited'] != 32 or manifest['partialReplays'] != 64:
        raise ValueError('Preserved evidence has another run or incomplete audit')
    paths = set()
    for entry in manifest['preservedFiles']:
        if entry['path'] in paths:
            raise ValueError('Preserved evidence repeats a path: ' + entry['path'])
        paths.add(entry['path'])
        verify_file(repository, entry)
    return {'verifiedFiles': len(paths), 'runId': manifest['runId'], 'attempt': 1,
            'benchmarkWorkersLaunched': 0, 'archivedCodeExecuted': False, 'DOMExecuted': False,
            'performanceAccepted': None, 'gateReevaluated': False}


if __name__ == '__main__':
    if sys.flags.optimize:
        raise RuntimeError('Preservation verification requires non-optimized Python')
    print(json.dumps(verify(Path(sys.argv[1]).resolve(strict=True))))
