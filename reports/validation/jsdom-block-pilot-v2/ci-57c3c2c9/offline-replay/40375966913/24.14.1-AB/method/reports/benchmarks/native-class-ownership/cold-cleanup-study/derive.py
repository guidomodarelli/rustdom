"""Reuse the reviewed derivation, avoiding every preexisting Python bytecode cache."""
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys
import types

if sys.flags.optimize:
    raise RuntimeError('Cold study derivation requires assertions enabled')

method = Path(__file__).resolve().parent
repository = method.parents[3]
policy = json.loads((method / 'constants/protocol.json').read_text(encoding='utf-8'))


def digest(content):
    """Return the digest of already-read bytes, without reopening executable code."""
    return hashlib.sha256(content).hexdigest()


def authenticate_manifest(manifest, canonical_bytes):
    """Authenticate both the independent canonical input and the actual entry digest."""
    assert digest(canonical_bytes) == policy['derivation']['canonicalManifestSha256'], 'Cold study derivation: independent canonical manifest differs'
    canonical = json.loads(canonical_bytes)
    assert manifest['files'] == canonical['files'] and len(manifest['files']) == policy['sourceHarnessFiles'], 'Cold study derivation: canonical source manifest differs'
    assert manifest['harnessSha256'] == canonical['harnessSha256'] == policy['sourceHarnessSha256'], 'Cold study derivation: frozen harness digest differs'
    canonical_files = json.dumps(manifest['files'], separators=(',', ':'), ensure_ascii=False).encode('utf-8')
    assert digest(canonical_files) == policy['sourceHarnessSha256'], 'Cold study derivation: actual harness entries differ'


def prepare(source, manifest_path, output):
    """Derive only from this current reviewed checkout; retain partial output on failure."""
    source, output = source.resolve(), output.resolve()
    assert source == repository, 'Cold study derivation: use the current checkout, never archived code'
    assert not output.exists(), 'Cold study derivation: preserve existing output'
    assert source not in output.parents and output not in source.parents, 'Cold study derivation: inputs and output must be disjoint'
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    canonical_bytes = (source / policy['derivation']['canonicalManifest']).read_bytes()
    authenticate_manifest(manifest, canonical_bytes)
    head = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=source, text=True).strip()
    assert manifest['commit'] == head, 'Cold study derivation: manifest must keep the actual current Git commit'
    for filename in policy['historicalReviews']:
        for name, expected in json.loads((source / filename).read_text(encoding='utf-8'))['files'].items():
            assert digest((source / name).read_bytes()) == expected, 'Cold study derivation: historical pin differs: ' + name
    for name, expected in policy['derivation']['transitiveSources'].items():
        assert digest((source / name).read_bytes()) == expected, 'Cold study derivation: transitive producer differs: ' + name
    transport_bytes = (source / policy['transportPolicy']['path']).read_bytes()
    assert digest(transport_bytes) == policy['transportPolicy']['sha256']
    identity = json.loads(transport_bytes)['preparationIdentity']
    producer_path = source / policy['derivation']['source']
    producer_bytes = producer_path.read_bytes()
    assert digest(producer_bytes) == policy['derivation']['sourceSha256']
    # Legacy importlib calls now consult an unused prefix, even if the caller supplied a hostile cache.
    sys.pycache_prefix = str(output / policy['derivation']['cacheDirectory'])
    sys.dont_write_bytecode = True
    producer = types.ModuleType('reviewed_cold_study_derivation')
    producer.__file__ = str(producer_path)
    exec(compile(producer_bytes, str(producer_path), 'exec'), producer.__dict__)
    receipt = producer.prepare(source, manifest_path, output)
    assert receipt['samplerAfterSha256'] == policy['derivation']['samplerSha256']
    assert not (output / policy['derivation']['cacheDirectory']).exists()
    shutil.copyfile(output / 'preparation.json', output / 'legacy-study-preparation.json')
    shutil.copyfile(output / 'worker.cjs', output / 'legacy-worker.cjs')
    for name in ['worker.cjs', 'settings.cjs', 'constants/protocol.json']:
        destination = output / name
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(method / name, destination)
    (output / 'identity.json').write_text(json.dumps(identity, indent=2) + '\n', encoding='utf-8')
    receipt.update(revision=policy['revision'], purpose=policy['purpose'], functionalOnly=False,
        performanceAccepted=None, gateReevaluated=False, samplerSettingsRevision=policy['samplerRevision'], preparationIdentity=identity)
    receipt['changes'].append(policy['derivation']['changeDescription'])
    receipt['derivedFiles'] = {filename.relative_to(output).as_posix(): digest(filename.read_bytes())
        for filename in sorted(output.rglob('*')) if filename.is_file() and filename != output / 'preparation.json'}
    (output / 'preparation.json').write_text(json.dumps(receipt, indent=2) + '\n', encoding='utf-8')
    return receipt


if __name__ == '__main__':
    print(json.dumps(prepare(*map(Path, sys.argv[1:4]))))
