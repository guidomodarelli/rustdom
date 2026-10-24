/** @file Runs and verifies one fixed A/A + A/B replay of the public Range workload on an independent host. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const protocol = require('./constants/hosted.cjs');
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const sha256 = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const median = (values) => {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

/** Recompute fixed public-operation summaries from real worker observations, retaining every sample. */
function summarize(entries, phase) {
  assert.ok(['AA', 'AB'].includes(phase));
  assert.deepEqual(entries.map((entry) => entry.label), protocol.order);
  return protocol.rows.map((key) => {
    const row = { key };
    const outputHashes = new Set();
    for (const label of ['A', 'B']) {
      row[label] = {};
      for (const engine of ['jsdom', 'rustdom']) {
        const processMediansMs = [];
        const samples = entries.filter((entry) => entry.label === label).flatMap(({ report }) => {
          assert.equal(report.complete, true);
          assert.equal(report.node, protocol.nodeVersion);
          assert.deepEqual(report.runs.map((run) => run.engine), protocol.engines);
          return report.runs.filter((run) => run.engine === engine).flatMap((run) => {
            assert.equal(run.warmupSamples, protocol.warmupSamples);
            assert.equal(run.measuredSamples, protocol.measuredSamples);
            const workload = run.workloads.find((entry) => `${entry.name}/${entry.rows}` === key);
            assert.ok(workload, `Missing public workload ${key}`);
            assert.equal(workload.samplesMs.length, protocol.measuredSamples);
            assert.ok(workload.samplesMs.every((sample) => Number.isFinite(sample) && sample > 0));
            assert.match(workload.outputHash, /^[0-9a-f]{64}$/);
            outputHashes.add(workload.outputHash);
            processMediansMs.push(median(workload.samplesMs));
            return workload.samplesMs;
          });
        });
        assert.equal(samples.length, protocol.samplesPerLabelEngine);
        row[label][engine] = { count: samples.length, medianMs: median(samples), processMediansMs };
      }
    }
    assert.equal(outputHashes.size, 1, `Public output differs between engines or labels for ${key}`);
    row.rustdomChangePercent = (row.B.rustdom.medianMs / row.A.rustdom.medianMs - 1) * 100;
    row.jsdomControlChangePercent = (row.B.jsdom.medianMs / row.A.jsdom.medianMs - 1) * 100;
    row.calibrated = Math.abs(row.jsdomControlChangePercent) <= protocol.controlBudgetPercent &&
      (phase === 'AB' || Math.abs(row.rustdomChangePercent) <= protocol.rustBudgetPercent);
    row.withinBudget = row.calibrated && row.rustdomChangePercent <= protocol.rustBudgetPercent;
    return row;
  });
}

/** Preserve new partial CLI reports before rejecting a failed process; historical files remain untouched. */
function archiveFailureReports(reportRoot, previousNames, outputRoot, prefix) {
  return fs.readdirSync(reportRoot).filter((name) => name.endsWith('-failed.json') && !previousNames.has(name))
    .map((name, position) => {
      const archivedName = `${prefix}-partial-${position + 1}.json`;
      fs.copyFileSync(path.join(reportRoot, name), path.join(outputRoot, archivedName));
      return { original: name, archived: archivedName, sha256: sha256(path.join(outputRoot, archivedName)) };
    });
}

/** Recompute summaries and identities from a finished archive; this never launches benchmarks or rewrites history. */
function verify(outputRoot) {
  const index = readJson(path.join(outputRoot, 'index.json'));
  assert.equal(index.complete, true);
  assert.deepEqual(index.protocol, protocol);
  for (const [relativePath, hash] of Object.entries(index.files)) {
    assert.equal(sha256(path.join(outputRoot, relativePath)), hash, `Archive changed: ${relativePath}`);
  }
  const summaries = {};
  for (const phase of ['AA', 'AB']) {
    const blocks = index.blocks.filter((block) => block.phase === phase);
    const entries = blocks.map((block) => {
      assert.equal(block.exitCode, 0);
      const report = readJson(path.join(outputRoot, block.report));
      const treatment = phase === 'AB' && block.label === 'B' ? 'B' : 'A';
      assert.equal(report.sourceHash, protocol.sourceHashes.B);
      assert.equal(report.runtimeSource.root, index.roots[treatment]);
      assert.equal(report.nativeBinarySha256, index.binaries[treatment]);
      assert.deepEqual(report.comparisons.map((row) => `${row.workload}/${row.rows}`).sort(), protocol.rows);
      return { label: block.label, report };
    });
    summaries[phase] = summarize(entries, phase);
  }
  assert.deepEqual(index.summaries, summaries);
  const accepted = summaries.AA.every((row) => row.calibrated) && summaries.AB.every((row) => row.withinBudget);
  assert.equal(index.accepted, accepted);
  return { verified: true, blocks: index.blocks.length, processes: index.blocks.length * protocol.engines.length,
    measuredDurations: index.blocks.length * protocol.engines.length * protocol.rows.length * protocol.measuredSamples,
    accepted, summaries };
}

/** Execute the fixed experiment once, preserving partial reports and failures in a new directory. */
function run(baselineArgument, outputArgument, cpuArgument) {
  assert.ok(baselineArgument && outputArgument && cpuArgument !== undefined, 'Usage: hosted-experiment.cjs BASELINE NEW_OUTPUT CPU');
  assert.match(cpuArgument, /^\d+$/, 'CPU must be a nonnegative integer');
  assert.ok(Number.isSafeInteger(Number(cpuArgument)), 'CPU must be a safe integer');
  const outputRoot = path.resolve(outputArgument);
  assert.equal(fs.existsSync(outputRoot), false, 'Experiment output directory already exists; preserve historical results');
  assert.equal(process.version, protocol.nodeVersion);
  const roots = { A: path.resolve(baselineArgument), B: process.cwd() };
  const { captureSourceIdentity } = require(path.join(roots.B, 'benchmarks/sources.cjs'));
  const sources = Object.fromEntries(Object.entries(roots).map(([label, root]) => [label, captureSourceIdentity(root)]));
  for (const label of ['A', 'B']) assert.equal(sources[label].sourceHash, protocol.sourceHashes[label]);
  assert.equal(sources.A.sourceCommit, protocol.baselineCommit);
  const binaries = Object.fromEntries(Object.entries(roots).map(([label, root]) => [label, sha256(path.join(root, 'dist/rustdom.node'))]));
  fs.mkdirSync(path.dirname(outputRoot), { recursive: true });
  fs.mkdirSync(outputRoot);
  const index = { schemaVersion: 1, complete: false, startedAt: new Date().toISOString(), protocol,
    roots, sources, binaries, cpu: Number(cpuArgument), requestedHead: process.env.RUSTDOM_BENCHMARK_REQUESTED_HEAD ?? null,
    blocks: [], summaries: {}, files: {} };
  const save = () => fs.writeFileSync(path.join(outputRoot, 'index.json'), `${JSON.stringify(index, null, 2)}\n`);
  const archive = (name, source) => {
    fs.copyFileSync(source, path.join(outputRoot, name));
    index.files[name] = sha256(path.join(outputRoot, name));
  };
  archive('driver.cjs', __filename);
  archive('protocol.cjs', path.join(__dirname, 'constants/hosted.cjs'));
  archive('HOSTED-PROTOCOL.md', path.join(__dirname, 'HOSTED-PROTOCOL.md'));
  save();
  try {
    for (const phase of ['AA', 'AB']) {
      const entries = [];
      for (const [position, label] of protocol.order.entries()) {
        const treatment = phase === 'AB' && label === 'B' ? 'B' : 'A';
        const prefix = `${phase}-${String(position + 1).padStart(2, '0')}-${label}`;
        const block = { phase, position, label, treatment, startedAt: new Date().toISOString(),
          stdout: `${prefix}.stdout.log`, stderr: `${prefix}.stderr.log`, report: `${prefix}.json` };
        index.blocks.push(block); save();
        process.stdout.write(`Ownership Linux ${phase} ${position + 1}/${protocol.order.length} ${label}\n`);
        const reportRoot = path.join(roots.B, 'reports/benchmarks');
        const previousNames = new Set(fs.readdirSync(reportRoot));
        const stdout = fs.openSync(path.join(outputRoot, block.stdout), 'wx');
        const stderr = fs.openSync(path.join(outputRoot, block.stderr), 'wx');
        let result;
        try {
          result = spawnSync('taskset', ['-c', cpuArgument, process.execPath, 'benchmarks/compare.cjs', protocol.workload], {
            cwd: roots.B, env: { ...process.env, RUSTDOM_BENCHMARK_PACKAGE: roots[treatment],
              RUSTDOM_BENCHMARK_SHARD_COUNT: '1', RUSTDOM_BENCHMARK_SHARD_INDEX: '0' }, stdio: ['ignore', stdout, stderr],
          });
        } finally { fs.closeSync(stdout); fs.closeSync(stderr); }
        Object.assign(block, { exitCode: result.status, signal: result.signal, error: result.error?.message ?? null,
          finishedAt: new Date().toISOString() });
        block.partialReports = archiveFailureReports(reportRoot, previousNames, outputRoot, prefix);
        for (const partial of block.partialReports) index.files[partial.archived] = partial.sha256;
        for (const name of [block.stdout, block.stderr]) index.files[name] = sha256(path.join(outputRoot, name));
        save();
        assert.equal(result.status, 0, `Inspect failed public benchmark ${block.stderr}`);
        const match = fs.readFileSync(path.join(outputRoot, block.stdout), 'utf8').match(/^Guardado: (.+)$/m);
        assert.ok(match, `Missing durable report for ${prefix}`);
        archive(block.report, path.resolve(roots.B, match[1].trim()));
        entries.push({ label, report: readJson(path.join(outputRoot, block.report)) });
        save();
      }
      index.summaries[phase] = summarize(entries, phase); save();
    }
    for (const label of ['A', 'B']) {
      assert.equal(captureSourceIdentity(roots[label]).sourceHash, sources[label].sourceHash);
      assert.equal(sha256(path.join(roots[label], 'dist/rustdom.node')), binaries[label]);
    }
    index.accepted = index.summaries.AA.every((row) => row.calibrated) && index.summaries.AB.every((row) => row.withinBudget);
    index.complete = true; index.finishedAt = new Date().toISOString(); save();
    const verified = verify(outputRoot);
    process.stdout.write(`${JSON.stringify(verified, null, 2)}\n`);
    if (!index.accepted) process.exitCode = 1;
  } catch (error) {
    index.complete = false; index.failure = { message: error.message, stack: error.stack }; save(); throw error;
  }
}

if (require.main === module) {
  if (process.argv[2] === '--verify') process.stdout.write(`${JSON.stringify(verify(path.resolve(process.argv[3])), null, 2)}\n`);
  else run(...process.argv.slice(2));
}
module.exports = { summarize, verify, archiveFailureReports };
