/** @file Executes the fixed checkpoint-67 ownership protocol using the real benchmark CLI. */
'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { readFileSync, writeFileSync, mkdirSync, openSync, closeSync, copyFileSync } = require('node:fs');
const { resolve, dirname, basename } = require('node:path');

const [candidateRoot, baselineRoot, node22, node24, outputRoot] = process.argv.slice(2).map((value) => resolve(value));
assert.ok(outputRoot, 'Pass candidate, baseline, Node 22, Node 24 and a new output directory');
mkdirSync(outputRoot, { recursive: false });
const blockOrder = ['A', 'B', 'B', 'A', 'B', 'A', 'A', 'B'];
const workloads = ['range-control-1000', 'range-state-lifecycle-1000',
  'mutation-records-collect', 'observer-delivery-records'];
const expectedRows = workloads.flatMap((workload) =>
  (workload.startsWith('range-') ? [250, 1000] : [100, 1000]).map((rows) => `${workload}/${rows}`)).sort();
const sha256 = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');
const binaries = { A: sha256(resolve(baselineRoot, 'dist/rustdom.node')),
  B: sha256(resolve(candidateRoot, 'dist/rustdom.node')) };
const checkpoint = JSON.parse(readFileSync(resolve(baselineRoot, 'checkpoint.json'), 'utf8'));
assert.equal(checkpoint.binarySha256, binaries.A);
const { captureSourceIdentity } = require(resolve(candidateRoot, 'benchmarks/sources.cjs'));
const runtimeSources = { A: captureSourceIdentity(baselineRoot), B: captureSourceIdentity(candidateRoot) };
assert.equal(runtimeSources.A.sourceHash, checkpoint.sourceHash);
const index = { schemaVersion: 1, startedAt: new Date().toISOString(), complete: false,
  protocol: 'PROTOCOL.md', affinity: [2], blockOrder, workloads, expectedRows,
  candidateRoot, baselineRoot, checkpoint, binaries, runtimeSources, blocks: [],
  driverSha256: sha256(__filename), environment: { node22, node24 },
  limits: 'One Linux/WSL host; affinity does not isolate the Windows host. No sample filtering or adaptive reruns.' };
const persist = () => writeFileSync(resolve(outputRoot, 'index.json'), `${JSON.stringify(index, null, 2)}\n`);
const median = (values) => {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};
const summarize = (samples) => ({ count: samples.length, medianMs: median(samples),
  minMs: Math.min(...samples), maxMs: Math.max(...samples) });
persist();
try {
  for (const executable of [node22, node24]) {
    const versionResult = spawnSync(executable, ['--version'], { encoding: 'utf8' });
    assert.equal(versionResult.status, 0);
    const version = versionResult.stdout.trim();
    const reports = [];
    for (const [position, label] of blockOrder.entries()) {
      const prefix = `${version}-${String(position + 1).padStart(2, '0')}-${label}`;
      const runtimeRoot = label === 'A' ? baselineRoot : candidateRoot;
      const stdoutPath = resolve(outputRoot, `${prefix}.stdout.log`);
      const stderrPath = resolve(outputRoot, `${prefix}.stderr.log`);
      const command = ['-c', '2', executable, 'benchmarks/compare.cjs', ...workloads];
      const block = { position: position + 1, label, node: version, startedAt: new Date().toISOString(),
        command: ['taskset', ...command], runtimeRoot, binarySha256: binaries[label],
        stdout: basename(stdoutPath), stderr: basename(stderrPath), complete: false };
      index.blocks.push(block);
      persist();
      process.stdout.write(`Ownership benchmark ${version} ${position + 1}/8 ${label}\n`);
      const stdout = openSync(stdoutPath, 'wx');
      const stderr = openSync(stderrPath, 'wx');
      let result;
      try {
        result = spawnSync('taskset', command, { cwd: candidateRoot,
          env: { ...process.env, PATH: `${dirname(executable)}:${process.env.PATH}`,
            RUSTDOM_BENCHMARK_PACKAGE: runtimeRoot }, stdio: ['ignore', stdout, stderr] });
      } finally { closeSync(stdout); closeSync(stderr); }
      Object.assign(block, { exitCode: result.status, signal: result.signal,
        finishedAt: new Date().toISOString(), error: result.error?.message ?? null });
      persist();
      assert.equal(result.status, 0, `Benchmark failed; inspect ${stderrPath}`);
      const reportMatch = readFileSync(stdoutPath, 'utf8').match(/^Guardado: (.+)$/m);
      assert.ok(reportMatch, `Missing durable report in ${stdoutPath}`);
      const originalPath = resolve(candidateRoot, reportMatch[1].trim());
      const report = JSON.parse(readFileSync(originalPath, 'utf8'));
      const reportName = `${prefix}.json`;
      copyFileSync(originalPath, resolve(outputRoot, reportName));
      Object.assign(block, { report: reportName, reportSha256: sha256(originalPath),
        sourceHash: report.sourceHash, sourceCommit: report.sourceCommit });
      assert.equal(report.complete, true);
      assert.equal(report.node, version);
      assert.equal(report.nativeBinarySha256, binaries[label]);
      assert.equal(report.runtimeSource.root, runtimeRoot);
      assert.equal(report.sourceHash, runtimeSources.B.sourceHash);
      assert.deepEqual(report.comparisons.map((entry) => `${entry.workload}/${entry.rows}`).sort(), expectedRows);
      assert.deepEqual(report.runs.map((run) => run.engine), ['jsdom', 'rustdom', 'rustdom', 'jsdom']);
      for (const run of report.runs) {
        assert.equal(run.warmupSamples, 3);
        assert.equal(run.measuredSamples, 9);
        assert.deepEqual(run.workloads.map((entry) => `${entry.name}/${entry.rows}`).sort(), expectedRows);
        for (const workload of run.workloads) {
          assert.equal(workload.samplesMs.length, 9);
          assert.ok(workload.samplesMs.every((duration) => Number.isFinite(duration) && duration > 0));
          assert.match(workload.outputHash, /^[0-9a-f]{64}$/);
        }
      }
      for (const row of report.comparisons) {
        const outputs = report.runs.map((run) => run.workloads.find((entry) => entry.name === row.workload && entry.rows === row.rows));
        assert.equal(new Set(outputs.map((entry) => entry.outputHash)).size, 1);
        for (const engine of ['jsdom', 'rustdom']) {
          const samples = report.runs.filter((run) => run.engine === engine).flatMap((run) =>
            run.workloads.find((entry) => entry.name === row.workload && entry.rows === row.rows).samplesMs);
          assert.equal(row[engine].medianMs, median(samples));
        }
      }
      reports.push({ label, report });
      block.complete = true;
      persist();
    }
    const rows = expectedRows.map((key) => {
      const row = { key };
      const hashes = new Set();
      for (const label of ['A', 'B']) {
        row[label] = {};
        for (const engine of ['jsdom', 'rustdom']) {
          const processMedians = [];
          const samples = reports.filter((block) => block.label === label).flatMap(({ report }) =>
            report.runs.filter((run) => run.engine === engine).flatMap((run) => {
              const workload = run.workloads.find((entry) => `${entry.name}/${entry.rows}` === key);
              hashes.add(workload.outputHash);
              processMedians.push(median(workload.samplesMs));
              return workload.samplesMs;
            }));
          assert.equal(samples.length, 72);
          row[label][engine] = { ...summarize(samples), processMediansMs: processMedians };
        }
      }
      assert.equal(hashes.size, 1, `Cross-block output mismatch for ${key}`);
      row.rustdomChangePercent = (row.B.rustdom.medianMs / row.A.rustdom.medianMs - 1) * 100;
      row.jsdomControlChangePercent = (row.B.jsdom.medianMs / row.A.jsdom.medianMs - 1) * 100;
      row.controlCalibrated = Math.abs(row.jsdomControlChangePercent) <= 2;
      row.flaggedForInvestigation = row.rustdomChangePercent > 5;
      row.interpretation = row.controlCalibrated ?
        (row.flaggedForInvestigation ? 'Investigate candidate degradation above 5%' : 'Within declared timing budget on this host') :
        'Inconclusive for attribution: jsdom control exceeds 2%';
      return row;
    });
    const summaryName = `${version}-summary.json`;
    writeFileSync(resolve(outputRoot, summaryName), `${JSON.stringify({ node: version, complete: true, rows }, null, 2)}\n`);
    index.summaries ??= [];
    index.summaries.push(summaryName);
    persist();
  }
  assert.equal(captureSourceIdentity(baselineRoot).sourceHash, runtimeSources.A.sourceHash);
  assert.equal(captureSourceIdentity(candidateRoot).sourceHash, runtimeSources.B.sourceHash);
  assert.equal(sha256(resolve(baselineRoot, 'dist/rustdom.node')), binaries.A);
  assert.equal(sha256(resolve(candidateRoot, 'dist/rustdom.node')), binaries.B);
  index.complete = true;
  index.finishedAt = new Date().toISOString();
  persist();
  process.stdout.write(`Ownership protocol complete: ${outputRoot}\n`);
} catch (error) {
  index.failure = { message: error.message, stack: error.stack, at: new Date().toISOString() };
  persist();
  throw error;
}
