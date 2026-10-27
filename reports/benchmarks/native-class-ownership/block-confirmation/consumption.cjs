/** @module confirmation-single-consumption Records the one actual hosted execution; functional rehearsal can never mint or consume this receipt. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { requireMode } = require('./binding.cjs');
const { requirePublishedSource, hostedContext } = require('./capture-source.cjs');
const { readJSON, writeNewJSON, hashFile } = require('../owner-batch-study/io.cjs');
const { filesDigest } = require('./source.cjs');
const policy = require('./constants/capture.json');
const worker = require('./constants/worker.json');
const sourcePolicy = require('./constants/source.json');

/**
 * Check decoded consumption data against an independently observed hosted context.
 * This pure schema check does not authenticate a GitHub event or authorize execution by itself.
 * @param {object} receipt - Original consumption receipt. @param {object} hosted - Independently checked actual hosted context.
 * @returns {void} Context consistency only; scientific execution still requires the published method and transport authentication.
 */
function validateReceipt(receipt, hosted) {
  assert.equal(receipt.revision, policy.revision); assert.equal(receipt.consumed, true);
  assert.equal(receipt.creatorJobKey, policy.prepareJobKey); assert.equal(receipt.hosted.jobKey, policy.prepareJobKey);
  for (const field of ['repository', 'workflow', 'attempt', 'pullRequest', 'label', 'runId', 'eventHead']) assert.equal(receipt.hosted[field], hosted[field]);
  assert.equal(receipt.hosted.repository, policy.repository); assert.equal(receipt.hosted.workflow, policy.workflowName);
  assert.equal(receipt.hosted.attempt, 1); assert.equal(receipt.hosted.pullRequest, policy.pullRequest); assert.equal(receipt.hosted.label, policy.label);
  assert.match(receipt.hosted.runId, new RegExp(policy.positiveDecimalPattern));
  assert.match(receipt.hosted.eventHead, new RegExp(sourcePolicy.gitCommitPattern));
  assert.deepEqual(receipt.priorNonSkippedRunIds, [hosted.runId]);
  assert.match(receipt.priorRunIdsSha256, new RegExp(policy.sha256Pattern));
  assert.match(receipt.publicationSha256, new RegExp(policy.sha256Pattern));
  assert.match(receipt.methodFilesDigest, new RegExp(policy.sha256Pattern));
  assert.equal(receipt.performanceAccepted, null); assert.equal(receipt.gateReevaluated, false);
}

/** @param {string} previousIdsFile - Actual authenticated API response filtered to non-skipped runs by the reviewed workflow. @param {string} output - New exclusive receipt. @returns {object} One real hosted consumption, never a retriable measurement instruction. */
function recordConsumption(previousIdsFile, output) {
  requireMode(policy.captureMode);
  const source = requirePublishedSource(); const hosted = hostedContext(source.profile.sourceCommit, policy.prepareJobKey);
  const stat = fs.lstatSync(previousIdsFile);
  assert.ok(stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1 && stat.size <= policy.maximumPriorRunIdsBytes);
  const ids = fs.readFileSync(previousIdsFile, 'utf8').trim().split(/\s+/).filter(Boolean);
  for (const id of ids) assert.match(id, new RegExp(policy.positiveDecimalPattern));
  assert.deepEqual(ids, [hosted.runId], 'Confirmation consumption: this workflow already has another execution; no relabel, retry or replacement is allowed');
  const receipt = { revision: policy.revision, consumed: true, creatorJobKey: policy.prepareJobKey, hosted,
    priorNonSkippedRunIds: ids, priorRunIdsSha256: hashFile(previousIdsFile), publicationSha256: source.publicationSha256,
    methodFilesDigest: filesDigest(source.files), performanceAccepted: null, gateReevaluated: false };
  validateReceipt(receipt, hosted); writeNewJSON(output, receipt); return receipt;
}

/** @param {object} source - Independently verified current publication. @param {object} hosted - Actual hosted criterion context. @returns {object} Validated receipt and its independently passed digest, without modifying the receipt. */
function requireConsumption(source, hosted) {
  requireMode(policy.captureMode);
  const filename = process.env[policy.consumptionEnvironment]; const expectedHash = process.env[policy.consumptionDigestEnvironment];
  assert.equal(typeof filename, 'string'); assert.match(expectedHash ?? '', new RegExp(policy.sha256Pattern));
  assert.equal(hashFile(filename), expectedHash, 'Confirmation consumption: receipt bytes changed');
  const receipt = readJSON(filename); validateReceipt(receipt, hosted);
  assert.equal(receipt.publicationSha256, source.publicationSha256); assert.equal(receipt.methodFilesDigest, filesDigest(source.files));
  return { receipt, sha256: expectedHash };
}

if (require.main === module) {
  try {
    assert.equal(process.argv.length, 5, 'Confirmation consumption: provide --record actual-prior-run-ids new-receipt');
    assert.equal(process.argv[2], '--record');
    const result = recordConsumption(process.argv[3], process.argv[4]); process.stdout.write(JSON.stringify(result) + '\n');
  } catch (error) { process.stderr.write(error.stack + '\n'); process.exitCode = worker.failureExitCode; }
}
module.exports = { validateReceipt, recordConsumption, requireConsumption };
