/** @module pilot-process-reader Reuses the unchanged raw task/resource contract; functional data never becomes pilot observations. */
'use strict';
const assert = require('node:assert/strict');
const { calendar } = require('./blocks.cjs');
const { validateWorker } = require('../../owner-batch-study/results.cjs');
const design = require('./constants/design.json');

/**
 * Replay an unchanged raw worker-format payload against its independent planned invocation.
 * The raw schema revision identifies the reused contract, not the producer's source commit or historical study.
 * Upstream transport/source/package authentication remains mandatory. This does not read or execute archived code.
 * @param {object} report - JSON-decoded raw worker-format data, never rewritten to fit the contract.
 * @param {object} manifest - Independently authenticated physical package inventories/roots.
 * @param {object} plannedInput - Exact full calendar process, including criterion, block, factor and ordinal.
 * @param {object} invocation - Independent PID/SDK/mode/host and parent monotonic execution window.
 * @returns {object} Validated tasks, warmup and endpoints; functional-only data has no statistical observation.
 */
function replayProcess(report, manifest, plannedInput, invocation) {
  assert.ok(invocation && ['functional', 'capture'].includes(invocation.mode), 'Pilot process reader: undeclared invocation mode');
  if (invocation.mode === 'capture') {
    assert.equal(design.executionReady, true, 'Pilot process reader: integral scientific method is not published');
    assert.match(invocation.methodBindingSha256 ?? '', /^[a-f0-9]{64}$/);
    assert.ok(Number.isSafeInteger(invocation.parentPid) && invocation.parentPid > 0);
  }
  assert.equal(plannedInput.engine, design.engine, 'Pilot process reader: only jsdom controls belong to this pilot');
  const shard = calendar().find((entry) => entry.node === plannedInput.node && entry.phase === plannedInput.phase && entry.rowIndex === plannedInput.rowIndex);
  assert.ok(shard, 'Pilot process reader: undeclared criterion');
  assert.ok(Number.isSafeInteger(plannedInput.ordinal) && plannedInput.ordinal >= 0 && plannedInput.ordinal < shard.processes.length);
  assert.deepEqual(plannedInput, shard.processes[plannedInput.ordinal], 'Pilot process reader: changed block/factor/order tuple');
  assert.equal(invocation.node, plannedInput.node, 'Pilot process reader: invocation SDK differs from criterion');
  assert.equal(typeof invocation.hostId, 'string'); assert.ok(invocation.hostId.length > 0);
  assert.ok(Number.isFinite(invocation.startMonotonicMs) && invocation.startMonotonicMs >= 0);
  assert.ok(Number.isFinite(invocation.endMonotonicMs) && invocation.endMonotonicMs > invocation.startMonotonicMs,
    'Pilot process reader: parent execution window must be finite and ordered');
  const input = { phase: plannedInput.phase, engine: plannedInput.engine, position: plannedInput.factor,
    label: plannedInput.label, rowIndex: plannedInput.rowIndex };
  const replay = validateWorker(report, manifest, input, invocation);
  const observation = invocation.mode === 'functional' ? null : {
    complete: true, processId: plannedInput.processId, hostId: invocation.hostId,
    startMonotonicMs: invocation.startMonotonicMs, endMonotonicMs: invocation.endMonotonicMs,
    meanMs: replay.processMeanMs, measuredTaskCount: replay.samplesMs.length, warmupTaskCount: replay.warmupSamplesMs.length };
  return { mode: invocation.mode, rawPayloadRevision: report.revision,
    rawPayloadRewritten: false, transportAuthenticationPerformed: false, producerSourceAuthenticationPerformed: false,
    analysisObservation: observation, replay,
    cleanupTrace: report.cleanupTrace, trackedOwners: { ...report.trackedOwners },
    scientificCaptureExecuted: invocation.mode === 'capture', performanceAccepted: null, gateReevaluated: false };
}

module.exports = { replayProcess };
