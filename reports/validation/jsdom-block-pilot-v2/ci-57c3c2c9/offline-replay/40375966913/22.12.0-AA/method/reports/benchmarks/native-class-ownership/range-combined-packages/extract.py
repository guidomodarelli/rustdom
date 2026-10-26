"""Read the fixed complete package archive with the current reviewed data extractor, never archived code."""
import hashlib
import json
from pathlib import Path
import sys
import types

if sys.flags.optimize:
    raise RuntimeError('Combined package extraction requires non-optimized Python')


def extract(repository, output):
    """Preserve original data and prior output, authenticating the full archive and every extracted member."""
    policy = json.loads((Path(__file__).parent / 'constants/archive.json').read_bytes())
    repository = repository.resolve(strict=True)
    output = output.parent.resolve(strict=True) / output.name
    assert not output.exists() and not output.is_symlink(), 'Combined extraction: preserve existing output'
    assert output != repository and not output.is_relative_to(repository) and not repository.is_relative_to(output), \
        'Combined extraction: output overlaps protected repository'
    source = repository / policy['archive']['path']
    assert source.stat().st_size == policy['archive']['bytes'], 'Combined extraction: changed archive size'
    assert hashlib.sha256(source.read_bytes()).hexdigest() == policy['archive']['sha256'], 'Combined extraction: changed archive digest'
    manifest = repository / policy['members']['path']
    assert hashlib.sha256(manifest.read_bytes()).hexdigest() == policy['members']['sha256']
    helper = repository / policy['extractor']['path']
    code = helper.read_bytes()
    assert hashlib.sha256(code).hexdigest() == policy['extractor']['sha256']
    module = types.ModuleType('current_combined_package_extractor'); module.__file__ = str(helper)
    exec(compile(code, str(helper), 'exec'), module.__dict__)
    members = module.extract_archive(source, output, {policy['archive']['root']})
    assert members == json.loads(manifest.read_bytes())['members'], 'Combined extraction: changed extracted member manifest'
    return {'root': str(output / policy['archive']['root']), 'members': len(members),
            'archiveSha256': policy['archive']['sha256'], 'runtimeExecuted': False,
            'benchmarkExecuted': False, 'performanceAccepted': None, 'gateReevaluated': False}


if __name__ == '__main__':
    assert len(sys.argv) == 3, 'Provide current reviewed repository and fresh disjoint extraction directory'
    print(json.dumps(extract(Path(sys.argv[1]), Path(sys.argv[2]))))
