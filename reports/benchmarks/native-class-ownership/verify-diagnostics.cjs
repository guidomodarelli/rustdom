/** @file Verifies archived profiling inputs, native-copy observations and every diagnostic aggregate. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { gunzipSync } = require('node:zlib');
const { spawnSync } = require('node:child_process');
const root = __dirname;
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const read = (relativePath) => {
  const target = path.join(root, relativePath);
  return fs.existsSync(target) ? fs.readFileSync(target) : gunzipSync(fs.readFileSync(`${target}.gz`));
};
const readJson = (relativePath) => JSON.parse(read(relativePath).toString('utf8'));
const manifest = readJson('diagnostic-evidence.json');
for (const file of manifest.files) {
  const stored = fs.readFileSync(path.join(root, file.stored));
  assert.equal(stored.length, file.storedBytes);
  assert.equal(digest(stored), file.storedSha256, `Stored diagnostic changed: ${file.stored}`);
  const original = file.stored.endsWith('.gz') ? gunzipSync(stored) : stored;
  assert.equal(original.length, file.originalBytes);
  assert.equal(digest(original), file.originalSha256, `Original diagnostic changed: ${file.original}`);
}
const originalStudy = readJson('local/index.json');
for (const study of manifest.studies) {
  const index = readJson(`${study.directory}/index.json`);
  assert.equal(index.complete, true);
  assert.equal(index.sources.A.sourceHash, originalStudy.runtimeSources.A.sourceHash);
  assert.equal(index.sources.B.sourceHash, originalStudy.runtimeSources.B.sourceHash);
  assert.deepEqual(index.binaries, originalStudy.binaries);
  assert.equal(digest(read(`${study.directory}/driver.cjs`)), index.driverSha256);
  for (const run of index.runs) assert.equal(run.complete, true);
}
const median = (values) => {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};
const native = readJson('native-copy/index.json');
let copies = 0; let nativeMeasuredSamples = 0;
const nativeReports = native.runs.map((run) => {
  assert.equal(run.exitCode, 0);
  assert.equal(digest(read(`native-copy/${run.report}`)), run.reportSha256);
  const report = readJson(`native-copy/${run.report}`);
  assert.equal(report.complete, true); assert.equal(report.node, 'v22.12.0');
  assert.equal(report.runtimeRoot, run.runtimeRoot); assert.equal(report.binarySha256, run.binarySha256);
  assert.equal(report.binarySha256, run.phase === 'AA' || run.label === 'A' ? native.binaries.A : native.binaries.B);
  assert.equal(report.warmupSamples, 3); assert.equal(report.measuredSamples, 9); assert.equal(report.copyCount, 10_000);
  assert.equal(report.samples.length, 12);
  for (const [position, sample] of report.samples.entries()) {
    assert.equal(sample.sample, position); assert.equal(sample.warmup, position < 3);
    assert.ok(Number.isFinite(sample.elapsedMs) && sample.elapsedMs > 0);
    assert.equal(sample.allocated.created - sample.before.created, report.copyCount);
    assert.equal(sample.allocated.live - sample.before.live, report.copyCount);
    assert.equal(sample.released.live, sample.before.live);
    assert.equal(sample.released.created - sample.before.created, report.copyCount);
    assert.equal(sample.released.released - sample.before.released, report.copyCount);
    copies += report.copyCount; if (!sample.warmup) nativeMeasuredSamples++;
  }
  return { ...run, report };
});
for (const summary of native.summaries) {
  const runs = nativeReports.filter((run) => run.phase === summary.phase);
  assert.deepEqual(runs.map((run) => run.label), native.order);
  for (const label of ['A', 'B']) {
    const selected = runs.filter((run) => run.label === label);
    const samples = selected.flatMap((run) => run.report.samples.filter((sample) => !sample.warmup).map((sample) => sample.elapsedMs));
    assert.equal(samples.length, 72); assert.equal(summary[label].count, 72);
    assert.equal(summary[label].medianMs, median(samples));
    assert.deepEqual(summary[label].processMediansMs, selected.map((run) => median(run.report.samples.filter((sample) => !sample.warmup).map((sample) => sample.elapsedMs))));
  }
  assert.equal(summary.changePercent, (summary.B.medianMs / summary.A.medianMs - 1) * 100);
  assert.equal(summary.withinDiagnosticBudget, summary.phase === 'AA' ? Math.abs(summary.changePercent) <= 5 : summary.changePercent <= 5);
}
for (const version of ['v1', 'v2']) {
  const index = readJson(`profiles/${version}/index.json`);
  assert.deepEqual(index.runs.map((run) => run.label), ['A', 'B', 'B', 'A']);
  const hashes = new Map();
  for (const run of index.runs) {
    assert.equal(run.exitCode, 0);
    assert.equal(run.binarySha256, index.binaries[run.label]);
    const report = readJson(`profiles/${version}/${run.stdout}`);
    assert.equal(report.warmupSamples, 3); assert.equal(report.measuredSamples, 9);
    assert.deepEqual(report.workloads.map((row) => row.rows), [250, 1000]);
    for (const row of report.workloads) {
      if (hashes.has(row.rows)) assert.equal(row.outputHash, hashes.get(row.rows));
      else hashes.set(row.rows, row.outputHash);
    }
    if (version === 'v2') { assert.equal(report.profileMarkers.length, 24); assert.equal(report.profileClockCalibrations.length, 6); }
  }
}
const analysis = spawnSync(process.execPath, [path.join(root, 'analyze-profile.cjs'), path.join(root, 'profiles/v2'), '--verify'], { encoding: 'utf8' });
if (analysis.error || analysis.status !== 0) throw new Error('Ownership diagnostics: archived profile analysis did not reproduce',
  { cause: analysis.error ?? new Error(analysis.stderr) });
process.stdout.write(`${JSON.stringify({ verified: true, archivedFiles: manifest.files.length,
  nativeProcesses: nativeReports.length, nativeMeasuredSamples, copiesIncludingWarmup: copies, profileRuns: 8,
  profileAnalysis: JSON.parse(analysis.stdout) })}\n`);
