"""Extract the pinned prepared package set through the current reviewed data reader, never archived code."""
import hashlib
import json
from pathlib import Path
import sys
import types

if sys.flags.optimize:
    raise RuntimeError('Range study extraction requires non-optimized Python')

POLICY = json.loads((Path(__file__).parent / 'constants/protocol.json').read_text(encoding='utf-8'))


def extract(repository, output):
    """Keep original input bytes and prior outputs, authenticating the complete archive before extraction."""
    repository = repository.resolve(strict=True)
    output = output.parent.resolve(strict=True) / output.name
    assert not output.exists() and not output.is_symlink(), 'Range study extraction: preserve existing output'
    assert repository != output and repository not in output.parents and output not in repository.parents
    archive = repository / POLICY['archive']['path']
    assert archive.stat().st_size == POLICY['archive']['bytes']
    assert hashlib.sha256(archive.read_bytes()).hexdigest() == POLICY['archive']['sha256']
    source = repository / POLICY['extractor']['path']
    content = source.read_bytes()
    assert hashlib.sha256(content).hexdigest() == POLICY['extractor']['sha256']
    module = types.ModuleType('current_range_study_data_extractor')
    module.__file__ = str(source)
    exec(compile(content, str(source), 'exec'), module.__dict__)
    members = module.extract_archive(archive, output, {POLICY['archive']['root']})
    expected = json.loads((repository / POLICY['packageEvidenceDirectory'] / 'archive-members.json').read_bytes())
    assert {entry['path'] for entry in members} == {entry['path'] for entry in expected['members']}
    indexed = {entry['path']: entry for entry in expected['members']}
    for entry in members:
        original = indexed[entry['path']]
        for key, value in entry.items():
            assert original[key] == value
    return {'root': str(output / POLICY['archive']['root']), 'members': len(members),
        'regularFiles': sum(entry['kind'] == 'file' for entry in members),
        'archiveSha256': POLICY['archive']['sha256'], 'readerExecutedDOM': False, 'performanceAccepted': None}


if __name__ == '__main__':
    assert len(sys.argv) == 3, 'Provide current reviewed repository and fresh disjoint extraction destination'
    print(json.dumps(extract(Path(sys.argv[1]), Path(sys.argv[2]))))
