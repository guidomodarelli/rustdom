/** @module pilot-process-envelope Binds a raw payload and sidecar to the independently observed invocation. */
'use strict';
const assert = require('node:assert/strict');
const { replayProcess } = require('./process-reader.cjs');
const policy = require('./constants/envelope.json');
const worker = require('./constants/worker.json');
const digestPattern = new RegExp(policy.sha256Pattern);

/**
 * Check producer claims against trusted parent observations before replaying task/resource data.
 * The caller authenticates transport, source bytes and package first; the sidecar cannot authenticate itself.
 * This function retains only scalar replay results, never a DOM object or an input report reference.
 * @param {object} report - Decoded unchanged raw report.
 * @param {object} context - Separate producer sidecar.
 * @param {object} manifest - Package manifest authenticated by the caller.
 * @param {object} plannedInput - Original process in the prospective calendar.
 * @param {object} invocation - Independent SDK/PID/host/clock observations from the process executor.
 * @param {{parentPid:number,workerSourceSha256:string,workerEngineSourceSha256?:string}} producer - Parent and authenticated adapter/engine bytes; the legacy single-module profile has no separate engine.
 * @returns {object} Functional replay with explicit limits; no scientific observation or performance acceptance.
 */
function replayEnvelope(report, context, manifest, plannedInput, invocation, producer) {
  assert.ok(invocation && policy.implementedModes.includes(invocation.mode),
    'Pilot envelope: scientific capture is not implemented by this reader');
  assert.equal(invocation.mode, 'functional');
  assert.ok(producer && Number.isSafeInteger(producer.parentPid) && producer.parentPid > 0,
    'Pilot envelope: independently observed parent PID required');
  assert.equal(typeof producer.workerSourceSha256, 'string');
  assert.equal(producer.workerSourceSha256.length, policy.sha256HexLength);
  assert.match(producer.workerSourceSha256, digestPattern);
  assert.ok(context && typeof context === 'object' && !Array.isArray(context));
  assert.equal(context.complete, true, 'Pilot envelope: incomplete producer sidecar');
  assert.equal(context.mode, invocation.mode, 'Pilot envelope: producer mode differs from invocation');
  assert.equal(context.workerRevision, worker.revision);
  assert.equal(context.rawPayloadContractRevision, report.revision);
  assert.equal(context.workerSourceSha256, producer.workerSourceSha256, 'Pilot envelope: worker source binding differs');
  if (producer.workerEngineSourceSha256 !== undefined || context.workerEngineSourceSha256 !== undefined) {
    assert.equal(typeof producer.workerEngineSourceSha256, 'string');
    assert.equal(producer.workerEngineSourceSha256.length, policy.sha256HexLength);
    assert.match(producer.workerEngineSourceSha256, digestPattern);
    assert.equal(context.workerEngineSourceSha256, producer.workerEngineSourceSha256, 'Pilot envelope: worker engine binding differs');
  }
  if (invocation.methodBindingSha256 !== undefined) {
    assert.equal(context.methodBindingSha256, invocation.methodBindingSha256);
  }
  assert.equal(context.pid, invocation.pid, 'Pilot envelope: worker PID differs from observed child');
  assert.equal(context.parentPid, producer.parentPid, 'Pilot envelope: parent PID differs from executor');
  assert.equal(context.node, invocation.node, 'Pilot envelope: producer SDK differs from invocation');
  assert.deepEqual(context.plannedInput, plannedInput, 'Pilot envelope: sidecar changed the calendar tuple');
  assert.equal(context.numericPackageArtifactId, worker.selectedArtifactId);
  assert.equal(context.numericPackageArtifactId, manifest.selectedArtifactId);
  assert.equal(context.packageAuthenticationPerformedHere, false);
  assert.equal(context.producerSourceAuthenticationPerformedHere, false);
  assert.equal(context.scientificCaptureExecuted, false);
  assert.equal(context.analysisObservation, null);
  assert.equal(context.performanceAccepted, null);
  assert.equal(context.gateReevaluated, false);
  const replay = replayProcess(report, manifest, plannedInput, invocation);
  assert.equal(replay.analysisObservation, null);
  return { ...replay, envelopeRevision: policy.revision, producerBindingsChecked: true,
    producerSourceAuthenticationPerformed: false, transportAuthenticationPerformed: false };
}

module.exports = { replayEnvelope };
