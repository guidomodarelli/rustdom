/** @file Runs both real package labels in one isolate using complete original public workload batches. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { getHeapStatistics } = require('node:v8');
const { createBenchmarkRunner } = require('../../../benchmarks/worker.cjs');
const { collectGarbage, captureMemoryState, isReleased } = require('../../../scripts/memory-endpoint.cjs');
const { loadRuntime } = require('./paired-worker.cjs');
const { proveSymmetricIsolation } = require('./balanced-worker.cjs');
const { configureAffinity, affinities } = require('./thread-worker.cjs');
const { fingerprint } = require('./paired-experiment.cjs');
const settings = require('./constants/paired-main.cjs');

/** Balance load and batch order independently; treatment B always remains the candidate in A/B. */
function schedule(manifest, phase, engine, position) {
  assert.ok(settings.phases.includes(phase), 'Paired main worker: unknown phase');
  assert.ok(settings.engines.includes(engine), 'Paired main worker: unknown engine');
  assert.ok(Number.isSafeInteger(position) && position >= 0 && position < settings.workerCount,
    'Paired main worker: position is outside the declared schedule');
  const reverseLoad = Boolean(position & 1);
  const reverseAssignment = Boolean(position & 2);
  const reverseBatches = Boolean(position & 4);
  let physical;
  if (engine === 'jsdom') physical = reverseAssignment ? ['J1', 'J0'] : ['J0', 'J1'];
  else if (phase === 'AA') physical = reverseAssignment ? ['A1', 'A0'] : ['A0', 'A1'];
  else physical = [reverseAssignment ? 'A1' : 'A0', 'B'];
  return { factors: { reverseLoad, reverseAssignment, reverseBatches },
    physical: { A: physical[0], B: physical[1] },
    roots: { A: manifest.copies[physical[0]], B: manifest.copies[physical[1]] },
    loadOrder: reverseLoad ? ['B', 'A'] : ['A', 'B'],
    batches: settings.rows.flatMap((key, rowIndex) => {
      const separator = key.lastIndexOf('/');
      const labels = Boolean(rowIndex % 2) !== reverseBatches ? ['B', 'A'] : ['A', 'B'];
      return labels.map((label) => ({ label, name: key.slice(0, separator), size: Number(key.slice(separator + 1)) }));
    }),
  };
}

/** Check complete executable packages against independently recorded pins, not manifest claims alone. */
function inspectDistributions(manifest, plan, engine) {
  return Object.fromEntries(['A', 'B'].map((label) => {
    const physical = plan.physical[label];
    const actual = fingerprint(plan.roots[label], engine === 'jsdom' ? ['lib', 'package.json'] : settings.distributionParts);
    assert.equal(actual.sha256, settings.distributionHashes[physical], `Paired main worker: changed ${physical} package`);
    assert.deepEqual(actual, manifest.distributions[physical], `Paired main worker: changed ${physical} manifest`);
    return [label, actual];
  }));
}

/** Always perform three rounds and require both runtime baselines in the final two, outside all timers. */
async function observeCleanup(groups, runtimes, baselines) {
  const trace = [];
  for (let round = 0; round < settings.cleanupRounds; round++) {
    await collectGarbage();
    trace.push(Object.fromEntries(['A', 'B'].map((label) => {
      const state = captureMemoryState(groups[label], runtimes[label].api);
      return [label, { ...state, clear: isReleased(state, baselines[label]) }];
    })));
  }
  return trace;
}

/** Persist partial evidence and preserve failed runs; this sampler cannot grant budget acceptance. */
async function main(manifestPath, phase, engine, positionText, output) {
  assert.equal(process.platform, 'linux', 'Paired main worker: Linux affinity evidence is required');
  assert.equal(typeof global.gc, 'function', 'Paired main worker: use --expose-gc');
  assert.ok(settings.nodeVersions.includes(process.version), 'Paired main worker: undeclared Node version');
  assert.equal(Object.hasOwn(process.env, 'NODE_OPTIONS'), false, 'Paired main worker: NODE_OPTIONS must be absent');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const position = Number(positionText);
  const plan = schedule(manifest, phase, engine, position);
  const report = { complete: false, gateReevaluated: false, revision: settings.revision, phase, engine, position,
    node: process.version, v8: process.versions.v8, execArgv: process.execArgv,
    heapLimitBytes: getHeapStatistics().heap_size_limit, schedule: plan, settings, batches: [] };
  fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
  const save = () => fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
  try {
    report.distributionsBefore = inspectDistributions(manifest, plan, engine); save();
    report.affinity = await configureAffinity('main');
    const runtimes = {};
    for (const label of plan.loadOrder) runtimes[label] = loadRuntime(plan.roots[label], engine);
    report.isolation = proveSymmetricIsolation(runtimes, plan.loadOrder);
    for (let round = 0; round < settings.cleanupRounds; round++) await collectGarbage();
    const baselines = Object.fromEntries(['A', 'B'].map((label) => [label, runtimes[label].api.getNativeTreeStatistics?.()]));
    report.nativeBaselines = baselines; save();
    const groups = { A: { window: [], document: [] }, B: { window: [], document: [] } };
    const runners = Object.fromEntries(['A', 'B'].map((label) => [label,
      createBenchmarkRunner({ engine, runtime: runtimes[label].api, trackRealms: true })]));
    for (const input of plan.batches) {
      const record = { ...input, complete: false };
      report.batches.push(record); save();
      const { realmReferences, ...measurement } = await runners[input.label].measureWorkload(input.name, input.size);
      Object.assign(record, measurement);
      for (const kind of ['window', 'document']) {
        assert.equal(realmReferences[kind].length, settings.warmupSamples + settings.measuredSamples);
        groups[input.label][kind].push(...realmReferences[kind]);
      }
      record.cleanupTrace = await observeCleanup(groups, runtimes, baselines); save();
      for (const endpoint of record.cleanupTrace.slice(-settings.requiredClearRounds)) {
        for (const label of ['A', 'B']) assert.equal(endpoint[label].clear, true,
          `Paired main worker: retained ${label} resources after ${input.label}/${input.name}/${input.size}`);
      }
      record.complete = true; save();
    }
    report.distributionsAfter = inspectDistributions(manifest, plan, engine);
    report.affinitiesAfter = affinities();
    assert.equal(report.affinitiesAfter.find((entry) => entry.tid === process.pid).mask, String(settings.cpu));
    assert.ok(report.affinitiesAfter.some((entry) => entry.tid !== process.pid && !entry.disappeared && entry.mask !== String(settings.cpu)));
    report.complete = true; save();
  } catch (error) { report.failure = { message: error.message, stack: error.stack }; save(); throw error; }
}

if (require.main === module) main(...process.argv.slice(2)).catch((error) => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
module.exports = { schedule, inspectDistributions, observeCleanup, main };
