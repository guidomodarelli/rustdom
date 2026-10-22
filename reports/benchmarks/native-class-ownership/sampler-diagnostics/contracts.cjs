/** @file Checks actual diagnostic processes against the original public results and teardown. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const [diagnosticRoot, manifestPath, frozenNodeRoot, outputRoot] = process.argv.slice(2);
fs.mkdirSync(outputRoot);
const checks = [];
for (const engine of ['jsdom', 'rustdom']) {
  const filename = path.join(outputRoot, `${engine}.json`);
  const processResult = spawnSync(process.execPath, ['--expose-gc', path.join(diagnosticRoot, 'worker.cjs'),
    manifestPath, 'AA', engine, '0', 'A', filename], { encoding: 'utf8' });
  fs.writeFileSync(`${filename}.stdout.log`, processResult.stdout ?? '');
  fs.writeFileSync(`${filename}.stderr.log`, processResult.stderr ?? '');
  assert.equal(processResult.status, 0, processResult.stderr);
  const report = JSON.parse(fs.readFileSync(filename));
  const telemetry = JSON.parse(fs.readFileSync(`${filename}.telemetry.json`));
  const original = JSON.parse(fs.readFileSync(path.join(frozenNodeRoot, `AA-0-${engine}-A.json`)));
  assert.equal(report.complete, true);
  assert.equal(telemetry.complete, true);
  assert.equal(telemetry.gateReevaluated, false);
  assert.equal(telemetry.accepted, null);
  assert.equal(report.batches.length, original.batches.length);
  assert.ok(telemetry.gcEvents.length > 0);
  assert.ok(telemetry.gcEvents.every((entry) => Number.isFinite(entry.startMs) && entry.durationMs >= 0));
  for (const anchor of [telemetry.start, telemetry.end]) assert.ok(anchor.beforeUs <= anchor.afterUs);
  for (const [batchIndex, batch] of report.batches.entries()) {
    const expected = original.batches[batchIndex];
    assert.equal(batch.name, expected.name);
    assert.equal(batch.size, expected.size);
    assert.equal(batch.outputHash, expected.outputHash);
    assert.equal(batch.sampleTimings.length, 12);
    assert.deepEqual(batch.sampleTimings.map((entry) => entry.index), Array.from({ length: 12 }, (_, index) => index));
    assert.deepEqual(batch.sampleTimings.map((entry) => entry.stage), [...Array(3).fill('warmup'), ...Array(9).fill('measured')]);
    assert.deepEqual(batch.sampleTimings.slice(3).map((entry) => entry.durationMs), batch.samplesMs);
    let previousEnd = telemetry.start.performanceMs;
    for (const span of batch.sampleTimings) {
      assert.ok(Number.isFinite(span.startMs) && span.startMs >= previousEnd);
      assert.ok(Number.isFinite(span.durationMs) && span.durationMs > 0);
      previousEnd = span.startMs + span.durationMs;
      assert.ok(previousEnd <= telemetry.end.performanceMs);
    }
    assert.ok(batch.cleanupTrace.slice(-2).every((entry) => entry.clear));
    checks.push({ engine, row: `${batch.name}/${batch.size}`, checkedSpans: 12,
      publicOutputMatchesFrozen: true, finalOwnershipClear: true });
  }
}
fs.writeFileSync(path.join(outputRoot, 'contracts.json'), `${JSON.stringify({ node: process.version,
  diagnosticOnly: true, gateReevaluated: false, checks }, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ node: process.version, passed: checks.length, spans: checks.length * 12 })}\n`);
