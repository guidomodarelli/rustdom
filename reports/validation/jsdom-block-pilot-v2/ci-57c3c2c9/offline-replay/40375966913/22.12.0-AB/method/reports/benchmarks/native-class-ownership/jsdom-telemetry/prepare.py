"""Derive telemetry from the verified current sampler without editing any measured source."""
import difflib
import hashlib
import importlib.util
import json
from pathlib import Path
import shutil
import sys

if sys.flags.optimize:
    raise RuntimeError('JSDOM telemetry derivation requires non-optimized Python')


def prepare(source, manifest, output, mode):
    method = Path(__file__).resolve().parent
    shared = method.parent / 'sampler-diagnostics/prepare.py'
    spec = importlib.util.spec_from_file_location('shared_sampler_derivation', shared)
    derivation = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(derivation)
    receipt = derivation.prepare(source, manifest, output)
    shutil.copyfile(output / 'preparation.json', output / 'base-preparation.json')
    sampler = output / 'harness/benchmarks/worker.cjs'
    original = (source / 'benchmarks/worker.cjs').read_text()
    instrumented = sampler.read_text()
    changes = [
        ('    let dom;', '    const diagnosticSampleStartMs = performance.now();\n'
         '    let diagnosticWarmupStartMs = null; let diagnosticWarmupEndMs = null;\n    let dom;', 1),
        ('      if (warmOwnershipRealm) {',
         '      if (warmOwnershipRealm) {\n        diagnosticWarmupStartMs = performance.now();', 1),
        ('          captureRecords: captureMutationRecords });',
         '          captureRecords: captureMutationRecords });\n        diagnosticWarmupEndMs = performance.now();', 1),
        ('      const start = performance.now();',
         '      const diagnosticCpuBefore = process.cpuUsage();\n      const start = performance.now();', 3),
        ('      elapsed = performance.now() - start;',
         '      elapsed = performance.now() - start;\n      const diagnosticCpu = process.cpuUsage(diagnosticCpuBefore);', 3),
        ('startMs: start, durationMs: elapsed });',
         'startMs: start, durationMs: elapsed, cpuUserUs: diagnosticCpu.user, cpuSystemUs: diagnosticCpu.system });', 3),
        ('    result = null;\n    insertionDocument = null;',
         '    const diagnosticCleanupStartMs = performance.now();\n    result = null;\n    insertionDocument = null;', 1),
        ('      memory.push(process.memoryUsage());\n    }\n  }',
         '      memory.push(process.memoryUsage());\n    }\n'
         '    Object.assign(sampleTimings.at(-1), { sampleStartMs: diagnosticSampleStartMs,\n'
         '      realmWarmupStartMs: diagnosticWarmupStartMs, realmWarmupEndMs: diagnosticWarmupEndMs,\n'
         '      cleanupStartMs: diagnosticCleanupStartMs, sampleEndMs: performance.now() });\n  }', 1),
    ]
    for before, after, count in changes:
        if instrumented.count(before) != count:
            raise ValueError('JSDOM telemetry: unexpected current timer layout')
        instrumented = instrumented.replace(before, after)
    sampler.write_bytes(instrumented.encode())
    worker = output / 'harness/reports/benchmarks/native-class-ownership/single-package-worker.cjs'
    content = worker.read_text()
    before = 'assert.deepEqual(process.execArgv, workerArguments(position),'
    if content.count(before) != 1:
        raise ValueError('JSDOM telemetry: unexpected flag-validation boundary')
    worker.write_bytes(content.replace(before,
        "assert.deepEqual(process.execArgv, [...workerArguments(position), ...require('./telemetry-flags.json')],").encode())
    policy = json.loads((method / 'constants/protocol.json').read_text())
    if mode not in policy['nodeFlagsByMode']:
        raise ValueError('JSDOM telemetry: undeclared mode')
    worker.with_name('telemetry-flags.json').write_bytes((json.dumps(policy['nodeFlagsByMode'][mode]) + '\n').encode())
    shutil.copyfile(method / 'worker.cjs', output / 'worker.cjs')
    (output / 'protocol.json').write_bytes((json.dumps({**policy, 'mode': mode}, indent=2) + '\n').encode())
    (output / 'sampler.patch').write_bytes(''.join(difflib.unified_diff(original.splitlines(keepends=True),
        instrumented.splitlines(keepends=True), fromfile='frozen/benchmarks/worker.cjs',
        tofile='diagnostic/benchmarks/worker.cjs')).encode())
    receipt.update(revision=policy['revision'], mode=mode, diagnosticOnly=True, accepted=None,
        samplerAfterSha256=hashlib.sha256(sampler.read_bytes()).hexdigest(),
        changes=receipt['changes'] + ['Record process CPU outside original operation timer',
            'Explicitly permit the declared V8 logger flags in the derived worker only'])
    receipt['derivedFiles'] = {path.relative_to(output).as_posix(): hashlib.sha256(path.read_bytes()).hexdigest()
        for path in sorted(output.rglob('*')) if path.is_file() and path != output / 'preparation.json'}
    (output / 'preparation.json').write_bytes((json.dumps(receipt, indent=2) + '\n').encode())
    return receipt


if __name__ == '__main__':
    print(json.dumps(prepare(*map(Path, sys.argv[1:4]), sys.argv[4])))
