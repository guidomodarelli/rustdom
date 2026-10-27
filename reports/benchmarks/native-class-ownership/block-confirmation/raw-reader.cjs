/** @module confirmation-raw-reader Applies the frozen raw task/resource schema to the new sealed distribution hashes without rewriting a report. */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const model = require('../combined-process-study/model.cjs');
const { createSinglePackageWorker } = require('../single-package-worker.cjs');
const { schedule: pairSchedule } = require('../paired-main-worker.cjs');
const { isReleased } = require('../../../../scripts/memory-endpoint.cjs');
const { processMean } = require('../owner-batch-study/compare.cjs');
const rawPolicy = require('../owner-batch-study/constants/worker.json');
const sealed = require('./constants/worker.json');
const design = require('./constants/design.json');
const policy = { ...rawPolicy, distributions: sealed.distributions };
const sampler = require('../owner-batch-study/constants/sampler.json');
const resources = require('../owner-batch-study/constants/resources.json');
const outputs = require('../owner-batch-study/constants/outputs.json');
const scheduling = { ...model.settings, revision: policy.revision, distributionHashes: policy.distributions };
const scheduler = createSinglePackageWorker(scheduling);

/** @param {object} value - Scalar native statistics payload. @param {string} prefix - Declared field context. @returns {object} Flat type-safe view; missing lifetime families cannot masquerade as undefined baselines. */
function nativeFields(value, prefix = '') {
  assert.ok(value && typeof value === 'object' && !Array.isArray(value), 'Confirmation raw reader: native statistics object required');
  const fields = {};
  for (const [key, entry] of Object.entries(value)) {
    const name = prefix ? prefix + '.' + key : key;
    if (entry !== null && typeof entry === 'object' && !Array.isArray(entry)) Object.assign(fields, nativeFields(entry, name));
    else {
      assert.ok(typeof entry === 'boolean' || (Number.isSafeInteger(entry) && entry >= 0),
        'Confirmation raw reader: invalid native statistic ' + name);
      fields[name] = typeof entry;
    }
  }
  return fields;
}

/** @param {object} trace - Actual scalar endpoint. @param {object|null} baseline - Recorded pre-realm native baseline. @returns {void} Recompute resource liveness and require every observed native family. */
function validateEndpoint(trace, baseline) {
  assert.ok(trace && typeof trace === 'object');
  assert.deepEqual(Object.keys(trace.survivors).sort(), resources.ownerKinds);
  for (const count of Object.values(trace.survivors)) assert.ok(Number.isSafeInteger(count) && count >= 0);
  for (const field of resources.memoryFields) assert.ok(Number.isSafeInteger(trace.memory[field]) && trace.memory[field] >= 0,
    'Confirmation raw reader: invalid memory snapshot ' + field);
  assert.ok(trace.memory.rss > 0 && trace.memory.heapUsed <= trace.memory.heapTotal);
  if (baseline === null) assert.equal(trace.nativeTree, undefined, 'Confirmation raw reader: jsdom must have no native statistics');
  else assert.deepEqual(nativeFields(trace.nativeTree), resources.nativeScalarFields,
    'Confirmation raw reader: incomplete or changed native endpoint schema');
  assert.equal(trace.clear, isReleased(trace, baseline ?? undefined), 'Confirmation raw reader: false resource-clear claim');
}

/** @param {object[]} entries - Real captured thread affinity observations. @param {number} pid - Observed child process. @returns {object} The actual main thread. */
function mainThread(entries, pid) {
  assert.ok(Array.isArray(entries));
  assert.equal(new Set(entries.map((entry) => entry.tid)).size, entries.length);
  for (const entry of entries) {
    assert.ok(Number.isSafeInteger(entry.tid) && entry.tid > 0);
    if (entry.disappeared !== true) assert.ok(typeof entry.mask === 'string' && entry.mask.length > 0);
  }
  const matching = entries.filter((entry) => entry.tid === pid);
  assert.equal(matching.length, 1); assert.notEqual(matching[0].disappeared, true);
  return matching[0];
}

/**
 * Validate one complete raw worker against its independent process invocation and authenticated package manifest.
 * This is a behavior reader, not transport authentication or performance acceptance.
 * @param {object} report - Decoded data only; no imports from the capture.
 * @param {object} manifest - Original authenticated physical roots and distribution inventories.
 * @param {object} input - Fixed phase/engine/position/label/row tuple.
 * @param {{pid:number,node:string,mode:'functional'|'capture'}} expected - Independently recorded invocation metadata.
 * @returns {object} Exactly one scalar process observation with all 144 measured times and retained warmup.
 */
function validateWorker(report, manifest, input, expected) {
  assert.ok(['functional', 'capture'].includes(expected.mode));
  const functionalOnly = expected.mode === 'functional';
  if (!functionalOnly) {
    assert.equal(design.executionReady, true, 'Confirmation raw reader: scientific capture method is not enabled');
    assert.equal(sampler.executionReady, true);
  }
  assert.equal(report.complete, true); assert.equal(report.failure, undefined); assert.equal(report.cleanupFailure, undefined);
  assert.equal(report.revision, policy.revision);
  assert.equal(report.functionalOnly, functionalOnly); assert.equal(report.performanceStudyExecuted, !functionalOnly);
  assert.equal(report.purpose, functionalOnly ? policy.purpose : sampler.purposes.capture);
  assert.equal(report.performanceAccepted, null); assert.equal(report.gateReevaluated, false);
  if (expected.methodBindingSha256 !== undefined) {
    assert.match(expected.methodBindingSha256, /^[a-f0-9]{64}$/);
    assert.equal(report.methodBindingSha256, expected.methodBindingSha256);
    assert.equal(report.methodParentPid, expected.parentPid);
  } else {
    assert.equal(functionalOnly, true, 'Confirmation raw reader: scientific part requires independent method binding');
    assert.equal(report.methodBindingSha256, undefined); assert.equal(report.methodParentPid, undefined);
  }
  assert.ok(model.settings.nodeVersions.includes(expected.node));
  assert.equal(report.node, expected.node); assert.equal(report.pid, expected.pid);
  assert.ok(Number.isSafeInteger(report.pid) && report.pid > 0);
  assert.ok(typeof report.v8 === 'string' && report.v8.length > 0);
  assert.ok(Number.isSafeInteger(report.heapLimitBytes) && report.heapLimitBytes > 0);
  for (const field of ['phase', 'engine', 'position', 'label', 'rowIndex']) assert.equal(report[field], input[field]);
  assert.deepEqual(report.execArgv, scheduler.workerArguments(input.position));
  assert.equal(report.v8Seed, scheduling.v8Seeds[input.position]);
  assert.equal(report.randomProbe.length, scheduling.v8SeedProbeSamples);
  assert.ok(report.randomProbe.every((value) => Number.isFinite(value) && value >= 0 && value < 1));
  const selected = scheduler.schedule(manifest, input.phase, input.engine, input.position, input.label, input.rowIndex);
  assert.deepEqual(report.schedule, selected);
  const pair = pairSchedule(manifest, input.phase, input.engine, input.position, scheduling);
  for (const distributions of [report.distributionsBefore, report.distributionsAfter]) {
    assert.deepEqual(Object.keys(distributions).sort(), scheduling.labels);
    for (const label of scheduling.labels) {
      const physical = pair.physical[label];
      assert.equal(distributions[label].sha256, policy.distributions[physical]);
      assert.deepEqual(distributions[label], manifest.distributions[physical]);
    }
  }
  for (const loaded of [report.loadedBefore, report.loadedAfter]) {
    assert.deepEqual(Object.keys(loaded).sort(), Object.keys(policy.distributions).sort());
    for (const [physical, filenames] of Object.entries(loaded)) {
      assert.ok(Array.isArray(filenames)); assert.equal(filenames.length > 0, physical === selected.physical);
      assert.equal(new Set(filenames).size, filenames.length);
      assert.ok(filenames.every((filename) => typeof filename === 'string' && filename.startsWith(manifest.copies[physical] + path.posix.sep)));
    }
  }
  assert.equal(mainThread(report.affinity.configured, report.pid).mask, String(scheduling.cpu));
  assert.notEqual(mainThread(report.affinity.initial, report.pid).mask, String(scheduling.cpu));
  assert.equal(mainThread(report.affinitiesAfter, report.pid).mask, String(scheduling.cpu));
  for (const entries of [report.affinity.configured, report.affinitiesAfter]) assert.ok(entries.some((entry) =>
    entry.tid !== report.pid && entry.disappeared !== true && entry.mask !== String(scheduling.cpu)));
  for (const initial of report.affinity.initial.filter((entry) => entry.tid !== report.pid && !entry.disappeared)) {
    const configured = report.affinity.configured.find((entry) => entry.tid === initial.tid);
    if (configured && !configured.disappeared) assert.equal(configured.mask, initial.mask, 'Confirmation raw reader: existing background thread mask changed');
  }
  const key = sampler.rows[input.rowIndex]; assert.equal(report.key, key);
  assert.deepEqual(report.sampling, { tasksPerBlock: sampler.logicalTasksPerBlock,
    warmupBlocks: sampler.warmupBlocksPerProcess, measuredBlocks: sampler.measuredBlocksPerProcess,
    withinRealmWarmupRounds: sampler.withinRealmWarmupRounds });
  const blockCount = sampler.warmupBlocksPerProcess + sampler.measuredBlocksPerProcess;
  assert.equal(report.blocks.length, blockCount);
  assert.deepEqual(report.trackedOwners, { window: blockCount, document: blockCount });
  const measured = []; const warmup = []; const blockMeans = []; let previousEndMs = 0;
  for (const [index, block] of report.blocks.entries()) {
    const stage = index < sampler.warmupBlocksPerProcess ? sampler.stages.warmup : sampler.stages.measured;
    assert.equal(block.key, key); assert.equal(block.blockIndex, index); assert.equal(block.stage, stage);
    assert.equal(block.complete, true); assert.equal(block.failure, undefined); assert.equal(block.cleanupFailure, undefined);
    assert.equal(block.functionalOnly, functionalOnly);
    assert.equal(block.purpose, functionalOnly ? sampler.purposes.functional : sampler.purposes.capture);
    assert.equal(block.performanceAccepted, null); assert.equal(block.gateReevaluated, false);
    assert.equal(block.withinRealmWarmupRounds, sampler.withinRealmWarmupRounds);
    assert.equal(block.tasks.length, sampler.logicalTasksPerBlock);
    if (input.engine === 'rustdom') {
      for (const value of [block.nativeCreatedBeforeWarmup, block.nativeCreatedBefore, block.nativeCreatedAfter]) assert.ok(Number.isSafeInteger(value) && value >= 0);
      assert.ok(block.nativeCreatedBefore >= block.nativeCreatedBeforeWarmup && block.nativeCreatedAfter > block.nativeCreatedBefore);
    } else for (const field of ['nativeCreatedBeforeWarmup', 'nativeCreatedBefore', 'nativeCreatedAfter']) assert.equal(block[field], null);
    for (const [taskIndex, task] of block.tasks.entries()) {
      assert.equal(task.index, taskIndex); assert.equal(task.complete, true);
      assert.equal(task.failure, undefined); assert.equal(task.cleanupFailure, undefined);
      assert.ok(Number.isFinite(task.startMs) && task.startMs >= previousEndMs);
      assert.ok(Number.isFinite(task.durationMs) && task.durationMs > 0);
      previousEndMs = task.startMs + task.durationMs;
      assert.equal(task.outputHash, outputs.hashes[key], 'Confirmation raw reader: public task output differs from the independent reference');
      (stage === sampler.stages.measured ? measured : warmup).push(task.durationMs);
    }
    const scale = Math.max(...block.tasks.map((task) => task.durationMs));
    const meanMs = scale * (block.tasks.reduce((sum, task) => sum + task.durationMs / scale, 0) / sampler.logicalTasksPerBlock);
    blockMeans.push({ blockIndex: index, stage, tasks: sampler.logicalTasksPerBlock, meanMs });
  }
  assert.equal(report.measurement.complete, true); assert.equal(report.measurement.key, key);
  assert.equal(report.measurement.functionalOnly, functionalOnly);
  assert.equal(report.measurement.purpose, functionalOnly ? sampler.purposes.functional : sampler.purposes.capture);
  assert.equal(report.measurement.performanceAccepted, null); assert.equal(report.measurement.gateReevaluated, false);
  assert.deepEqual(report.measurement.blocks, report.blocks);
  assert.deepEqual(report.measurement.measuredSamplesMs, measured); assert.deepEqual(report.measurement.warmupSamplesMs, warmup);
  if (input.engine === 'rustdom') assert.deepEqual(nativeFields(report.nativeBaseline), resources.nativeScalarFields,
    'Confirmation raw reader: incomplete native baseline');
  else assert.equal(report.nativeBaseline, null);
  assert.equal(report.cleanupTrace.length, sampler.cleanupRounds);
  for (const endpoint of report.cleanupTrace) validateEndpoint(endpoint, report.nativeBaseline);
  for (const endpoint of report.cleanupTrace.slice(-sampler.requiredFinalClearStates)) assert.equal(endpoint.clear, true);
  return { key, outputHash: outputs.hashes[key], samplesMs: measured, warmupSamplesMs: warmup,
    processMeanMs: processMean(measured), blockMeans, measuredBlocks: sampler.measuredBlocksPerProcess,
    warmupBlocks: sampler.warmupBlocksPerProcess, observedWindows: blockCount, observedDocuments: blockCount,
    performanceAccepted: null, gateReevaluated: false };
}

module.exports = { nativeFields, validateEndpoint, validateWorker, validateSeedGroups: model.validateSeedProbes };
