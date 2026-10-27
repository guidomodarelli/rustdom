/** @file Runs one fixed baseline A/A diagnostic for families flagged by the completed ownership study. */
'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { readFileSync, writeFileSync, mkdirSync, openSync, closeSync, copyFileSync } = require('node:fs');
const { resolve, dirname, basename } = require('node:path');
const [runtime, baseline, node22, node24, studyRoot, outputRoot] = process.argv.slice(2).map((value) => resolve(value));
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const sha256 = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');
const study = readJson(resolve(studyRoot, 'index.json'));
assert.equal(study.complete, true, 'Wait for the original study to finish before running diagnostics');
assert.equal(study.candidateRoot, runtime);
assert.equal(study.baselineRoot, baseline);
const binarySha256 = sha256(resolve(baseline, 'dist/rustdom.node'));
assert.equal(binarySha256, study.binaries.A);
const { captureSourceIdentity } = require(resolve(runtime, 'benchmarks/sources.cjs'));
assert.equal(captureSourceIdentity(runtime).sourceHash, study.runtimeSources.B.sourceHash);
assert.equal(captureSourceIdentity(baseline).sourceHash, study.runtimeSources.A.sourceHash);
mkdirSync(outputRoot, { recursive: false });
const blockOrder = ['A', 'B', 'B', 'A', 'B', 'A', 'A', 'B'];
const index = { schemaVersion: 1, startedAt: new Date().toISOString(), complete: false,
  studyRoot, studyIndexSha256: sha256(resolve(studyRoot, 'index.json')), baseline, binarySha256,
  runtime, sourceHash: study.runtimeSources.B.sourceHash, affinity: [2], blockOrder,
  driverSha256: sha256(__filename), blocks: [], selections: [], summaries: [],
  interpretation: 'Both labels load the same checkpoint67 binary. A/A cannot turn the original A/B into a passing result.' };
const save = () => writeFileSync(resolve(outputRoot, 'index.json'), `${JSON.stringify(index, null, 2)}\n`);
/** Summarize all samples without deleting outliers. */
const median = (values) => {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};
save();
try {
  for (const [executable, version] of [[node22, 'v22.12.0'], [node24, 'v24.14.1']]) {
    const summaryName = `${version}-summary.json`;
    assert.ok(study.summaries.includes(summaryName));
    const summary = readJson(resolve(studyRoot, summaryName));
    assert.equal(summary.complete, true);
    const flagged = summary.rows.filter((row) => row.rustdomChangePercent > 5 && Math.abs(row.jsdomControlChangePercent) <= 2);
    const workloads = [...new Set(flagged.map((row) => row.key.split('/')[0]))].sort();
    const expectedRows = summary.rows.filter((row) => workloads.includes(row.key.split('/')[0])).map((row) => row.key).sort();
    index.selections.push({ node: version, originalSummary: summaryName,
      originalSummarySha256: sha256(resolve(studyRoot, summaryName)), flaggedRows: flagged.map((row) => row.key), workloads, expectedRows });
    save();
    if (!workloads.length) continue;
    const reports = [];
    for (const [position, label] of blockOrder.entries()) {
      const prefix = `${version}-${String(position + 1).padStart(2, '0')}-${label}`;
      const stdoutPath = resolve(outputRoot, `${prefix}.stdout.log`);
      const stderrPath = resolve(outputRoot, `${prefix}.stderr.log`);
      const command = ['-c', '2', executable, 'benchmarks/compare.cjs', ...workloads];
      const block = { node: version, position: position + 1, label, complete: false,
        startedAt: new Date().toISOString(), command: ['taskset', ...command], runtimeRoot: baseline,
        stdout: basename(stdoutPath), stderr: basename(stderrPath) };
      index.blocks.push(block); save();
      process.stdout.write(`Ownership A/A ${version} ${position + 1}/8 ${label}\n`);
      const stdout = openSync(stdoutPath, 'wx');
      const stderr = openSync(stderrPath, 'wx');
      let result;
      try {
        result = spawnSync('taskset', command, { cwd: runtime,
          env: { ...process.env, PATH: `${dirname(executable)}:${process.env.PATH}`, RUSTDOM_BENCHMARK_PACKAGE: baseline },
          stdio: ['ignore', stdout, stderr] });
      } finally { closeSync(stdout); closeSync(stderr); }
      Object.assign(block, { exitCode: result.status, signal: result.signal,
        finishedAt: new Date().toISOString(), error: result.error?.message ?? null });
      save();
      assert.equal(result.status, 0, `Inspect failed A/A block ${stderrPath}`);
      const match = readFileSync(stdoutPath, 'utf8').match(/^Guardado: (.+)$/m);
      assert.ok(match, `Missing durable report for ${prefix}`);
      const originalPath = resolve(runtime, match[1].trim());
      const report = readJson(originalPath);
      const reportName = `${prefix}.json`;
      copyFileSync(originalPath, resolve(outputRoot, reportName));
      Object.assign(block, { report: reportName, reportSha256: sha256(originalPath) });
      assert.equal(report.complete, true);
      assert.equal(report.node, version);
      assert.equal(report.sourceHash, study.runtimeSources.B.sourceHash);
      assert.equal(report.runtimeSource.root, baseline);
      assert.equal(report.nativeBinarySha256, binarySha256);
      assert.deepEqual(report.runs.map((run) => run.engine), ['jsdom', 'rustdom', 'rustdom', 'jsdom']);
      assert.deepEqual(report.comparisons.map((row) => `${row.workload}/${row.rows}`).sort(), expectedRows);
      for (const run of report.runs) {
        assert.equal(run.warmupSamples, 3); assert.equal(run.measuredSamples, 9);
        assert.deepEqual(run.workloads.map((row) => `${row.name}/${row.rows}`).sort(), expectedRows);
        for (const row of run.workloads) {
          assert.equal(row.samplesMs.length, 9);
          assert.ok(row.samplesMs.every((duration) => Number.isFinite(duration) && duration > 0));
          assert.match(row.outputHash, /^[0-9a-f]{64}$/);
        }
      }
      reports.push({ label, report }); block.complete = true; save();
    }
    const rows = expectedRows.map((key) => {
      const row = { key, originallyFlagged: flagged.some((entry) => entry.key === key) };
      const hashes = new Set();
      for (const label of ['A', 'B']) {
        row[label] = {};
        for (const engine of ['jsdom', 'rustdom']) {
          const processMediansMs = [];
          const samples = reports.filter((entry) => entry.label === label).flatMap(({ report }) =>
            report.runs.filter((run) => run.engine === engine).flatMap((run) => {
              const entry = run.workloads.find((workload) => `${workload.name}/${workload.rows}` === key);
              hashes.add(entry.outputHash); processMediansMs.push(median(entry.samplesMs)); return entry.samplesMs;
            }));
          assert.equal(samples.length, 72);
          row[label][engine] = { count: samples.length, medianMs: median(samples), processMediansMs,
            minMs: Math.min(...samples), maxMs: Math.max(...samples) };
        }
      }
      assert.equal(hashes.size, 1, `A/A output mismatch for ${key}`);
      row.rustdomChangePercent = (row.B.rustdom.medianMs / row.A.rustdom.medianMs - 1) * 100;
      row.jsdomControlChangePercent = (row.B.jsdom.medianMs / row.A.jsdom.medianMs - 1) * 100;
      row.calibrated = Math.abs(row.rustdomChangePercent) <= 5 && Math.abs(row.jsdomControlChangePercent) <= 2;
      return row;
    });
    const outputName = `${version}-summary.json`;
    writeFileSync(resolve(outputRoot, outputName), `${JSON.stringify({ node: version, complete: true, rows }, null, 2)}\n`);
    index.summaries.push(outputName); save();
  }
  assert.equal(sha256(resolve(baseline, 'dist/rustdom.node')), binarySha256);
  assert.equal(captureSourceIdentity(runtime).sourceHash, study.runtimeSources.B.sourceHash);
  assert.equal(captureSourceIdentity(baseline).sourceHash, study.runtimeSources.A.sourceHash);
  index.complete = true; index.finishedAt = new Date().toISOString(); save();
  process.stdout.write(`Ownership negative control complete: ${outputRoot}\n`);
} catch (error) {
  index.failure = { message: error.message, stack: error.stack, at: new Date().toISOString() }; save(); throw error;
}
