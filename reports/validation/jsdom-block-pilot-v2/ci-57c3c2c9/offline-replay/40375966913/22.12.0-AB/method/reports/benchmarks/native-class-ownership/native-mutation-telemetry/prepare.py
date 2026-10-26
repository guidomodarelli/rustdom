"""Prepare instrumented source copies only; never execute a DOM, profiler or sampler."""
import difflib
import hashlib
import importlib.util
import json
from pathlib import Path
import shutil
import subprocess
import sys

if sys.flags.optimize:
    raise RuntimeError('Native telemetry preparation requires non-optimized Python')


def load(filename, name):
    """Load current repository derivation code, never a script from archived evidence."""
    spec = importlib.util.spec_from_file_location(name, filename)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def prepare(repository, manifest, output, mode):
    """Combine reviewed source derivations with the guarded wrapper; never execute generated code."""
    repository = repository.resolve(strict=True)
    method = Path(__file__).resolve().parent
    policy = json.loads((method / 'constants/protocol.json').read_text(encoding='utf-8'))
    if mode not in policy['modes']:
        raise ValueError('Native telemetry preparation: undeclared observation mode')
    source_manifest = json.loads(manifest.read_text(encoding='utf-8'))
    if source_manifest['harnessSha256'] != policy['sourceHarnessSha256'] or len(source_manifest['files']) != 434:
        raise ValueError('Native telemetry preparation: frozen source manifest differs')
    canonical = repository / policy['sharedQualificationReceipt']
    if hashlib.sha256(canonical.read_bytes()).hexdigest() != policy['sharedQualificationReceiptSha256']:
        raise ValueError('Native telemetry preparation: published qualification receipt differs')
    declared = json.loads(canonical.read_text(encoding='utf-8'))
    base_path = canonical.with_name('base-preparation.json')
    if hashlib.sha256(base_path.read_bytes()).hexdigest() != declared['derivedFiles']['base-preparation.json']:
        raise ValueError('Native telemetry preparation: canonical base receipt differs')
    base = json.loads(base_path.read_text(encoding='utf-8'))
    expected = {name.removeprefix('harness/'): digest for name, digest in base['derivedFiles'].items() if name.startswith('harness/')}
    expected['benchmarks/worker.cjs'] = base['samplerBeforeSha256']
    actual = {entry['path']: entry['sha256'] for entry in source_manifest['files']}
    if len(expected) != 434 or actual != expected:
        raise ValueError('Native telemetry preparation: input graph differs from published frozen sources')
    shared = repository / 'reports/benchmarks/native-class-ownership'
    telemetry = load(shared / 'jsdom-telemetry/prepare.py', 'reviewed_jsdom_telemetry_derivation')
    telemetry_receipt = telemetry.prepare(repository, manifest, output, mode)
    shutil.copyfile(output / 'preparation.json', output / 'original-telemetry-preparation.json')
    qualification = load(shared / 'shared-fixture-worker/prepare.py', 'reviewed_shared_fixture_derivation')
    qualified = output / 'qualified-source'
    qualified_receipt = qualification.prepare(repository, manifest, qualified)
    if qualified_receipt['samplerAfterSha256'] != policy['qualifiedSamplerSha256']:
        raise ValueError('Native telemetry preparation: shared fixture sampler differs from qualification')
    patch = qualified / 'shared-fixtures.patch'
    if hashlib.sha256(patch.read_bytes()).hexdigest() != declared['derivedFiles']['shared-fixtures.patch']:
        raise ValueError('Native telemetry preparation: shared fixture changes differ from publication')
    for check in [True, False]:
        command = ['git', 'apply', '-p1', '--directory=harness']
        if check:
            command.append('--check')
        subprocess.run(command + [str(patch.resolve())], cwd=output, check=True, capture_output=True)
    shutil.copytree(qualified / 'harness/benchmarks/shared-ownership-fixtures', output / 'harness/benchmarks/shared-ownership-fixtures')
    # The old jsdom-only wrapper is reference material; it must not become a native producer.
    (output / 'worker.cjs').rename(output / 'unexecuted-jsdom-wrapper-reference.cjs')
    shutil.copyfile(method / 'worker.cjs', output / 'worker.cjs')
    sampler = output / 'harness/benchmarks/worker.cjs'
    original = (repository / 'benchmarks/worker.cjs').read_text(encoding='utf-8')
    (output / 'combined-sampler.patch').write_text(''.join(difflib.unified_diff(original.splitlines(keepends=True),
        sampler.read_text(encoding='utf-8').splitlines(keepends=True), fromfile='frozen/benchmarks/worker.cjs',
        tofile='native-telemetry/benchmarks/worker.cjs')), encoding='utf-8')
    (output / 'protocol.json').write_text(json.dumps({**policy, 'mode': mode}, indent=2) + '\n', encoding='utf-8')
    receipt = {'revision': policy['revision'], 'mode': mode, 'captureImplemented': policy['captureImplemented'],
        'workerImplemented': True, 'measurementExecuted': False,
        'gateReevaluated': False, 'performanceAccepted': None, 'sourceHarnessSha256': policy['sourceHarnessSha256'],
        'verifiedSourceFiles': len(source_manifest['files']), 'sourceManifestSha256': hashlib.sha256(manifest.read_bytes()).hexdigest(),
        'qualifiedSamplerSha256': qualified_receipt['samplerAfterSha256'],
        'telemetrySamplerBeforeSharedFixturesSha256': telemetry_receipt['samplerAfterSha256'],
        'samplerAfterSha256': hashlib.sha256(sampler.read_bytes()).hexdigest(),
        'derivedFiles': {filename.relative_to(output).as_posix(): hashlib.sha256(filename.read_bytes()).hexdigest()
            for filename in sorted(output.rglob('*')) if filename.is_file() and filename != output / 'preparation.json'}}
    (output / 'preparation.json').write_text(json.dumps(receipt, indent=2) + '\n', encoding='utf-8')
    return receipt


if __name__ == '__main__':
    assert len(sys.argv) == 5, 'Provide repository, frozen manifest, fresh output directory and cpu/jit mode'
    result = prepare(*map(Path, sys.argv[1:4]), sys.argv[4])
    print(json.dumps({name: result[name] for name in ['revision', 'mode', 'captureImplemented', 'measurementExecuted',
        'verifiedSourceFiles', 'qualifiedSamplerSha256', 'samplerAfterSha256']}))
