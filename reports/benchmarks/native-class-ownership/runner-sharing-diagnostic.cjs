/** @file Freezes source copies and runs one fixed diagnostic sequence, without granting performance acceptance. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { createPairedStudy } = require('./paired-main-experiment.cjs');
const { fingerprint } = require('./paired-experiment.cjs');
const { isReleased } = require('../../../scripts/memory-endpoint.cjs');
const { diagnosticSchedule, inspectRunners } = require('./runner-sharing-worker.cjs');
const original = require('./constants/paired-inline.cjs');
const settings = require('./constants/runner-sharing.cjs');
const root = path.resolve(__dirname, '../../..');
const harness = createPairedStudy({ method: settings });
const readJson = (filename) => JSON.parse(fs.readFileSync(filename, 'utf8'));

/**
 * Balance mode order within each package-assignment, load-order and batch-order factor.
 * @returns {object[]} Fixed 16-process schedule for one Node version.
 */
function processSchedule() {
  return Array.from({ length: settings.positions }, (_, position) => {
    // Factor parity gives each mode two leading positions within either value of every scheduling bit.
    const reverseModes = (position ^ (position >> 1) ^ (position >> 2)) & 1;
    return (reverseModes ? [...settings.modes].reverse() : settings.modes).map((mode) => ({ mode, position }));
  }).flat();
}

/**
 * Copy the actual harness twice while retaining original source bytes and relative paths.
 * @param {string} source - Source repository with the pinned benchmarks and DOM file reader.
 * @param {string} directory - New directory for separate A/B module trees.
 * @returns {Record<string,string>} Absolute roots for the two harness copies.
 * @throws {Error} When identity differs or a destination file already exists.
 */
function prepareRunners(source, directory) {
  directory = path.resolve(directory);
  const identity = fingerprint(source, settings.runnerParts);
  assert.equal(identity.sha256, settings.runnerSha256, 'Runner sharing: source harness differs from the frozen scope');
  const roots = {};
  for (const label of settings.labels) {
    roots[label] = path.join(directory, label);
    fs.mkdirSync(roots[label], { recursive: true });
    for (const part of settings.runnerParts) {
      const target = path.join(roots[label], part);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.cpSync(path.join(source, part), target, { recursive: true, errorOnExist: true, force: false });
    }
  }
  inspectRunners(roots);
  return roots;
}

/**
 * Recompute identities, public outcomes and weak target endpoints from a completed report.
 * @param {object} report - Scalar worker observations, without strong DOM references.
 * @param {object} input - Exact mode, position, package manifest and harness roots sent to the child.
 * @returns {void} Returns only when all diagnostic contracts hold.
 * @throws {AssertionError} When evidence is incomplete, altered or falsely reports collection.
 */
function validateWorker(report, input) {
  assert.equal(report.complete, true); assert.equal(report.gateReevaluated, false);
  assert.equal(report.revision, settings.revision);
  assert.equal(report.mode, input.mode); assert.equal(report.position, input.position);
  assert.equal(report.factoryShared, input.mode === settings.sharedMode);
  assert.ok(settings.nodeVersions.includes(report.node));
  assert.deepEqual(report.execArgv, settings.flags);
  assert.deepEqual(report.schedule, diagnosticSchedule(input.manifest, input.mode, input.position));
  assert.deepEqual(report.runnerRoots, input.runnerRoots);
  assert.deepEqual(report.runnersBefore, report.runnersAfter);
  for (const label of settings.labels) {
    assert.deepEqual(report.runnersBefore[label], fingerprint(input.runnerRoots[label], settings.runnerParts));
    assert.equal(report.runnersBefore[label].sha256, settings.runnerSha256);
    const physical = report.schedule.physical[label];
    assert.deepEqual(report.distributionsBefore[label], input.manifest.distributions[physical]);
    assert.equal(report.distributionsBefore[label].sha256, original.distributionHashes[physical]);
  }
  assert.deepEqual(report.distributionsBefore, report.distributionsAfter);
  assert.equal(report.batches.length, settings.labels.length);
  for (const [index, batch] of report.batches.entries()) {
    const expected = report.schedule.batches[index];
    for (const key of ['label', 'name', 'size']) assert.equal(batch[key], expected[key]);
    assert.equal(batch.complete, true); assert.equal(batch.rows, expected.size);
    assert.equal(batch.samplesMs.length, original.measuredSamples);
    assert.ok(batch.samplesMs.every((duration) => Number.isFinite(duration) && duration > 0));
    assert.equal(batch.memoryAfterCleanup.length, original.measuredSamples);
    assert.equal(batch.cleanupTrace.length, original.cleanupRounds);
    for (const [round, endpoint] of batch.cleanupTrace.entries()) for (const label of settings.labels) {
      assert.equal(endpoint[label].clear, isReleased(endpoint[label], undefined), 'Runner sharing: falsely clear endpoint');
      if (round >= original.cleanupRounds - original.requiredClearRounds) assert.equal(endpoint[label].clear, true);
    }
    assert.match(batch.outputHash, settings.digestPattern);
  }
  assert.equal(report.batches[0].outputHash, report.batches[1].outputHash);
  for (const stage of [report.affinity.configured, report.affinitiesAfter]) {
    assert.equal(stage.find((entry) => entry.tid === report.pid).mask, String(original.cpu));
    assert.ok(stage.some((entry) => entry.tid !== report.pid && !entry.disappeared && entry.mask !== String(original.cpu)));
  }
}

/**
 * Preserve stdout/stderr and partial reports when a child or its assertions fail.
 * @param {object} input - Frozen worker configuration and actual package locations.
 * @param {string} prefix - New artifact filename prefix, outside previous evidence.
 * @returns {object} Verified completed worker report.
 * @throws {Error} When a process fails, times out or produces invalid evidence.
 */
function runWorker(input, prefix) {
  const inputPath = `${prefix}.input.json`;
  const output = `${prefix}.json`;
  fs.writeFileSync(inputPath, `${JSON.stringify(input, null, 2)}\n`, { flag: 'wx' });
  const stdout = fs.openSync(`${prefix}.stdout.log`, 'wx');
  const stderr = fs.openSync(`${prefix}.stderr.log`, 'wx');
  let child;
  try {
    child = spawnSync(process.execPath, [...settings.flags, path.join(__dirname, settings.files.worker), inputPath, output],
      { stdio: ['ignore', stdout, stderr], timeout: settings.workerTimeoutMs });
  } finally { fs.closeSync(stdout); fs.closeSync(stderr); }
  const outcome = { status: child.status, signal: child.signal, error: child.error?.message ?? null, pid: child.pid };
  fs.writeFileSync(`${prefix}.process.json`, `${JSON.stringify(outcome, null, 2)}\n`, { flag: 'wx' });
  assert.equal(child.status, 0, `Runner sharing: worker failed; preserve ${prefix} logs`);
  const report = readJson(output);
  assert.equal(report.pid, child.pid);
  assert.equal(report.node, process.version);
  validateWorker(report, input);
  return report;
}

/**
 * Run the fixed sequence after its recipe is published and locally reviewed.
 * @param {string} manifestPath - Independent jsdom package locations and their recorded identities.
 * @param {string} output - New output directory retaining source copies, reports and all process logs.
 * @param {string} provenancePath - Published SHA, reviewed harness hash and review receipt description.
 * @returns {void} Records a complete diagnostic, never a performance acceptance decision.
 * @throws {Error} When preflight, execution or verification fails; partial evidence is retained.
 */
function run(manifestPath, output, provenancePath) {
  output = path.resolve(output);
  assert.equal(process.platform, 'linux');
  assert.ok(settings.nodeVersions.includes(process.version));
  assert.equal(Object.hasOwn(process.env, 'NODE_OPTIONS'), false);
  const identity = harness.captureHarness(root);
  const provenance = readJson(provenancePath);
  assert.equal(identity.identity.sourceHash, settings.sourceHash);
  assert.equal(provenance.harnessSha256, identity.sha256, 'Runner sharing: harness differs from the reviewed source');
  assert.match(provenance.reviewedCommit, settings.commitPattern);
  assert.equal(typeof provenance.reviewReceipt, 'string'); assert.ok(provenance.reviewReceipt.length > 0);
  fs.mkdirSync(output);
  const index = { revision: settings.revision, complete: false, gateReevaluated: false,
    node: process.version, settings, provenance, harness: identity, runs: [] };
  const save = () => fs.writeFileSync(path.join(output, settings.files.index), `${JSON.stringify(index, null, 2)}\n`);
  save();
  try {
    const manifest = readJson(manifestPath);
    const runnerRoots = prepareRunners(root, path.join(output, settings.files.runners));
    for (const entry of identity.files) {
      const destination = path.join(output, settings.files.harness, entry.path);
      fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.copyFileSync(path.join(root, entry.path), destination);
    }
    let expectedOutput;
    for (const trial of processSchedule()) {
      const prefix = path.join(output, `${trial.mode}-${trial.position}`);
      index.runs.push({ ...trial, prefix: path.basename(prefix), complete: false }); save();
      const report = runWorker({ ...trial, manifest, runnerRoots }, prefix);
      expectedOutput ??= report.batches[0].outputHash;
      assert.equal(report.batches[0].outputHash, expectedOutput, 'Runner sharing: public output differs across diagnostic processes');
      index.runs.at(-1).complete = true; save();
    }
    assert.deepEqual(harness.captureHarness(root), identity, 'Runner sharing: source changed during the sequence');
    index.complete = true; save();
  } catch (error) { index.failure = { message: error.message, stack: error.stack }; save(); throw error; }
}

if (require.main === module) {
  try { run(...process.argv.slice(2)); }
  catch (error) { process.stderr.write(`${error.stack}\n`); process.exitCode = 2; }
}
module.exports = { prepareRunners, processSchedule, validateWorker, runWorker, run, captureHarness: harness.captureHarness };
