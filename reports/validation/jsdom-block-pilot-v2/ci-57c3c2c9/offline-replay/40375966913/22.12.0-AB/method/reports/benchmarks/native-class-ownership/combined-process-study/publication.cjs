/** @module combined-method-publication Identifies the independently reviewed current method without trusting declarations recovered from an artifact. */
'use strict';
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const policy = require('./constants/protocol.json');
const capture = require('./constants/capture.json');
const transport = require('./constants/transport.json');

/** @param {Record<string,string>} files - Authenticated current method files. @returns {string} UTF8 JSON sorted-entry digest, independent of object insertion order. */
function methodFilesDigest(files) {
  const entries = Object.entries(files).sort(([left], [right]) => Buffer.compare(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8')));
  return createHash('sha256').update(JSON.stringify(entries), 'utf8').digest('hex');
}

/** @param {object} receipt - Independent current repository review. @param {Record<string,string>} files - Regenerated current source graph. @returns {object} Verified declaration, never performance acceptance. */
function verifyPublication(receipt, files) {
  assert.equal(receipt.revision, policy.revision); assert.equal(receipt.actionableFindings, 0);
  assert.equal(receipt.completeMethodReview, true); assert.equal(receipt.executionReady, policy.executionReady);
  assert.deepEqual(receipt.files, files, 'Combined capture: method differs from the independent reviewed publication');
  assert.equal(receipt.methodFilesSha256, methodFilesDigest(files));
  assert.equal(receipt.packageArchiveSha256, policy.packageArchiveSha256);
  assert.equal(receipt.historicalHarnessSha256, policy.sourceHarnessSha256);
  assert.equal(receipt.acceptanceRule, policy.acceptanceRule);
  assert.equal(receipt.performanceAccepted, null); assert.equal(receipt.gateReevaluated, false);
  return receipt;
}
/** @param {object} binding - Own immutable pre-artifact binding. @param {object} expected - Authenticated source/hosted/method identity. @returns {void} Reject a different invocation before sampling or accepting its payload. */
function verifyCaptureBinding(binding, expected) {
  assert.equal(binding.repository, policy.apiRepository); assert.equal(binding.revision, policy.revision);
  assert.equal(binding.head, expected.sourceCommit); assert.match(binding.head, /^[a-f0-9]{40}$/);
  assert.ok(Number.isSafeInteger(binding.runId) && binding.runId > 0 && Number.isSafeInteger(binding.jobId) && binding.jobId > 0);
  assert.equal(String(binding.runId), expected.hosted.runId); assert.equal(binding.attempt, expected.hosted.attempt);
  assert.equal(binding.attempt, 1); assert.equal(binding.workflow, capture.workflow);
  assert.equal(expected.hosted.repository, binding.repository); assert.equal(expected.hosted.workflow, policy.workflowName);
  assert.equal(expected.hosted.jobKey, capture.jobKey);
  assert.equal(binding.publicationSha256, expected.publicationSha256);
  assert.equal(binding.methodFilesSha256, expected.methodFilesSha256);
  assert.equal(binding.artifactName, transport.artifactPrefix + binding.head + '-attempt1');
  assert.equal(binding.tarName, transport.tarName); assert.equal(binding.rootName, transport.rootName);
  assert.equal(binding.artifactId, null);
}
module.exports = { methodFilesDigest, verifyPublication, verifyCaptureBinding };
