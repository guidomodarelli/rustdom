/** @file Measures actual native class-return allocation and verifies every copy and release outside timing. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { performance } = require('node:perf_hooks');
const { setImmediate: yieldTurn } = require('node:timers/promises');
const COPY_COUNT = 10_000;
const WARMUP_SAMPLES = 3;
const MEASURED_SAMPLES = 9;
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const median = (values) => {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};
/** Check geometry, ownership and independence using the real addon API. */
function validateCopies(copies, source, native) {
  for (const copy of copies) {
    assert.ok(copy instanceof native.NativeRange);
    assert.equal(copy.startOffset, 3); assert.equal(copy.endOffset, 7);
    assert.equal(copy.start.node, 1); assert.equal(copy.end.node, 2);
  }
  copies[0].setStart(1, 4);
  assert.equal(copies[0].startOffset, 4);
  assert.equal(copies[1].startOffset, 3);
  assert.equal(source.startOffset, 3); assert.equal(source.endOffset, 7);
}
/** Bound finalizer drainage without retrying until a desired result appears. */
async function settle() {
  for (let cycle = 0; cycle < 2; cycle++) { await yieldTurn(); global.gc(); await yieldTurn(); }
}
async function worker(runtimeRoot) {
  assert.equal(typeof global.gc, 'function', 'Run native copy workers with --expose-gc');
  const native = require(path.join(runtimeRoot, 'dist/native.cjs'));
  const source = new native.NativeRange(); source.setStart(1, 3); source.setEnd(2, 7);
  const baselineLive = native.NativeRange.statistics().live;
  const report = { node: process.version, runtimeRoot, copyCount: COPY_COUNT,
    warmupSamples: WARMUP_SAMPLES, measuredSamples: MEASURED_SAMPLES,
    binarySha256: sha256(fs.readFileSync(path.join(runtimeRoot, 'dist/rustdom.node'))), samples: [] };
  for (let sample = 0; sample < WARMUP_SAMPLES + MEASURED_SAMPLES; sample++) {
    let copies = new Array(COPY_COUNT);
    await settle();
    const before = native.NativeRange.statistics(); assert.equal(before.live, baselineLive);
    const start = performance.now();
    for (let index = 0; index < COPY_COUNT; index++) copies[index] = source.copy();
    const elapsedMs = performance.now() - start;
    const allocated = native.NativeRange.statistics();
    assert.equal(allocated.created - before.created, COPY_COUNT);
    assert.equal(allocated.live - before.live, COPY_COUNT);
    validateCopies(copies, source, native);
    copies = null; await settle();
    const released = native.NativeRange.statistics();
    assert.equal(released.live, baselineLive, 'Every retained native copy must be released after the fixed GC cycles');
    assert.equal(released.created - before.created, released.released - before.released);
    report.samples.push({ sample, warmup: sample < WARMUP_SAMPLES, elapsedMs, before, allocated, released });
  }
  assert.equal(source.startOffset, 3); assert.equal(source.endOffset, 7);
  process.stdout.write(`${JSON.stringify({ ...report, complete: true })}\n`);
}
async function study(candidate, baseline, executable, outputRoot) {
  fs.mkdirSync(outputRoot, { recursive: false });
  const { captureSourceIdentity } = require(path.join(candidate, 'benchmarks/sources.cjs'));
  const sources = { A: captureSourceIdentity(baseline), B: captureSourceIdentity(candidate) };
  const binaries = { A: sha256(fs.readFileSync(path.join(baseline, 'dist/rustdom.node'))),
    B: sha256(fs.readFileSync(path.join(candidate, 'dist/rustdom.node'))) };
  const order = ['A', 'B', 'B', 'A', 'B', 'A', 'A', 'B', 'A', 'B', 'B', 'A', 'B', 'A', 'A', 'B'];
  const index = { schemaVersion: 1, diagnosticOnly: true, startedAt: new Date().toISOString(), complete: false,
    candidate, baseline, executable, sources, binaries, affinity: [2], order, copyCount: COPY_COUNT,
    driverSha256: sha256(fs.readFileSync(__filename)), runs: [], summaries: [] };
  const save = () => fs.writeFileSync(path.join(outputRoot, 'index.json'), `${JSON.stringify(index, null, 2)}\n`);
  save();
  try {
    for (const phase of ['AA', 'AB']) {
      const results = [];
      for (const [position, label] of order.entries()) {
        const runtimeRoot = phase === 'AA' || label === 'A' ? baseline : candidate;
        const binarySha256 = phase === 'AA' || label === 'A' ? binaries.A : binaries.B;
        const prefix = `${phase}-${String(position + 1).padStart(2, '0')}-${label}`;
        const command = ['-c', '2', executable, '--expose-gc', __filename, 'worker', runtimeRoot];
        process.stdout.write(`Native copy ${phase} ${position + 1}/16 ${label}\n`);
        const run = { phase, position: position + 1, label, runtimeRoot, binarySha256,
          command: ['taskset', ...command], complete: false, startedAt: new Date().toISOString() };
        index.runs.push(run); save();
        const result = spawnSync('taskset', command, { cwd: candidate, encoding: 'utf8', timeout: 600_000, maxBuffer: 16 * 1024 * 1024 });
        fs.writeFileSync(path.join(outputRoot, `${prefix}.json`), result.stdout ?? '');
        fs.writeFileSync(path.join(outputRoot, `${prefix}.stderr.log`), result.stderr ?? '');
        Object.assign(run, { exitCode: result.status, signal: result.signal, error: result.error?.message ?? null,
          finishedAt: new Date().toISOString(), report: `${prefix}.json`, stderr: `${prefix}.stderr.log` }); save();
        assert.equal(result.status, 0, `Native copy worker failed: ${prefix}`);
        const report = JSON.parse(result.stdout);
        assert.equal(report.complete, true); assert.equal(report.node, 'v22.12.0');
        assert.equal(report.binarySha256, binarySha256); assert.equal(report.runtimeRoot, runtimeRoot);
        assert.equal(report.samples.length, WARMUP_SAMPLES + MEASURED_SAMPLES);
        assert.equal(report.copyCount, COPY_COUNT);
        run.reportSha256 = sha256(Buffer.from(result.stdout)); run.complete = true; save();
        results.push({ label, report });
      }
      const summary = { phase };
      for (const label of ['A', 'B']) {
        const selected = results.filter((result) => result.label === label);
        const samples = selected.flatMap(({ report }) => report.samples.filter((sample) => !sample.warmup).map((sample) => sample.elapsedMs));
        assert.equal(samples.length, 72);
        summary[label] = { count: samples.length, medianMs: median(samples), minMs: Math.min(...samples),
          maxMs: Math.max(...samples), processMediansMs: selected.map(({ report }) => median(report.samples.filter((sample) => !sample.warmup).map((sample) => sample.elapsedMs))) };
      }
      summary.changePercent = (summary.B.medianMs / summary.A.medianMs - 1) * 100;
      summary.withinDiagnosticBudget = phase === 'AA' ? Math.abs(summary.changePercent) <= 5 : summary.changePercent <= 5;
      index.summaries.push(summary); save();
    }
    assert.equal(captureSourceIdentity(candidate).sourceHash, sources.B.sourceHash);
    assert.equal(captureSourceIdentity(baseline).sourceHash, sources.A.sourceHash);
    assert.equal(sha256(fs.readFileSync(path.join(candidate, 'dist/rustdom.node'))), binaries.B);
    assert.equal(sha256(fs.readFileSync(path.join(baseline, 'dist/rustdom.node'))), binaries.A);
    index.complete = true; index.finishedAt = new Date().toISOString(); save();
    process.stdout.write(`${JSON.stringify({ complete: true, summaries: index.summaries, outputRoot })}\n`);
  } catch (error) {
    index.failure = { message: error.message, stack: error.stack, at: new Date().toISOString() }; save(); throw error;
  }
}
if (process.argv[2] === 'worker') worker(path.resolve(process.argv[3]));
else study(...process.argv.slice(2).map((value) => path.resolve(value)));
