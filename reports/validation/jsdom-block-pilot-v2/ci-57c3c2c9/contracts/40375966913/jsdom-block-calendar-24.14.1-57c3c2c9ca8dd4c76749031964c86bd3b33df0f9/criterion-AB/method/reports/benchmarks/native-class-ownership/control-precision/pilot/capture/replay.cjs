/** @module pilot-bound-replay Checks the invocation envelope before decoding raw task/resource evidence. */
'use strict';
const assert = require('node:assert/strict');
const { replayEnvelope } = require('../envelope.cjs');
const { replayProcess } = require('../process-reader.cjs');
const policy = require('../constants/capture.json');
const worker = require('../constants/worker.json');
const design = require('../constants/design.json');

/**
 * Replay one process whose transport, source and package were authenticated independently by the caller.
 * @param {object} report - Unchanged raw task report.
 * @param {object} context - Producer sidecar.
 * @param {object} manifest - Authenticated physical package inventories.
 * @param {object} input - Exactly one planned calendar tuple.
 * @param {object} invocation - Independently recorded mode, PID, SDK, clocks and method binding.
 * @param {object} producer - Independent parent PID and authenticated adapter/engine hashes.
 * @returns {object} Validated process, never performance acceptance; functional data has no observation.
 */
function replayBoundProcess(report, context, manifest, input, invocation, producer) {
  if (invocation.mode === policy.functionalMode) return replayEnvelope(report, context, manifest, input, invocation, producer);
  assert.equal(invocation.mode, policy.captureMode);
  assert.equal(policy.executionReady, true, 'Pilot replay: scientific method is not published');
  assert.equal(design.executionReady, true);
  assert.ok(context && typeof context === 'object' && !Array.isArray(context));
  assert.equal(context.complete, true); assert.equal(context.mode, invocation.mode);
  assert.equal(context.workerRevision, policy.revision); assert.equal(context.methodRevision, policy.revision);
  assert.equal(context.rawPayloadContractRevision, report.revision);
  for (const field of ['workerSourceSha256', 'workerEngineSourceSha256']) {
    assert.equal(typeof producer[field], 'string'); assert.equal(producer[field].length, policy.sha256HexLength);
    assert.match(producer[field], new RegExp(policy.sha256Pattern)); assert.equal(context[field], producer[field]);
  }
  assert.equal(context.pid, invocation.pid); assert.equal(context.parentPid, producer.parentPid);
  assert.equal(invocation.parentPid, producer.parentPid); assert.equal(context.node, invocation.node);
  assert.deepEqual(context.plannedInput, input); assert.equal(context.methodBindingSha256, invocation.methodBindingSha256);
  assert.equal(context.numericPackageArtifactId, worker.selectedArtifactId);
  assert.equal(manifest.selectedArtifactId, worker.selectedArtifactId); assert.equal(manifest.functionalOnly, false);
  assert.equal(context.packageAuthenticationPerformedHere, false); assert.equal(context.producerSourceAuthenticationPerformedHere, false);
  assert.equal(context.scientificCaptureExecuted, true); assert.equal(context.analysisObservation, null);
  assert.equal(context.performanceAccepted, null); assert.equal(context.gateReevaluated, false);
  const replay = replayProcess(report, manifest, input, invocation);
  return { ...replay, producerBindingsChecked: true,
    producerSourceAuthenticationPerformed: false, transportAuthenticationPerformed: false };
}

module.exports = { replayBoundProcess };
