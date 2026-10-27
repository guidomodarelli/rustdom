/** @module confirmation-published-source Separates source inspection from independent scientific publication and actual hosted invocation. */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { inspectCurrentSource, ownedFile, filesDigest } = require('./source.cjs');
const { readJSON, hashFile } = require('../owner-batch-study/io.cjs');
const { criteria, population } = require('./calendar.cjs');
const { requireMode } = require('./binding.cjs');
const policy = require('./constants/capture.json');
const sourcePolicy = require('./constants/source.json');
const historicalPolicy = require('./constants/authentication.json');
const design = require('./constants/design.json');
const repository = path.resolve(__dirname, '../../../..');

/** @returns {object} Independent reviewed catalog/publication; the caller must still authenticate actual live source or snapshot bytes. */
function requirePublication() {
  requireMode(policy.captureMode);
  const catalogPath = ownedFile(repository, sourcePolicy.catalog);
  const catalog = readJSON(catalogPath);
  assert.equal(catalog.revision, policy.revision); assert.equal(catalog.executionReady, true);
  assert.equal(catalog.filesDigest, filesDigest(catalog.files));
  assert.deepEqual(catalog.criteria, criteria()); assert.deepEqual(catalog.population, population());
  assert.ok(catalog.files[sourcePolicy.captureWorkflow], 'Confirmation publication: capture workflow must be reviewed');
  const files = { ...catalog.files, [sourcePolicy.catalog]: hashFile(catalogPath) };
  const publicationPath = ownedFile(repository, sourcePolicy.publication);
  const publication = readJSON(publicationPath);
  assert.equal(publication.revision, policy.revision); assert.equal(publication.executionReady, true);
  assert.equal(publication.completeMethodReview, true); assert.equal(publication.actionableFindings, 0);
  assert.deepEqual(publication.files, files); assert.equal(publication.filesDigest, filesDigest(files));
  assert.equal(publication.performanceAccepted, null); assert.equal(publication.gateReevaluated, false);
  for (const [node, expectedHash] of Object.entries(design.nodeExecutableSha256)) {
    assert.equal(publication.qualification[node].passed, true);
    assert.equal(publication.qualification[node].nodeExecutableSha256, expectedHash);
  }
  return { files, publication, publicationSha256: hashFile(publicationPath), catalog };
}

/** @returns {object} Complete verified live producer plus unchanged inspection data; no role or dirty state is overwritten in that profile. */
function requirePublishedSource() {
  requireMode(policy.captureMode);
  const profile = inspectCurrentSource(repository, process.env[historicalPolicy.authenticationSourceEnvironment]);
  assert.equal(profile.sourceChangesRaw, '', 'Confirmation source: scientific producer must be clean');
  assert.deepEqual(profile.canonicalRuntimeIdentity.sourceChanges, []);
  const publication = requirePublication();
  assert.deepEqual(publication.catalog.files, profile.currentFiles);
  assert.equal(publication.catalog.filesDigest, profile.currentFilesSha256);
  return { profile, ...publication };
}

/** @param {string} sourceCommit - Actual native source HEAD. @param {string} [jobKey] - Declared prepare/criterion role. @returns {object} Actual trusted workflow context; never synthesized for local qualification. */
function hostedContext(sourceCommit, jobKey = policy.jobKey) {
  requireMode(policy.captureMode);
  assert.equal(process.env.GITHUB_ACTIONS, 'true'); assert.equal(process.env.GITHUB_RUN_ATTEMPT, '1');
  assert.equal(process.env.GITHUB_REPOSITORY, policy.repository); assert.equal(process.env.GITHUB_WORKFLOW, policy.workflowName);
  assert.ok([policy.prepareJobKey, policy.jobKey].includes(jobKey));
  assert.equal(process.env.GITHUB_JOB, jobKey); assert.equal(process.env.GITHUB_EVENT_NAME, 'pull_request');
  assert.equal(process.env[policy.expectedHeadEnvironment], sourceCommit);
  assert.equal(process.env[policy.pullRequestEnvironment], String(policy.pullRequest));
  assert.equal(process.env[policy.labelEnvironment], policy.label);
  assert.match(process.env.GITHUB_RUN_ID ?? '', new RegExp(policy.positiveDecimalPattern));
  const event = readJSON(process.env.GITHUB_EVENT_PATH);
  assert.equal(event.action, 'labeled'); assert.equal(event.label.name, policy.label);
  assert.equal(event.pull_request.number, policy.pullRequest);
  assert.equal(event.pull_request.head.sha, sourceCommit); assert.equal(event.pull_request.head.repo.full_name, policy.repository);
  return { repository: policy.repository, workflow: policy.workflowName, jobKey, attempt: 1,
    pullRequest: policy.pullRequest, label: policy.label, runId: process.env.GITHUB_RUN_ID, eventHead: sourceCommit };
}

module.exports = { requirePublication, requirePublishedSource, hostedContext };
