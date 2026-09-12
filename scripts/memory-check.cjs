/** @file Runs independent memory stress processes and persists observations and limitations. */
'use strict';
const { spawnSync } = require('node:child_process');
const { mkdirSync, writeFileSync, readFileSync } = require('node:fs');
const { createHash } = require('node:crypto');
const os = require('node:os');
/** Optional targets rerun the affected ownership boundary with the same stress and budgets. */
const supportedModes = ['jsdom', 'rustdom', 'native', 'vitest', 'vitest-vm'];
const modes = process.argv.length > 2 ? process.argv.slice(2) : supportedModes;
for (const mode of modes) {
  if (!supportedModes.includes(mode)) throw new Error(`Unknown memory target: ${mode}`);
}

/** Capture actual retained growth for the reference, native boundary, DOM runtime, and teardown. */
const report = { capturedAt: new Date().toISOString(), node: process.version,
  targets: modes,
  nativeBinarySha256: createHash('sha256').update(readFileSync('dist/rustdom.node')).digest('hex'),
  environmentSourceSha256: createHash('sha256').update(readFileSync('src/environments/vitest.mjs')).digest('hex'),
  workerSourceSha256: createHash('sha256').update(readFileSync('scripts/memory-worker.cjs')).digest('hex'),
  machine: { platform: os.platform(), arch: os.arch(), release: os.release(), cpu: os.cpus()[0].model },
  methodology: 'Fresh process per target; warmup; repeated construction/parsing/teardown; explicit asynchronous major GC and event-loop drainage; terminal memory and WeakRef checks observe the same quiescent endpoint. All per-batch samples are retained.',
  limitations: 'Finite stress tests cannot prove zero leaks. RSS includes allocator retention. This is not a peak-memory benchmark, ASan/LSan run, or exhaustive native dependency audit.',
  results: [] };

for (const mode of modes) {
  process.stderr.write(`Memoria: ${mode}\n`);
  const child = spawnSync(process.execPath, ['--expose-gc', 'scripts/memory-worker.cjs', mode], {
    encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, timeout: 300_000,
  });
  if (child.error) throw child.error;
  if (!child.stdout) throw new Error(`memory check ${mode}: ${child.stderr || child.status}`);
  report.results.push({ ...JSON.parse(child.stdout), exitCode: child.status });
}
report.pass = report.results.every((result) => result.pass && result.exitCode === 0);
mkdirSync('reports/memory', { recursive: true });
const path = `reports/memory/${new Date().toISOString().replaceAll(':', '-')}-${os.platform()}-${os.arch()}.json`;
writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`);
for (const result of report.results) {
  process.stdout.write(`${result.mode}: ${result.pass ? 'PASS' : 'FAIL'}, documentos ${result.survivingDocuments}/${result.observedDocuments}, ventanas ${result.survivingWindows}/${result.observedWindows}, heap delta ${(result.growth.heapUsed / 1024 / 1024).toFixed(2)} MiB, RSS delta ${(result.growth.rss / 1024 / 1024).toFixed(2)} MiB\n`);
}
process.stdout.write(`Guardado: ${path}\n`);
if (!report.pass) process.exitCode = 1;
