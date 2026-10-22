/** @file Exercises all public workloads with exactly one physical package loaded per process. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { getHeapStatistics } = require('node:v8');
const { createBenchmarkRunner } = require('../../../benchmarks/worker.cjs');
const { collectGarbage, captureMemoryState, isReleased } = require('../../../scripts/memory-endpoint.cjs');
const { loadRuntime } = require('./paired-worker.cjs');
const { schedule: pairedSchedule, inspectDistributions } = require('./paired-main-worker.cjs');
const { configureAffinity, affinities } = require('./thread-worker.cjs');
const defaultSettings = require('./constants/single-package.cjs');

/**
 * Bind a declared schedule while retaining the original public sampler and legacy defaults.
 * @param {object} settings - Immutable workload, package, resource and scheduling configuration.
 * @returns {object} Worker functions bound to that configuration.
 */
function createSinglePackageWorker(settings = defaultSettings) {
  /**
   * Declare startup entropy only for an explicit seeded method; legacy flags remain unchanged.
   * @param {number} position - Prospectively declared position, shared by both engines and treatments.
   * @returns {string[]} Actual Node startup flags, before loading a physical runtime.
   * @throws {Error} When the declared position has no positive seed or finite probe configuration.
   */
  function workerArguments(position) {
    if (settings.v8Seeds === undefined) return ['--expose-gc'];
    assert.ok(Array.isArray(settings.v8Seeds) && settings.v8Seeds.length === settings.workerCount,
      `Single package: V8 seeds must cover all ${settings.workerCount} declared positions`);
    const seed = settings.v8Seeds[position];
    assert.ok(Number.isSafeInteger(seed) && seed > 0, `Single package: invalid V8 seed at position=${position}: ${seed}`);
    assert.ok(Number.isSafeInteger(settings.v8SeedProbeSamples) && settings.v8SeedProbeSamples > 0,
      `Single package: invalid RNG probe sample count=${settings.v8SeedProbeSamples} at position=${position}`);
    return ['--expose-gc', `--random-seed=${seed}`, `--hash-seed=${seed}`];
  }

  /** Resolve one fixed treatment, balancing pair order, physical baseline and row order independently. */
  function schedule(manifest, phase, engine, position, label) {
    assert.ok(settings.labels.includes(label), 'Single package: unknown treatment label');
    const pair = pairedSchedule(manifest, phase, engine, position, settings);
    const rows = pair.factors.reverseBatches ? [...settings.rows].reverse() : settings.rows;
    const factors = { reversePair: pair.factors.reverseLoad, reverseAssignment: pair.factors.reverseAssignment,
      reverseRows: pair.factors.reverseBatches };
    if (settings.engineLeadMask !== undefined) factors.reverseEngines = Boolean(position & settings.engineLeadMask);
    return { label, physical: pair.physical[label], root: pair.roots[label], factors,
      rows: rows.map((key) => {
        const separator = key.lastIndexOf('/');
        return { name: key.slice(0, separator), size: Number(key.slice(separator + 1)) };
      }) };
  }

  /** Record actual package modules without loading any unselected copy or changing the module cache. */
  function loadedPackages(manifest) {
    const filenames = Object.keys(require.cache).map((filename) => fs.realpathSync(filename));
    return Object.fromEntries(Object.entries(manifest.copies).map(([physical, directory]) => {
      const root = fs.realpathSync(directory);
      return [physical, filenames.filter((filename) => filename.startsWith(`${root}${path.sep}`))];
    }));
  }

  /** Observe Window, Document and native baselines in the same fixed three rounds as the prior sampler. */
  async function observeCleanup(groups, runtime, baseline) {
    const trace = [];
    for (let round = 0; round < settings.cleanupRounds; round++) {
      await collectGarbage();
      const state = captureMemoryState(groups, runtime.api);
      trace.push({ ...state, clear: isReleased(state, baseline) });
    }
    return trace;
  }

  /** Retain partial output on every failure; these workers never decide performance acceptance. */
  async function main(manifestPath, phase, engine, positionText, label, output) {
    assert.equal(process.platform, 'linux', 'Single package: Linux affinity evidence is required');
    assert.equal(typeof global.gc, 'function', 'Single package: use --expose-gc');
    assert.ok(settings.nodeVersions.includes(process.version), 'Single package: undeclared Node version');
    assert.equal(Object.hasOwn(process.env, 'NODE_OPTIONS'), false, 'Single package: NODE_OPTIONS must be absent');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const position = Number(positionText);
    if (settings.v8Seeds !== undefined) assert.deepEqual(process.execArgv, workerArguments(position),
      'Single package: process flags differ from the declared V8 seed');
    const plan = schedule(manifest, phase, engine, position, label);
    const report = { complete: false, gateReevaluated: false, revision: settings.revision, settings,
      phase, engine, position, label, node: process.version, v8: process.versions.v8,
      execArgv: process.execArgv, pid: process.pid, heapLimitBytes: getHeapStatistics().heap_size_limit,
      schedule: plan, batches: [] };
    if (settings.v8Seeds !== undefined) {
      report.v8Seed = settings.v8Seeds[position];
      report.randomProbe = Array.from({ length: settings.v8SeedProbeSamples }, () => Math.random());
    }
    fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
    const save = () => fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
    const checkLoaded = () => {
      const packages = loadedPackages(manifest);
      for (const [physical, filenames] of Object.entries(packages)) {
        assert.equal(filenames.length > 0, physical === plan.physical,
          `Single package: unexpected loaded package ${physical}`);
      }
      return packages;
    };
    try {
      const pair = pairedSchedule(manifest, phase, engine, position, settings);
      report.distributionsBefore = inspectDistributions(manifest, pair, engine, settings); save();
      report.affinity = await configureAffinity('main');
      assert.ok(Object.values(loadedPackages(manifest)).every((filenames) => filenames.length === 0),
        'Single package: a runtime was already loaded');
      const runtime = loadRuntime(plan.root, engine);
      report.loadedBefore = checkLoaded();
      for (let round = 0; round < settings.cleanupRounds; round++) await collectGarbage();
      const baseline = runtime.api.getNativeTreeStatistics?.();
      report.nativeBaseline = baseline; save();
      const groups = { window: [], document: [] };
      const runner = createBenchmarkRunner({ engine, runtime: runtime.api, trackRealms: true,
        warmupCurrentRealm: settings.warmupCurrentRealm ?? false, warmupGcOrder: settings.warmupGcOrder });
      for (const input of plan.rows) {
        const record = { label, ...input, complete: false };
        report.batches.push(record); save();
        const { realmReferences, ...measurement } = await runner.measureWorkload(input.name, input.size);
        Object.assign(record, measurement);
        for (const kind of ['window', 'document']) {
          assert.equal(realmReferences[kind].length, settings.warmupSamples + settings.measuredSamples);
          groups[kind].push(...realmReferences[kind]);
        }
        record.trackedOwners = Object.fromEntries(Object.entries(groups).map(([kind, references]) => [kind, references.length]));
        record.cleanupTrace = await observeCleanup(groups, runtime, baseline); save();
        for (const endpoint of record.cleanupTrace.slice(-settings.requiredClearRounds)) {
          assert.equal(endpoint.clear, true, `Single package: retained resources after ${input.name}/${input.size}`);
        }
        record.complete = true; save();
      }
      report.loadedAfter = checkLoaded();
      report.distributionsAfter = inspectDistributions(manifest, pair, engine, settings);
      report.affinitiesAfter = affinities();
      assert.equal(report.affinitiesAfter.find((entry) => entry.tid === process.pid).mask, String(settings.cpu));
      assert.ok(report.affinitiesAfter.some((entry) => entry.tid !== process.pid && !entry.disappeared && entry.mask !== String(settings.cpu)));
      report.complete = true; save();
    } catch (error) { report.failure = { message: error.message, stack: error.stack }; save(); throw error; }
  }
  return { schedule, workerArguments, loadedPackages, observeCleanup, main };
}

const worker = createSinglePackageWorker();
if (require.main === module) worker.main(...process.argv.slice(2)).catch((error) => {
  process.stderr.write(`${error.stack}\n`); process.exitCode = 1;
});
module.exports = { ...worker, createSinglePackageWorker };
