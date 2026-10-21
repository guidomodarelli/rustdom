/** @file Runs and independently recalculates the full public ownership comparison on both supported Node versions. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const settings = require('./constants/main-affinity.cjs');
const original = require('./constants/hosted.cjs');
const { fingerprint } = require('./paired-experiment.cjs');
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const sha256 = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');

/**
 * Read all executed package bytes, including the compiled JavaScript and native addon.
 * @param {{ A: string, B: string }} roots - Actual frozen runtime package roots.
 * @returns {object} Complete file manifests and their canonical digests for both runtimes.
 */
function captureDistributions(roots) {
  return Object.fromEntries(Object.entries(roots).map(([label, root]) =>
    [label, fingerprint(root, settings.distributionParts)]));
}

/**
 * Verify a complete manifest against independent historical evidence and any earlier snapshot.
 * @param {object} distributions - Complete A/B manifests, captured from disk or read from an archive.
 * @param {string} stage - Diagnostic location: before, after or archive.
 * @param {object} [previous] - Initial manifests when checking the final identity.
 */
function validateDistributions(distributions, stage, previous) {
  for (const label of ['A', 'B']) {
    const distribution = distributions?.[label];
    assert.ok(distribution, `MainAffinity:${stage} missing distribution manifest for ${label}`);
    assert.ok(Array.isArray(distribution.files), `MainAffinity:${stage} incomplete distribution manifest for ${label}`);
    const digest = createHash('sha256').update(JSON.stringify(distribution.files)).digest('hex');
    assert.equal(digest, distribution.sha256, `MainAffinity:${stage} distribution manifest differs for ${label}`);
    assert.equal(distribution.sha256, settings.distributionHashes[label],
      `MainAffinity:${stage} distribution identity differs for ${label}`);
  }
  if (previous) assert.deepEqual(distributions, previous, `MainAffinity:${stage} distributions changed after preflight`);
}

/** Keep every observation when calculating pooled and process medians. */
function median(values) {
  assert.ok(values.length > 0 && values.every((value) => Number.isFinite(value) && value > 0));
  const ordered = [...values].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
}

/** Reject missing/reordered rows and observe that background threads retain broader CPU masks. */
function validateWorker(report, metadata, expected) {
  assert.equal(metadata.complete, true); assert.equal(metadata.exitCode, 0);
  assert.equal(metadata.pid, expected.pid); assert.equal(metadata.node, expected.node);
  assert.equal(metadata.engine, expected.engine); assert.equal(report.engine, expected.engine);
  assert.equal(metadata.harnessRoot, expected.harnessRoot); assert.equal(metadata.runtimeRoot, expected.runtimeRoot);
  assert.deepEqual(metadata.settings, settings); assert.deepEqual(metadata.execArgv, ['--expose-gc']);
  assert.equal(metadata.nodeOptionsPresent, false);
  for (const stage of ['initial', 'configured', 'final']) {
    const threads = metadata.affinity[stage];
    const main = threads.find((entry) => entry.tid === metadata.pid);
    assert.ok(main && !main.disappeared);
    if (stage === 'initial') assert.notEqual(main.mask, String(settings.cpu));
    else assert.equal(main.mask, String(settings.cpu));
    assert.ok(threads.some((entry) => entry.tid !== metadata.pid && !entry.disappeared && entry.mask !== String(settings.cpu)));
  }
  for (const initial of metadata.affinity.initial.filter((entry) => entry.tid !== metadata.pid && !entry.disappeared)) {
    const configured = metadata.affinity.configured.find((entry) => entry.tid === initial.tid);
    if (configured && !configured.disappeared) assert.equal(configured.mask, initial.mask);
  }
  assert.equal(report.warmupSamples, settings.warmupSamples);
  assert.equal(report.measuredSamples, settings.measuredSamples);
  assert.deepEqual(report.workloads.map((row) => `${row.name}/${row.rows}`).sort(), settings.rows);
  for (const row of report.workloads) {
    assert.equal(row.samplesMs.length, settings.measuredSamples); median(row.samplesMs);
    assert.match(row.outputHash, /^[0-9a-f]{64}$/);
    assert.equal(row.memoryAfterCleanup.length, settings.measuredSamples);
  }
  if (expected.engine === 'rustdom') {
    assert.ok(report.parserStatistics.nativeDocument > 0);
    assert.ok(report.nativeTreeStatistics.mutations > 0);
  }
}

/** Calculate the original per-row ±2% control and 5% Rust budgets without removing samples. */
function summarize(entries, phase) {
  const schedule = settings.order.flatMap((label, position) => settings.engines.map((engine, slot) => ({ label, position, engine, slot })));
  assert.deepEqual(entries.map(({ label, position, engine, slot }) => ({ label, position, engine, slot })), schedule);
  return settings.rows.map((key) => {
    const row = { key }; const hashes = new Set();
    for (const label of ['A', 'B']) {
      row[label] = {};
      for (const engine of ['jsdom', 'rustdom']) {
        const observations = entries.filter((entry) => entry.label === label && entry.engine === engine)
          .map((entry) => entry.observation.workloads.find((workload) => `${workload.name}/${workload.rows}` === key));
        const samples = observations.flatMap((observation) => { hashes.add(observation.outputHash); return observation.samplesMs; });
        assert.equal(samples.length, settings.samplesPerLabelEngine);
        row[label][engine] = { count: samples.length, medianMs: median(samples),
          processMediansMs: observations.map((observation) => median(observation.samplesMs)) };
      }
    }
    assert.equal(hashes.size, 1, `Public output mismatch: ${key}`);
    row.outputHash = [...hashes][0];
    row.rustdomChangePercent = (row.B.rustdom.medianMs / row.A.rustdom.medianMs - 1) * 100;
    row.jsdomControlChangePercent = (row.B.jsdom.medianMs / row.A.jsdom.medianMs - 1) * 100;
    row.calibrated = Math.abs(row.jsdomControlChangePercent) <= settings.controlBudgetPercent &&
      (phase === 'AB' || Math.abs(row.rustdomChangePercent) <= settings.rustBudgetPercent);
    row.withinBudget = row.calibrated && row.rustdomChangePercent <= settings.rustBudgetPercent;
    return row;
  });
}

/** Verify real archived stdout, affinity sidecars, source snapshots and every aggregate without running workloads. */
function verify(outputRoot) {
  const index = readJson(path.join(outputRoot, 'index.json'));
  assert.equal(index.complete, true); assert.deepEqual(index.settings, settings);
  assert.ok(settings.nodeVersions.includes(index.node));
  assert.deepEqual(index.binaries, settings.binaryHashes);
  validateDistributions(index.distributions, 'archive');
  validateDistributions(index.distributionsAfter, 'archive-after', index.distributions);
  for (const label of ['A', 'B']) assert.equal(index.sources[label].sourceHash, original.sourceHashes[label]);
  const expectedFiles = [
    ...settings.methodFiles.map((file) => `method/${file.replaceAll('../', 'parent/').replaceAll('/', '-')}`),
    ...index.runs.flatMap((entry) => [entry.stdout, entry.stderr, entry.metadata]),
  ];
  assert.deepEqual(Object.keys(index.files).sort(), expectedFiles.sort());
  for (const [file, hash] of Object.entries(index.files)) assert.equal(sha256(path.join(outputRoot, file)), hash, `Archive changed: ${file}`);
  for (const file of settings.methodFiles) assert.ok(index.files[`method/${file.replaceAll('../', 'parent/').replaceAll('/', '-')}`]);
  const summaries = {};
  for (const phase of settings.phases) {
    const entries = index.runs.filter((entry) => entry.phase === phase).map((entry) => {
      assert.equal(entry.exitCode, 0); assert.equal(entry.signal, null); assert.equal(entry.error, null);
      const treatment = phase === 'AB' && entry.label === 'B' ? 'B' : 'A';
      assert.equal(entry.treatment, treatment);
      const observation = readJson(path.join(outputRoot, entry.stdout));
      const metadata = readJson(path.join(outputRoot, entry.metadata));
      validateWorker(observation, metadata, { pid: entry.pid, node: index.node, engine: entry.engine,
        harnessRoot: index.roots.B, runtimeRoot: index.roots[treatment] });
      return { ...entry, observation };
    });
    summaries[phase] = summarize(entries, phase);
  }
  assert.equal(index.runs.length, settings.phases.length * settings.order.length * settings.engines.length);
  assert.deepEqual(index.summaries, summaries);
  assert.deepEqual(summaries.AA.map((row) => row.outputHash), summaries.AB.map((row) => row.outputHash));
  const accepted = summaries.AA.every((row) => row.calibrated) && summaries.AB.every((row) => row.withinBudget);
  assert.equal(index.accepted, accepted);
  return { verified: true, node: index.node, processes: index.runs.length,
    measuredDurations: index.runs.length * settings.rows.length * settings.measuredSamples, accepted, summaries };
}

/** Reserve a new output directory before any work; never overwrite completed or partial evidence. */
function run(candidateArgument, baselineArgument, outputArgument) {
  assert.equal(process.platform, 'linux'); assert.ok(settings.nodeVersions.includes(process.version));
  assert.equal(Object.hasOwn(process.env, 'NODE_OPTIONS'), false);
  const outputRoot = path.resolve(outputArgument);
  fs.mkdirSync(path.dirname(outputRoot), { recursive: true }); fs.mkdirSync(outputRoot);
  const roots = { A: path.resolve(baselineArgument), B: path.resolve(candidateArgument) };
  const { captureSourceIdentity } = require(path.join(roots.B, 'benchmarks/sources.cjs'));
  const sources = Object.fromEntries(Object.entries(roots).map(([label, root]) => [label, captureSourceIdentity(root)]));
  for (const label of ['A', 'B']) assert.equal(sources[label].sourceHash, original.sourceHashes[label]);
  const binaries = Object.fromEntries(Object.entries(roots).map(([label, root]) => [label, sha256(path.join(root, 'dist/rustdom.node'))]));
  assert.deepEqual(binaries, settings.binaryHashes);
  const distributions = captureDistributions(roots);
  const referenceRoot = path.dirname(require.resolve('jsdom/package.json', { paths: [roots.B] }));
  assert.equal(readJson(path.join(referenceRoot, 'package.json')).version, '27.4.0');
  const reference = fingerprint(referenceRoot, ['lib', 'package.json']);
  const index = { complete: false, startedAt: new Date().toISOString(), settings, roots, sources, binaries, distributions,
    node: process.version, v8: process.versions.v8, executable: process.execPath, referenceRoot, reference,
    machine: { platform: os.platform(), arch: os.arch(), release: os.release(), cpu: os.cpus()[0].model,
      logicalCpus: os.cpus().length, totalMemoryBytes: os.totalmem() }, runs: [], files: {}, summaries: {} };
  const save = () => fs.writeFileSync(path.join(outputRoot, 'index.json'), JSON.stringify(index, null, 2) + '\n');
  fs.mkdirSync(path.join(outputRoot, 'method'));
  for (const file of settings.methodFiles) {
    const target = `method/${file.replaceAll('../', 'parent/').replaceAll('/', '-')}`;
    fs.copyFileSync(path.join(__dirname, file), path.join(outputRoot, target)); index.files[target] = sha256(path.join(outputRoot, target));
  }
  save();
  try {
    validateDistributions(distributions, 'before');
    for (const phase of settings.phases) {
      const entries = [];
      for (const [position, label] of settings.order.entries()) {
        const treatment = phase === 'AB' && label === 'B' ? 'B' : 'A';
        for (const [slot, engine] of settings.engines.entries()) {
          const prefix = `${phase}-${position}-${label}-${slot}-${engine}`;
          const entry = { phase, position, label, treatment, slot, engine, stdout: `${prefix}.stdout.json`,
            stderr: `${prefix}.stderr.log`, metadata: `${prefix}.affinity.json` };
          index.runs.push(entry); save();
          process.stdout.write(`Main affinity ${process.version} ${phase} ${position + 1}/8 ${slot + 1}/4 ${engine}\n`);
          const stdout = fs.openSync(path.join(outputRoot, entry.stdout), 'wx');
          const stderr = fs.openSync(path.join(outputRoot, entry.stderr), 'wx');
          let result;
          try {
            result = spawnSync(process.execPath, ['--expose-gc', path.join(__dirname, 'main-affinity-worker.cjs'),
              roots.B, roots[treatment], engine, path.join(outputRoot, entry.metadata)], {
              cwd: roots.B, stdio: ['ignore', stdout, stderr], timeout: settings.workerTimeoutMs });
          } finally { fs.closeSync(stdout); fs.closeSync(stderr); }
          Object.assign(entry, { exitCode: result.status, signal: result.signal, error: result.error?.message ?? null, pid: result.pid });
          for (const file of [entry.stdout, entry.stderr, entry.metadata]) {
            if (fs.existsSync(path.join(outputRoot, file))) index.files[file] = sha256(path.join(outputRoot, file));
          }
          save(); assert.equal(result.status, 0, `Inspect failed worker: ${entry.stderr}`);
          const observation = readJson(path.join(outputRoot, entry.stdout));
          validateWorker(observation, readJson(path.join(outputRoot, entry.metadata)), { pid: result.pid,
            node: process.version, engine, harnessRoot: roots.B, runtimeRoot: roots[treatment] });
          entries.push({ ...entry, observation });
        }
      }
      index.summaries[phase] = summarize(entries, phase); save();
    }
    for (const label of ['A', 'B']) {
      assert.equal(captureSourceIdentity(roots[label]).sourceHash, sources[label].sourceHash);
      assert.equal(sha256(path.join(roots[label], 'dist/rustdom.node')), binaries[label]);
    }
    index.distributionsAfter = captureDistributions(roots); save();
    validateDistributions(index.distributionsAfter, 'after', distributions);
    assert.deepEqual(fingerprint(referenceRoot, ['lib', 'package.json']), reference);
    assert.deepEqual(index.summaries.AA.map((row) => row.outputHash), index.summaries.AB.map((row) => row.outputHash));
    for (const file of settings.methodFiles) {
      const target = `method/${file.replaceAll('../', 'parent/').replaceAll('/', '-')}`;
      assert.equal(sha256(path.join(__dirname, file)), index.files[target]);
    }
    index.accepted = index.summaries.AA.every((row) => row.calibrated) && index.summaries.AB.every((row) => row.withinBudget);
    index.complete = true; index.finishedAt = new Date().toISOString(); save();
    process.stdout.write(JSON.stringify(verify(outputRoot), null, 2) + '\n');
    if (!index.accepted) process.exitCode = 1;
  } catch (error) { index.complete = false; index.failure = { message: error.message, stack: error.stack }; save(); throw error; }
}

if (require.main === module) {
  if (process.argv[2] === '--verify') process.stdout.write(JSON.stringify(verify(path.resolve(process.argv[3])), null, 2) + '\n');
  else run(...process.argv.slice(2));
}
module.exports = { captureDistributions, validateDistributions, median, validateWorker, summarize, verify, run };
