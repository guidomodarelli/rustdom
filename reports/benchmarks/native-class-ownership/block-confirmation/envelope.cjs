/** @module confirmation-functional-envelope Replay current raw reports against independent invocation/source observations; no archived runtime loading. */
'use strict';
const assert = require('node:assert/strict');
const { schedule } = require('./calendar.cjs');
const { validateWorker } = require('./raw-reader.cjs');
const policy = require('./constants/worker.json');
const design = require('./constants/design.json');

/**
 * Verify the producer sidecar before decoding unchanged task and resource data.
 * The caller must authenticate package/source and record the process independently; JSON cannot authenticate itself.
 * @param {object} report - Original raw sampler report.
 * @param {object} context - Original separate producer sidecar.
 * @param {object} manifest - Independently authenticated sealed physical packages.
 * @param {object} input - Exact new calendar tuple.
 * @param {object} invocation - Parent-observed mode, SDK, PID, host and monotonic time window.
 * @param {object} producer - Independent parent PID and current worker/engine source hashes.
 * @returns {object} Functional behavior/resource replay only; no statistical observation or acceptance.
 */
function replayEnvelope(report, context, manifest, input, invocation, producer) {
  assert.equal(invocation.mode, 'functional', 'Confirmation envelope: scientific replay requires the future integral reader');
  const planned = schedule([input.node, input.phase, input.engine, input.row].join('/'));
  assert.deepEqual(input, planned.processes[input.ordinal], 'Confirmation envelope: changed calendar tuple');
  assert.equal(invocation.node, input.node);
  assert.equal(typeof invocation.hostId, 'string'); assert.ok(invocation.hostId.length > 0);
  assert.ok(Number.isFinite(invocation.startMonotonicMs) && invocation.startMonotonicMs >= 0);
  assert.ok(Number.isFinite(invocation.endMonotonicMs) && invocation.endMonotonicMs > invocation.startMonotonicMs);
  assert.ok(Number.isSafeInteger(producer.parentPid) && producer.parentPid > 0);
  assert.equal(context.complete, true); assert.equal(context.mode, invocation.mode);
  assert.equal(context.workerRevision, policy.revision); assert.equal(context.methodRevision, design.revision);
  assert.equal(context.rawPayloadContractRevision, report.revision);
  for (const field of ['workerSourceSha256', 'workerEngineSourceSha256']) {
    assert.equal(typeof producer[field], 'string'); assert.match(producer[field], /^[a-f0-9]{64}$/);
    assert.equal(context[field], producer[field], 'Confirmation envelope: producer source hash differs');
  }
  assert.equal(context.pid, invocation.pid); assert.equal(context.parentPid, producer.parentPid);
  assert.equal(context.node, invocation.node); assert.deepEqual(context.plannedInput, input);
  assert.equal(context.numericPackageArtifactId, policy.selectedArtifactId);
  assert.equal(manifest.selectedArtifactId, policy.selectedArtifactId); assert.equal(manifest.functionalOnly, true);
  assert.equal(manifest.nativeBinarySha256, design.selectedNativeBinarySha256);
  assert.equal(manifest.archiveSha256, design.selectedPackageArchiveSha256);
  for (const field of ['packageAuthenticationPerformedHere', 'producerSourceAuthenticationPerformedHere',
    'scientificCaptureExecuted', 'gateReevaluated']) assert.equal(context[field], false);
  assert.equal(context.analysisObservation, null); assert.equal(context.performanceAccepted, null);
  const tuple = { phase: input.phase, engine: input.engine, position: input.factor, label: input.label, rowIndex: input.rowIndex };
  const replay = validateWorker(report, manifest, tuple, invocation);
  return { replay, producerBindingsChecked: true, analysisObservation: null,
    trackedOwners: { ...report.trackedOwners }, cleanupTrace: report.cleanupTrace,
    transportAuthenticationPerformed: false, producerSourceAuthenticationPerformed: false,
    scientificCaptureExecuted: false, performanceAccepted: null, gateReevaluated: false };
}

module.exports = { replayEnvelope };
