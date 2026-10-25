"""Derive only current reviewed sources; this preparation cannot profile or load DOM."""
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys
import types


def digest(filename):
    """Hash source or data bytes without importing or executing the target."""
    return hashlib.sha256(filename.read_bytes()).hexdigest()


def authenticate(repository, policy):
    """Check the independent historical receipt and every pin before loading its producer."""
    receipt = repository / policy['historicalReceipt']['path']
    if digest(receipt) != policy['historicalReceipt']['sha256']:
        raise ValueError('Range telemetry preparation: historical receipt differs')
    pins = json.loads(receipt.read_bytes())['files']
    if len(pins) != policy['historicalPins']:
        raise ValueError('Range telemetry preparation: historical pin coverage differs')
    for name, expected in pins.items():
        if digest(repository / name) != expected:
            raise ValueError(f'Range telemetry preparation: historical pin differs: {name}')
    return pins


def prepare(repository, manifest, output, mode):
    """Preserve the qualified derivation, adapting only explicit package/revision binding."""
    if sys.flags.optimize:
        raise RuntimeError('Range telemetry preparation requires non-optimized Python')
    repository = Path(repository).resolve(strict=True)
    manifest = Path(manifest).resolve(strict=True)
    output = Path(output)
    output = output.parent.resolve(strict=True) / output.name
    method = Path(__file__).resolve().parent
    policy = json.loads((method / 'constants/protocol.json').read_bytes())
    if method != repository / policy['methodDirectory']:
        raise ValueError('Range telemetry preparation: execute current code from the actual source checkout')
    if mode not in policy['modes']:
        raise ValueError('Range telemetry preparation: undeclared observation mode')
    if output.exists() or output.is_symlink():
        raise FileExistsError(f'Range telemetry preparation: preserve existing output {output}')
    if repository == output or repository in output.parents or output in repository.parents or output in manifest.parents:
        raise ValueError('Range telemetry preparation: output must be disjoint from source and manifest')
    pins = authenticate(repository, policy)
    provenance = json.loads((method / 'constants/provenance.json').read_bytes())
    for name, expected in provenance['references'].items():
        if digest(repository / name) != expected:
            raise ValueError(f'Range telemetry preparation: diagnostic reference differs: {name}')
    producer = repository / policy['producer']
    if digest(producer) != pins[policy['producer']]:
        raise ValueError('Range telemetry preparation: producer differs from historical publication')
    original_manifest = json.loads(manifest.read_bytes())
    if original_manifest['harnessSha256'] != policy['sourceHarnessSha256']:
        raise ValueError('Range telemetry preparation: frozen manifest differs')
    head = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=repository, text=True).strip()
    changes = subprocess.check_output(['git', 'status', '--porcelain', '--untracked-files=all'], cwd=repository, text=True).splitlines()
    if original_manifest['commit'] != head:
        raise ValueError('Range telemetry preparation: manifest commit differs from the actual checkout')
    previous_bytecode = sys.dont_write_bytecode
    sys.dont_write_bytecode = True
    previous_prefix = sys.pycache_prefix
    sys.pycache_prefix = str(output / policy['cacheDirectory'])
    try:
        module = types.ModuleType('current_reviewed_native_telemetry_producer')
        module.__file__ = str(producer)
        exec(compile(producer.read_bytes(), str(producer), 'exec'), module.__dict__)
        previous = module.prepare(repository, manifest, output, mode)
        registered = json.loads((repository / policy['nativeCodeMaps'][mode]).read_bytes())
        if sorted(previous['derivedFiles']) != registered['fileNames']:
            raise ValueError('Range telemetry preparation: native derivation file coverage differs')
        for name, expected in registered['codeFiles'].items():
            if digest(output / name) != expected:
                raise ValueError(f'Range telemetry preparation: registered native code differs: {name}')
    finally:
        sys.dont_write_bytecode = previous_bytecode
        sys.pycache_prefix = previous_prefix
    for name in policy['preservedReferences']:
        shutil.copyfile(output / name, output / policy['preservedReferences'][name])
    entry = output / policy['samplerEntry']
    shutil.copyfile(entry, output / policy['originalSamplerEntry'])
    shutil.copyfile(method / 'sampler-entry.cjs', entry)
    identity = json.loads((repository / policy['packageIdentity']).read_bytes())
    binding = {'samplerRevision': policy['samplerRevision'], 'distributionHashes': identity['distributions'],
               'inspectOperation': policy['inspectOperation']}
    (output / policy['samplerBinding']).write_bytes((json.dumps(binding, indent=2) + '\n').encode())
    (output / 'protocol.json').write_bytes((json.dumps({**policy, 'mode': mode}, indent=2) + '\n').encode())
    receipt = {'revision': policy['revision'], 'mode': mode, 'captureImplemented': policy['captureImplemented'],
               'sourceCommit': head, 'sourceChanges': changes, 'sourceGitErrors': [], 'sourceManifestSha256': digest(manifest),
               'measurementExecuted': False, 'performanceAccepted': None, 'gateReevaluated': False,
               'historicalPinsVerified': len(pins),
               'derivedFiles': {filename.relative_to(output).as_posix(): digest(filename)
                    for filename in sorted(output.rglob('*')) if filename.is_file() and filename != output / 'preparation.json'}}
    (output / 'preparation.json').write_bytes((json.dumps(receipt, indent=2) + '\n').encode())
    if (output / policy['cacheDirectory']).exists():
        raise RuntimeError('Range telemetry preparation: unexpected bytecode cache')
    return receipt


if __name__ == '__main__':
    result = prepare(*sys.argv[1:])
    print(json.dumps({name: value for name, value in result.items() if name != 'derivedFiles'}))
