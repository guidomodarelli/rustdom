/** @file Compares shared versus independent copies of the unchanged workload module on jsdom A/A. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { performance } = require('node:perf_hooks');
const { fingerprint } = require('./paired-experiment.cjs');
const { schedule, inspectDistributions, observeCleanup } = require('./paired-main-worker.cjs');
const { loadRuntime } = require('./paired-worker.cjs');
const { proveSymmetricIsolation } = require('./balanced-worker.cjs');
const { configureAffinity, affinities } = require('./thread-worker.cjs');
const { collectGarbage } = require('../../../scripts/memory-endpoint.cjs');
const original = require('./constants/paired-inline.cjs');
const settings = require('./constants/runner-sharing.cjs');

/**
 * Retain the original row's physical assignment and order among the eight rows.
 * @param {object} manifest - Independently prepared runtime copies and distributions.
 * @param {string} mode - Declared harness-sharing arm.
 * @param {number} position - Balanced position from zero through seven.
 * @returns {object} Original schedule restricted to the diagnostic row.
 * @throws {AssertionError} When mode or position falls outside the declared design.
 */
function diagnosticSchedule(manifest, mode, position) {
  assert.ok(settings.modes.includes(mode), 'Runner sharing: unknown diagnostic mode');
  const plan = schedule(manifest, settings.phase, settings.engine, position, original);
  return { ...plan, batches: plan.batches.filter(({ name, size }) =>
    name === settings.workload.name && size === settings.workload.size) };
}

/**
 * Verify both harness copies even when the shared arm loads only the first.
 * @param {Record<string,string>} roots - Absolute harness roots for labels A and B.
 * @returns {object} File manifests and recalculated SHA256 identities.
 * @throws {AssertionError} When either copy differs from the pinned sources.
 */
function inspectRunners(roots) {
  return Object.fromEntries(settings.labels.map((label) => {
    const identity = fingerprint(roots[label], settings.runnerParts);
    assert.equal(identity.sha256, settings.runnerSha256, `Runner sharing: changed ${label} harness`);
    return [label, identity];
  }));
}

/**
 * Write scalar markers beside V8 traces, bracketing batches rather than samples.
 * @param {string} event - Diagnostic stage from the configured event vocabulary.
 * @param {string} label - Runtime label whose batch is executing.
 * @returns {void} Writes one JSON line outside the measured operation.
 */
function marker(event, label) {
  process.stdout.write(`${JSON.stringify({ diagnosticEvent: event, label, uptimeMs: performance.now() })}\n`);
}

/**
 * Exercise full public batches and preserve partial results without accepting a budget.
 * @param {string} inputPath - JSON file with mode, position, runtime manifest and harness roots.
 * @param {string} output - New JSON report path; existing reports are never overwritten initially.
 * @returns {Promise<void>} Resolves after both batches and resource endpoints are verified.
 * @throws {Error} When execution, identities, public results or resource checks fail.
 */
async function main(inputPath, output) {
  assert.equal(process.platform, 'linux', 'Runner sharing: Linux affinity is required');
  assert.ok(settings.nodeVersions.includes(process.version), 'Runner sharing: undeclared Node version');
  assert.deepEqual(process.execArgv, settings.flags, 'Runner sharing: unexpected instrumentation flags');
  assert.equal(Object.hasOwn(process.env, 'NODE_OPTIONS'), false, 'Runner sharing: NODE_OPTIONS must be absent');
  const input = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const { mode, position, manifest, runnerRoots } = input;
  const plan = diagnosticSchedule(manifest, mode, position);
  const report = { revision: settings.revision, complete: false, gateReevaluated: false,
    mode, position, pid: process.pid, node: process.version, v8: process.versions.v8,
    execArgv: process.execArgv, schedule: plan, runnerRoots, batches: [] };
  fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
  const save = () => fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
  try {
    report.runnersBefore = inspectRunners(runnerRoots);
    report.distributionsBefore = inspectDistributions(manifest, plan, settings.engine, original);
    report.affinity = await configureAffinity('main');
    const runtimes = {};
    for (const label of plan.loadOrder) runtimes[label] = loadRuntime(plan.roots[label], settings.engine);
    report.isolation = proveSymmetricIsolation(runtimes, plan.loadOrder);
    const factories = Object.fromEntries(settings.labels.map((label) => [label,
      require(path.join(runnerRoots[mode === settings.sharedMode ? settings.labels[0] : label], settings.files.workloadEntry)).createBenchmarkRunner]));
    report.factoryShared = factories.A === factories.B;
    assert.equal(report.factoryShared, mode === settings.sharedMode, 'Runner sharing: module isolation did not match the arm');
    for (let round = 0; round < original.cleanupRounds; round++) await collectGarbage();
    const baselines = { A: undefined, B: undefined };
    const groups = { A: { window: [], document: [] }, B: { window: [], document: [] } };
    const runners = Object.fromEntries(settings.labels.map((label) => [label,
      factories[label]({ engine: settings.engine, runtime: runtimes[label].api, trackRealms: true })]));
    save();
    for (const batch of plan.batches) {
      const record = { ...batch, complete: false };
      report.batches.push(record); save(); marker(settings.events.start, batch.label);
      const { realmReferences, ...measurement } = await runners[batch.label].measureWorkload(batch.name, batch.size);
      marker(settings.events.returned, batch.label);
      Object.assign(record, measurement);
      for (const kind of ['window', 'document']) {
        assert.equal(realmReferences[kind].length, original.warmupSamples + original.measuredSamples);
        groups[batch.label][kind].push(...realmReferences[kind]);
      }
      record.cleanupTrace = await observeCleanup(groups, runtimes, baselines, original);
      for (const endpoint of record.cleanupTrace.slice(-original.requiredClearRounds)) {
        for (const label of settings.labels) assert.equal(endpoint[label].clear, true,
          `Runner sharing: retained ${label} resources after ${batch.label}`);
      }
      record.complete = true; save(); marker(settings.events.end, batch.label);
    }
    assert.equal(report.batches[0].outputHash, report.batches[1].outputHash, 'Runner sharing: public results differ');
    report.runnersAfter = inspectRunners(runnerRoots);
    report.distributionsAfter = inspectDistributions(manifest, plan, settings.engine, original);
    report.affinitiesAfter = affinities();
    assert.equal(report.affinitiesAfter.find((entry) => entry.tid === process.pid).mask, String(original.cpu));
    report.complete = true; save();
  } catch (error) {
    report.failure = { message: error.message, stack: error.stack }; save(); throw error;
  }
}

if (require.main === module) main(...process.argv.slice(2)).catch((error) => {
  process.stderr.write(`${error.stack}\n`); process.exitCode = 1;
});
module.exports = { diagnosticSchedule, inspectRunners, main };
