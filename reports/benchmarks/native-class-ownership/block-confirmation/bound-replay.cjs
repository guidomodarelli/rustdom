/** @module confirmation-bound-replay Validates real binding, invocation, source sidecar and raw tasks before computing a scalar observation. */
'use strict';
const assert = require('node:assert/strict');
const { validateContext, replayEnvelope } = require('./envelope.cjs');
const { validateWorker } = require('./raw-reader.cjs');
const { requireMode, validateBinding } = require('./binding.cjs');
const policy = require('./constants/capture.json');
const design = require('./constants/design.json');

/**
 * Replay only after the caller independently authenticates transport, source, package and the parent journal.
 * @param {object} report - Original raw sampler data. @param {object} context - Original sidecar.
 * @param {object} manifest - Independently authenticated physical roots and hashes. @param {object} input - Exact calendar tuple.
 * @param {object} invocation - Actual parent-observed PID/SDK/clocks/mode/binding digest.
 * @param {object} producer - Actual parent PID and independently authenticated source hashes.
 * @param {object} binding - Original immutable declaration. @param {object} expectedBinding - Independent reader/parent observations.
 * @returns {object} All validated resources and one computed scientific observation, or null for functional qualification.
 */
function replayBoundProcess(report, context, manifest, input, invocation, producer, binding, expectedBinding) {
  requireMode(invocation.mode); assert.equal(expectedBinding.mode, invocation.mode);
  validateBinding(binding, expectedBinding);
  assert.equal(binding.parentPid, producer.parentPid); assert.equal(invocation.parentPid, producer.parentPid);
  assert.match(invocation.methodBindingSha256, new RegExp(policy.sha256Pattern));
  assert.equal(invocation.methodBindingSha256, expectedBinding.bindingSha256);
  assert.equal(context.methodBindingSha256, invocation.methodBindingSha256);
  assert.equal(context.methodParentPid, producer.parentPid); assert.equal(context.criterionId, binding.criterionId);
  assert.equal(context.hostId, binding.hostId); assert.equal(invocation.hostId, binding.hostId);
  assert.equal(context.manifestSha256, expectedBinding.manifestSha256);
  assert.equal(binding.criterionId, [input.node, input.phase, input.engine, input.row].join('/'));
  const boundProducer = { ...producer, workerRevision: policy.workerRevision };
  let result;
  if (invocation.mode === policy.functionalMode) result = replayEnvelope(report, context, manifest, input, invocation, boundProducer);
  else {
    validateContext(report, context, manifest, input, invocation, boundProducer);
    const tuple = { phase: input.phase, engine: input.engine, position: input.factor, label: input.label, rowIndex: input.rowIndex };
    result = { replay: validateWorker(report, manifest, tuple, invocation), trackedOwners: { ...report.trackedOwners }, cleanupTrace: report.cleanupTrace };
  }
  const observation = invocation.mode === policy.functionalMode ? null : {
    revision: design.revision, mode: policy.captureMode, complete: true, processId: input.processId, hostId: invocation.hostId,
    meanMs: result.replay.processMeanMs, measuredTaskCount: result.replay.samplesMs.length, warmupTaskCount: result.replay.warmupSamplesMs.length,
    startMonotonicMs: invocation.startMonotonicMs, endMonotonicMs: invocation.endMonotonicMs, outputHash: result.replay.outputHash };
  return { ...result, bindingChecked: true, analysisObservation: observation,
    transportAuthenticationPerformed: false, producerSourceAuthenticationPerformed: false,
    performanceAccepted: null, gateReevaluated: false };
}
module.exports = { replayBoundProcess };
