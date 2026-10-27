/** @file Recomputes the archived ownership evidence before publishing its checkpoint. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { gunzipSync } = require('node:zlib');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../../..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath));
const readJson = (relativePath) => JSON.parse(read(relativePath).toString('utf8'));
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const base = 'reports/validation/native-class-ownership';
const manifest = readJson(`${base}/manifest.json`);
assert.equal(manifest.terminalReceipt.exitCode, 0);
for (const entry of [...manifest.sources, ...manifest.logs]) {
  const bytes = read(entry.path);
  assert.equal(bytes.length, entry.bytes, `Size mismatch: ${entry.path}`);
  assert.equal(digest(bytes), entry.sha256, `Hash mismatch: ${entry.path}`);
}
for (const entry of manifest.artifacts) {
  const bytes = read(entry.storedPath);
  assert.equal(bytes.length, entry.storedBytes, `Stored size mismatch: ${entry.storedPath}`);
  assert.equal(digest(bytes), entry.storedSha256, `Stored hash mismatch: ${entry.storedPath}`);
  const original = entry.storedPath.endsWith('.gz') ? gunzipSync(bytes) : bytes;
  assert.equal(original.length, entry.originalBytes, `Original size mismatch: ${entry.originalPath}`);
  assert.equal(digest(original), entry.originalSha256, `Original hash mismatch: ${entry.originalPath}`);
}
for (const line of read(`${base}/distribution-lockfiles.sha256`).toString('utf8').trim().split('\n')) {
  const [, expected, relativePath] = line.match(/^([0-9a-f]{64})\s+(.+)$/);
  assert.equal(digest(read(relativePath)), expected, `Lockfile hash mismatch: ${relativePath}`);
}
/** Compute a median from every recorded duration. */
function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}
let processes = 0;
let measuredDurations = 0;
for (const phase of ['local', 'negative-control']) {
  const directory = `reports/benchmarks/native-class-ownership/${phase}`;
  const index = readJson(`${directory}/index.json`);
  assert.equal(index.complete, true, `${phase} must finish`);
  assert.equal(readJson(`${directory}/terminal-result.json`).exitCode, 0);
  const driver = phase === 'local' ? 'run-protocol.cjs' : 'run-negative-control.cjs';
  assert.equal(digest(read(`reports/benchmarks/native-class-ownership/${driver}`)), index.driverSha256);
  const reports = index.blocks.map((block) => {
    assert.equal(block.complete, true); assert.equal(block.exitCode, 0);
    assert.equal(digest(read(`${directory}/${block.report}`)), block.reportSha256);
    const report = readJson(`${directory}/${block.report}`);
    assert.equal(report.complete, true); assert.equal(report.node, block.node);
    assert.equal(report.nativeBinarySha256, phase === 'local' ? index.binaries[block.label] : index.binarySha256);
    assert.equal(report.runtimeSource.root, block.runtimeRoot);
    assert.equal(report.sourceHash, manifest.sourceIdentity.sourceHash);
    assert.deepEqual(report.runs.map((run) => run.engine), ['jsdom', 'rustdom', 'rustdom', 'jsdom']);
    const expectedRows = phase === 'local' ? index.expectedRows : index.selections.find((entry) => entry.node === block.node).expectedRows;
    assert.deepEqual(report.comparisons.map((row) => `${row.workload}/${row.rows}`).sort(), expectedRows);
    for (const run of report.runs) {
      assert.equal(run.warmupSamples, 3); assert.equal(run.measuredSamples, 9); processes++;
      assert.deepEqual(run.workloads.map((row) => `${row.name}/${row.rows}`).sort(), expectedRows);
      for (const row of run.workloads) { assert.equal(row.samplesMs.length, 9); measuredDurations += row.samplesMs.length; }
    }
    return { ...block, report };
  });
  for (const summaryName of index.summaries) {
    const summary = readJson(`${directory}/${summaryName}`);
    assert.equal(summary.complete, true);
    const nodeBlocks = reports.filter((entry) => entry.node === summary.node);
    assert.deepEqual(nodeBlocks.map((entry) => entry.label), ['A', 'B', 'B', 'A', 'B', 'A', 'A', 'B']);
    for (const row of summary.rows) {
      const hashes = new Set();
      for (const label of ['A', 'B']) {
        for (const engine of ['jsdom', 'rustdom']) {
          const processMedians = [];
          const samples = nodeBlocks.filter((entry) => entry.label === label).flatMap(({ report }) =>
            report.runs.filter((run) => run.engine === engine).flatMap((run) => {
              const workload = run.workloads.find((entry) => `${entry.name}/${entry.rows}` === row.key);
              hashes.add(workload.outputHash); processMedians.push(median(workload.samplesMs)); return workload.samplesMs;
            }));
          assert.equal(samples.length, 72);
          assert.equal(row[label][engine].count, 72);
          assert.equal(row[label][engine].medianMs, median(samples));
          assert.deepEqual(row[label][engine].processMediansMs, processMedians);
        }
      }
      assert.equal(hashes.size, 1, `Output mismatch: ${summary.node}/${row.key}`);
      assert.equal(row.rustdomChangePercent, (row.B.rustdom.medianMs / row.A.rustdom.medianMs - 1) * 100);
      assert.equal(row.jsdomControlChangePercent, (row.B.jsdom.medianMs / row.A.jsdom.medianMs - 1) * 100);
      if (phase === 'local') {
        assert.equal(row.controlCalibrated, Math.abs(row.jsdomControlChangePercent) <= 2);
        assert.equal(row.flaggedForInvestigation, row.rustdomChangePercent > 5);
      } else assert.equal(row.calibrated, Math.abs(row.rustdomChangePercent) <= 5 && Math.abs(row.jsdomControlChangePercent) <= 2);
    }
  }
}
if (process.argv.includes('--staged')) {
  const sourcePaths = manifest.sources.map((source) => source.path);
  const result = spawnSync('git', ['ls-files', '--stage', '-z', '--', ...sourcePaths], { cwd: root, encoding: 'utf8' });
  if (result.error || result.status !== 0) throw new Error(
    `Ownership evidence: reading staged source identities failed (${result.error?.code ?? result.status})`,
    { cause: result.error ?? new Error(result.stderr) });
  const entries = new Map(result.stdout.split('\0').filter(Boolean).map((line) => {
    const [, hash, stage, name] = line.match(/^\d+ ([0-9a-f]+) (\d)\t(.+)$/);
    assert.equal(stage, '0'); return [name, hash];
  }));
  for (const source of manifest.sources) {
    const bytes = read(source.path);
    const hash = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
    assert.equal(entries.get(source.path), hash, `Staged bytes differ from executed source: ${source.path}`);
  }
}
process.stdout.write(`${JSON.stringify({ sources: manifest.sources.length, logs: manifest.logs.length,
  artifacts: manifest.artifacts.length, processes, measuredDurations, verified: true })}\n`);
