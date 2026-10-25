/** @module owner-batch-worker Qualifies fresh one-package processes; formal capture remains disabled until the complete method is published. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { getHeapStatistics } = require('node:v8');
const { createBatchSampler, failureView } = require('./batches.cjs');
const samplerPolicy = require('./constants/sampler.json');
const policy = require('./constants/worker.json');
const original = require('../combined-process-study/model.cjs');
const { createSinglePackageWorker } = require('../single-package-worker.cjs');
const { schedule: pairSchedule, inspectDistributions } = require('../paired-main-worker.cjs');
const { configureAffinity, affinities } = require('../thread-worker.cjs');
const { fixture: fixtureHTML, loadRuntime } = require('../paired-worker.cjs');
const fixtures = require('../shared-fixture-candidate/fixtures.cjs');
const operations = require('../../../../benchmarks/ownership-operations.cjs');
const { warmOwnership } = require('../../../../benchmarks/ownership-warmup.cjs');
const { collectGarbage } = require('../../../../scripts/memory-endpoint.cjs');

// Only scheduling helpers consume these legacy factors. Sampling counts are declared separately below.
const scheduling = { ...original.settings, revision: policy.revision, distributionHashes: policy.distributions };
const scheduler = createSinglePackageWorker(scheduling);
const sampler = createBatchSampler({ fixtureHTML, fixtures, operations, warmOwnership, collectGarbage });

/** @param {number} position - Fixed global factor position. @returns {string[]} Unchanged official V8 flags. */
function workerArguments(position) { return scheduler.workerArguments(position); }

/**
 * Execute one genuine selected treatment in a fresh Linux process, retaining partial evidence on every runtime failure.
 * @param {string[]} args - Manifest, phase, engine, position, label, output and canonical row index.
 * @param {boolean} functionalOnly - Development qualification; false cannot run the unpublished capture.
 * @param {function(object):void} onProgress - Optional observer receiving only fresh scalar block progress; original callback errors are preserved.
 * @returns {Promise<object>} Scalar report including every duration and all resource endpoints.
 */
async function main(args, functionalOnly = false, onProgress = () => {}) {
  if (!functionalOnly) assert.equal(policy.executionReady, true, 'Owner batch worker: formal capture is not enabled');
  assert.equal(functionalOnly, true, 'Owner batch worker: only functional qualification is currently implemented');
  assert.equal(typeof onProgress, 'function', 'Owner batch worker: scalar progress observer must be a function');
  assert.equal(args.length, 7, 'Owner batch worker: provide manifest, phase, engine, position, label, output and row');
  assert.equal(process.platform, 'linux', 'Owner batch worker: Linux thread affinity evidence is required');
  assert.equal(typeof global.gc, 'function', 'Owner batch worker: use --expose-gc');
  assert.ok(scheduling.nodeVersions.includes(process.version), 'Owner batch worker: undeclared Node version');
  assert.equal(Object.hasOwn(process.env, 'NODE_OPTIONS'), false, 'Owner batch worker: NODE_OPTIONS must be absent');
  const [manifestPath, phase, engine, positionText, label, output, rowText] = args;
  const position = Number(positionText); const rowIndex = Number(rowText);
  assert.equal(positionText, String(position)); assert.equal(rowText, String(rowIndex));
  assert.deepEqual(process.execArgv, workerArguments(position), 'Owner batch worker: changed V8 startup flags');
  assert.equal(fs.existsSync(output), false, 'Owner batch worker: preserve existing evidence');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, policy.outputEncoding));
  const plan = scheduler.schedule(manifest, phase, engine, position, label, rowIndex);
  const key = samplerPolicy.rows[rowIndex];
  assert.deepEqual(plan.rows, [{ name: key.slice(0, key.lastIndexOf('/')), size: Number(key.slice(key.lastIndexOf('/') + 1)) }]);
  const report = { revision: policy.revision, complete: false, functionalOnly, purpose: policy.purpose,
    performanceAccepted: null, gateReevaluated: false, performanceStudyExecuted: false,
    phase, engine, position, label, rowIndex, key, schedule: plan,
    pid: process.pid, node: process.version, v8: process.versions.v8, execArgv: process.execArgv,
    heapLimitBytes: getHeapStatistics().heap_size_limit,
    v8Seed: scheduling.v8Seeds[position],
    randomProbe: Array.from({ length: scheduling.v8SeedProbeSamples }, () => Math.random()),
    sampling: { tasksPerBlock: samplerPolicy.logicalTasksPerBlock,
      warmupBlocks: samplerPolicy.warmupBlocksPerProcess, measuredBlocks: samplerPolicy.measuredBlocksPerProcess,
      withinRealmWarmupRounds: samplerPolicy.withinRealmWarmupRounds }, blocks: [] };
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  const save = () => fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
  const owners = { window: [], document: [] };
  let runtime;
  let failed = false;
  let originalFailure;
  const checkLoaded = () => {
    const loaded = scheduler.loadedPackages(manifest);
    for (const [physical, filenames] of Object.entries(loaded)) {
      assert.equal(filenames.length > 0, physical === plan.physical,
        'Owner batch worker: unexpected loaded physical package ' + physical);
    }
    return loaded;
  };
  try {
    const pair = pairSchedule(manifest, phase, engine, position, scheduling);
    report.distributionsBefore = inspectDistributions(manifest, pair, engine, scheduling); save();
    if (plan.physical === 'B') assert.equal(createHash('sha256').update(fs.readFileSync(path.join(plan.root, 'dist/rustdom.node'))).digest('hex'),
      policy.selectedBinarySha256, 'Owner batch worker: selected hosted binary changed');
    report.affinity = await configureAffinity('main');
    assert.ok(Object.values(scheduler.loadedPackages(manifest)).every((filenames) => filenames.length === 0),
      'Owner batch worker: a DOM package was already loaded');
    runtime = loadRuntime(plan.root, engine);
    report.loadedBefore = checkLoaded();
    for (let round = 0; round < scheduling.cleanupRounds; round++) await collectGarbage();
    report.nativeBaseline = runtime.api.getNativeTreeStatistics?.() ?? null;
    save();
    report.measurement = await sampler.measureRow({ runtime, engine, key, owners,
      onProgress: (block) => {
        if (!report.blocks.includes(block)) report.blocks.push(block);
        save();
        onProgress({ blockIndex: block.blockIndex, complete: block.complete, tasks: block.tasks.length });
      } });
    report.loadedAfter = checkLoaded();
    report.distributionsAfter = inspectDistributions(manifest, pair, engine, scheduling);
    report.affinitiesAfter = affinities();
    assert.equal(report.affinitiesAfter.find((entry) => entry.tid === process.pid).mask, String(scheduling.cpu));
    assert.ok(report.affinitiesAfter.some((entry) => entry.tid !== process.pid && !entry.disappeared && entry.mask !== String(scheduling.cpu)));
  } catch (error) {
    failed = true; originalFailure = error;
    report.failure = failureView(error);
  } finally {
    report.trackedOwners = { window: owners.window.length, document: owners.document.length };
    if (runtime) {
      try {
        report.cleanupTrace = await scheduler.observeCleanup(owners, runtime, report.nativeBaseline ?? undefined);
        for (const endpoint of report.cleanupTrace.slice(-samplerPolicy.requiredFinalClearStates)) {
          assert.equal(endpoint.clear, true, 'Owner batch worker: retained Window, Document or native family');
        }
      } catch (error) {
        report.cleanupFailure = failureView(error);
        if (!failed) { failed = true; originalFailure = error; }
      }
    }
    report.complete = !failed;
    save();
  }
  if (failed) throw originalFailure;
  return report;
}

if (require.main === module) {
  const args = process.argv.slice(2); const functionalOnly = args[0] === policy.functionalOption;
  main(functionalOnly ? args.slice(1) : args, functionalOnly).catch((error) => {
    process.stderr.write(JSON.stringify(failureView(error)) + '\n'); process.exitCode = policy.failureExitCode;
  });
}
module.exports = { workerArguments, main };
