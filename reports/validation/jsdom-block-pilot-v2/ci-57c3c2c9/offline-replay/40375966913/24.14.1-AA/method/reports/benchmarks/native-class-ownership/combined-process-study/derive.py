"""Derive the unchanged qualified sampler from current authenticated sources, adding only the new control namespace."""
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys
import types

if sys.flags.optimize:
    raise RuntimeError('Combined derivation requires non-optimized Python')

METHOD = Path(__file__).resolve().parent
REPOSITORY = METHOD.parents[3]
POLICY = json.loads((METHOD / 'constants/protocol.json').read_bytes())


def digest(filename):
    """Read current bytes, bypassing bytecode and archived implementations."""
    return hashlib.sha256(filename.read_bytes()).hexdigest()


def prepare(source, manifest_path, output):
    """Authenticate first; preserve partial derivation and actual Git identity without starting a sampler."""
    source = source.resolve(strict=True)
    output = output.parent.resolve(strict=True) / output.name
    assert source == REPOSITORY and (source / '.git').is_dir() and not (source / '.git').is_symlink(), 'Combined derivation: use its current native Git checkout'
    assert not output.exists() and not output.is_symlink(), 'Combined derivation: preserve existing output'
    assert source != output and not output.is_relative_to(source) and not source.is_relative_to(output)
    canonical_bytes = (source / POLICY['derivation']['canonicalManifest']).read_bytes()
    assert hashlib.sha256(canonical_bytes).hexdigest() == POLICY['derivation']['canonicalManifestSha256']
    canonical = json.loads(canonical_bytes); manifest = json.loads(manifest_path.read_bytes())
    assert manifest['files'] == canonical['files'] and len(manifest['files']) == POLICY['sourceHarnessFiles']
    assert manifest['harnessSha256'] == canonical['harnessSha256'] == POLICY['sourceHarnessSha256']
    head = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=source, text=True).strip()
    assert manifest['commit'] == head, 'Combined derivation: preserve actual method Git commit'
    producer_path = source / POLICY['derivation']['source']; code = producer_path.read_bytes()
    assert hashlib.sha256(code).hexdigest() == POLICY['derivation']['sourceSha256']
    sys.dont_write_bytecode = True
    module = types.ModuleType('current_combined_frozen_sampler_producer'); module.__file__ = str(producer_path)
    exec(compile(code, str(producer_path), 'exec'), module.__dict__)
    output.mkdir()
    base = output / POLICY['derivation']['baseDirectory']
    receipt = {'revision': POLICY['revision'], 'purpose': 'derivation-only', 'sourceCommit': head,
               'sourceChangesRaw': subprocess.check_output(['git', 'status', '--porcelain', '--untracked-files=all'], cwd=source).decode('utf-8'),
               'sourceGitErrors': [], 'samplerSettingsRevision': POLICY['samplerRevision'], 'complete': False,
               'measurementExecuted': False, 'performanceAccepted': None, 'gateReevaluated': False}
    try:
        original = module.prepare(source, manifest_path, base)
        assert original['samplerAfterSha256'] == POLICY['derivation']['samplerSha256']
        shutil.copyfile(manifest_path, output / 'source-manifest.json')
        for name in POLICY['derivation']['controlFiles']:
            target = output / name; target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(METHOD / name, target)
        receipt.update({'complete': True, 'basePreparationSha256': digest(base / 'preparation.json'),
                        'sourceManifestSha256': digest(output / 'source-manifest.json'),
                        'samplerSha256': original['samplerAfterSha256'],
                        'controlFiles': {name: digest(output / name) for name in POLICY['derivation']['controlFiles']}})
    except Exception as error:
        receipt['failure'] = {'type': type(error).__name__, 'message': str(error)}
        raise
    finally:
        (output / 'preparation.json').write_text(json.dumps(receipt, indent=2) + '\n', encoding='utf-8', newline='\n')
    return receipt


if __name__ == '__main__':
    assert len(sys.argv) == 4, 'Provide current native Git repository, actual harness manifest and fresh disjoint output'
    print(json.dumps(prepare(*map(Path, sys.argv[1:]))))
