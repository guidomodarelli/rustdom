"""Derive a diagnostic copy without modifying the frozen measurement harness."""
import difflib
import hashlib
import json
import pathlib
import shutil
import sys


def digest(content):
    return hashlib.sha256(content).hexdigest()


def prepare(source, manifest_path, output):
    source, output = source.resolve(), output.resolve()
    if source == output or source in output.parents or output in source.parents:
        raise ValueError("Sampler diagnostics: source and output must be disjoint")
    if output.exists():
        raise FileExistsError("Sampler diagnostics: output already exists")
    manifest_bytes = manifest_path.read_bytes()
    manifest = json.loads(manifest_bytes)
    contents = {}
    for entry in manifest['files']:
        relative = pathlib.PurePosixPath(entry['path'])
        if relative.is_absolute() or '..' in relative.parts:
            raise ValueError("Sampler diagnostics: unsafe source path")
        content = source.joinpath(*relative.parts).read_bytes()
        if len(content) != entry['bytes'] or digest(content) != entry['sha256']:
            raise ValueError(f"Sampler diagnostics: source identity differs: {relative}")
        contents[str(relative)] = content
    filename = 'benchmarks/worker.cjs'
    original = contents[filename].decode('utf-8')
    replacements = [
        ('  const samplesMs = [];', '  const samplesMs = [];\n  const sampleTimings = [];', 1),
        ('      elapsed = performance.now() - start;',
         '      elapsed = performance.now() - start;\n'
         '      sampleTimings.push({ index: sample, stage: sample < WARMUP_SAMPLES ? "warmup" : "measured",\n'
         '        startMs: start, durationMs: elapsed });', 3),
        ('outputHash, samplesMs, memoryAfterCleanup: memory',
         'outputHash, samplesMs, sampleTimings, memoryAfterCleanup: memory', 1),
    ]
    instrumented = original
    for before, after, count in replacements:
        if instrumented.count(before) != count:
            raise ValueError("Sampler diagnostics: unexpected timer layout")
        instrumented = instrumented.replace(before, after)
    contents[filename] = instrumented.encode('utf-8')
    output.mkdir(parents=True)
    for name, content in contents.items():
        destination = output / 'harness' / name
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(content)
    shutil.copyfile(pathlib.Path(__file__).with_name('worker.cjs'), output / 'worker.cjs')
    (output / 'source-manifest.json').write_bytes(manifest_bytes)
    (output / 'sampler.patch').write_text(''.join(difflib.unified_diff(
        original.splitlines(keepends=True), instrumented.splitlines(keepends=True),
        fromfile='frozen/benchmarks/worker.cjs', tofile='diagnostic/benchmarks/worker.cjs')), encoding='utf-8')
    receipt = {'measurementExecuted': False, 'gateReevaluated': False,
               'sourceCommit': manifest['commit'], 'sourceHarnessSha256': manifest['harnessSha256'],
               'verifiedSourceFiles': len(contents), 'sourceManifestSha256': digest(manifest_bytes),
               'samplerBeforeSha256': digest(original.encode('utf-8')),
               'samplerAfterSha256': digest(contents[filename]),
               'changes': ['Record all 12 timing spans after the original stop clock',
                           'Return scalar spans alongside the unchanged nine measured durations'],
               'derivedFiles': {str(path.relative_to(output)): digest(path.read_bytes())
                                for path in sorted(output.rglob('*')) if path.is_file()}}
    (output / 'preparation.json').write_text(json.dumps(receipt, indent=2) + '\n', encoding='utf-8')
    return receipt


if __name__ == '__main__':
    result = prepare(*map(pathlib.Path, sys.argv[1:4]))
    print(json.dumps(result))
