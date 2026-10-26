"""Layer only new package identity and control wrappers over the complete immutable qualified derivation."""
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys
import types

if sys.flags.optimize:
    raise RuntimeError('Range study derivation requires assertions enabled')

method = Path(__file__).resolve().parent
repository = method.parents[3]
policy = json.loads((method / 'constants/protocol.json').read_text(encoding='utf-8'))


def digest(filename):
    """Hash a current file without importing it or changing its contents."""
    return hashlib.sha256(filename.read_bytes()).hexdigest()


def prepare(source, manifest_path, output):
    """Retain the complete frozen base; do not change its sampler, timing or experimental factors."""
    source = source.resolve(strict=True)
    output = output.parent.resolve(strict=True) / output.name
    assert source == repository, 'Range study derivation: use current reviewed code'
    assert not output.exists() and not output.is_symlink(), 'Range study derivation: preserve existing output'
    assert source != output and source not in output.parents and output not in source.parents
    producer_path = source / policy['derivation']['source']
    producer_bytes = producer_path.read_bytes()
    assert hashlib.sha256(producer_bytes).hexdigest() == policy['derivation']['sourceSha256']
    # Disable bytecode substitution before even loading the current source producer.
    sys.dont_write_bytecode = True
    sys.pycache_prefix = str(output / policy['derivation']['cacheDirectory'])
    producer = types.ModuleType('current_range_study_frozen_base_producer')
    producer.__file__ = str(producer_path)
    exec(compile(producer_bytes, str(producer_path), 'exec'), producer.__dict__)
    manifest = json.loads(manifest_path.read_bytes())
    canonical_bytes = (source / policy['derivation']['canonicalManifest']).read_bytes()
    assert hashlib.sha256(canonical_bytes).hexdigest() == policy['derivation']['canonicalManifestSha256']
    producer.authenticate_manifest(manifest, canonical_bytes)
    head = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=source, text=True).strip()
    assert manifest['commit'] == head, 'Range study derivation: preserve actual current Git commit'
    output.mkdir()
    base = output / policy['derivation']['baseDirectory']
    producer.prepare(source, manifest_path, base)
    shutil.copyfile(manifest_path, output / 'source-manifest.json')
    controls = policy['derivation']['controlFiles']
    for name in controls:
        target = output / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(method / name, target)
    receipt = {'revision': policy['revision'], 'purpose': policy['purpose'], 'sourceCommit': head,
        'samplerSettingsRevision': policy['samplerRevision'],
        'sourceManifestSha256': digest(manifest_path), 'basePreparationSha256': digest(base / 'preparation.json'),
        'samplerSha256': policy['derivation']['samplerSha256'], 'measurementExecuted': False,
        'performanceAccepted': None, 'gateReevaluated': False,
        'controlFiles': {name: digest(output / name) for name in controls}}
    (output / 'preparation.json').write_text(json.dumps(receipt, indent=2) + '\n', encoding='utf-8')
    assert not (output / policy['derivation']['cacheDirectory']).exists()
    return receipt


if __name__ == '__main__':
    assert len(sys.argv) == 4, 'Provide current repository, actual source manifest and fresh derivation destination'
    print(json.dumps(prepare(*map(Path, sys.argv[1:4]))))
