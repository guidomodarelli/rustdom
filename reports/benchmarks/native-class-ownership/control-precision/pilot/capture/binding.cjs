/** @module pilot-capture-binding Binds a fresh child to its actual parent, SDK, criterion and reviewed source profile. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { readJSON, hashFile } = require('./io.cjs');
const { calendar } = require('../blocks.cjs');
const design = require('../constants/design.json');
const policy = require('../constants/capture.json');
const { repository, ownedPath, filesDigest } = require('./source.cjs');

/** @param {object} binding - Decoded parent declaration. @param {object} expected - Independently observed invocation/source values. @returns {void} Validate role, source and host declarations; no DOM is loaded. */
function validate(binding, expected) {
  assert.ok(binding && typeof binding === 'object' && !Array.isArray(binding));
  assert.equal(binding.revision, policy.revision);
  assert.ok(policy.modes.includes(expected.mode)); assert.equal(binding.mode, expected.mode);
  assert.equal(binding.parentPid, expected.parentPid); assert.ok(Number.isSafeInteger(binding.parentPid) && binding.parentPid > 0);
  assert.equal(binding.node, expected.node); assert.ok(Object.hasOwn(policy.nodeExecutables, binding.node));
  assert.equal(binding.nodeExecutable, expected.nodeExecutable);
  assert.equal(binding.nodeExecutableSha256, policy.nodeExecutables[binding.node]);
  assert.equal(binding.sourceDirectory, expected.sourceDirectory); assert.equal(binding.sourceCommit, expected.sourceCommit);
  assert.equal(binding.sourceCommit.length, policy.gitCommitHexLength); assert.match(binding.sourceCommit, new RegExp(policy.gitCommitPattern));
  assert.equal(binding.sourceFilesDigest, filesDigest(expected.files));
  assert.equal(binding.criterionId, expected.criterionId);
  const shard = calendar().find((entry) => entry.criterionId === binding.criterionId);
  assert.ok(shard && shard.node === binding.node);
  assert.equal(binding.plannedProcesses, binding.mode === policy.captureMode ? shard.processes.length :
    shard.processes.filter((input) => input.block < policy.functionalBlocks).length);
  assert.equal(binding.performanceAccepted, null); assert.equal(binding.gateReevaluated, false);
  if (binding.mode === policy.functionalMode) {
    assert.equal(binding.publicationSha256, null); assert.equal(binding.hosted, null);
    return;
  }
  assert.equal(policy.executionReady, true, 'Pilot binding: scientific method is not enabled');
  assert.equal(design.executionReady, true);
  assert.equal(binding.consumptionSha256, expected.consumptionSha256);
  assert.equal(typeof binding.consumptionSha256, 'string');
  assert.equal(binding.consumptionSha256.length, policy.sha256HexLength);
  assert.match(binding.consumptionSha256, new RegExp(policy.sha256Pattern));
  assert.equal(binding.publicationSha256.length, policy.sha256HexLength);
  assert.match(binding.publicationSha256, new RegExp(policy.sha256Pattern));
  assert.equal(binding.hosted.repository, policy.repository); assert.equal(binding.hosted.workflow, policy.workflowName);
  assert.equal(binding.hosted.jobKey, policy.jobKey); assert.equal(binding.hosted.attempt, 1);
  assert.equal(binding.hosted.label, policy.label); assert.equal(binding.hosted.eventHead, binding.sourceCommit);
  assert.equal(binding.hosted.pullRequest, policy.pullRequestNumber);
  assert.match(binding.hosted.runId, new RegExp(policy.positiveDecimalPattern));
}

/** @param {'functional'|'capture'} mode - Actual worker role. @returns {object|null} Verified binding, or no binding for standalone functional qualification. */
function childBinding(mode) {
  assert.ok(policy.modes.includes(mode));
  if (mode === policy.captureMode) {
    assert.equal(policy.executionReady, true, 'Pilot capture binding: published scientific method is not enabled');
    assert.equal(design.executionReady, true);
  }
  const filename = process.env[policy.bindingEnvironment];
  if (filename === undefined) {
    assert.equal(mode, policy.functionalMode, 'Pilot binding: capture requires an independent parent binding');
    return null;
  }
  assert.ok(fs.lstatSync(path.join(repository, '.git')).isDirectory(), 'Pilot binding: native Git checkout required');
  const binding = readJSON(filename);
  const commit = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: repository, encoding: 'utf8',
    timeout: policy.maximumMetadataCommandMs, maxBuffer: policy.maximumJSONBytes });
  assert.ifError(commit.error); assert.equal(commit.status, 0, commit.stderr);
  const files = mode === policy.functionalMode ? binding.sourceFiles : readJSON(ownedPath(repository, policy.catalog)).files;
  if (mode === policy.captureMode) files[policy.catalog] = hashFile(ownedPath(repository, policy.catalog));
  validate(binding, { mode, parentPid: process.ppid, node: process.version, nodeExecutable: fs.realpathSync(process.execPath),
    sourceDirectory: repository, sourceCommit: commit.stdout.trim(), files, criterionId: binding.criterionId,
    consumptionSha256: mode === policy.captureMode ? process.env[policy.consumptionDigestEnvironment] : undefined });
  for (const relative of policy.childCriticalFiles) {
    assert.equal(typeof files[relative], 'string');
    assert.equal(hashFile(ownedPath(repository, relative)), files[relative], 'Pilot binding: changed child implementation ' + relative);
  }
  if (mode === policy.captureMode) {
    assert.equal(hashFile(process.env[policy.consumptionEnvironment], policy.maximumJSONBytes, false), binding.consumptionSha256);
    assert.equal(process.env.GITHUB_ACTIONS, 'true'); assert.equal(process.env.GITHUB_RUN_ATTEMPT, '1');
    assert.equal(process.env.GITHUB_REPOSITORY, binding.hosted.repository);
    assert.equal(process.env.GITHUB_WORKFLOW, binding.hosted.workflow); assert.equal(process.env.GITHUB_JOB, binding.hosted.jobKey);
    assert.equal(process.env.GITHUB_RUN_ID, binding.hosted.runId);
    const publicationFile = ownedPath(repository, policy.publication);
    assert.equal(hashFile(publicationFile), binding.publicationSha256);
    const publication = readJSON(publicationFile);
    assert.equal(publication.executionReady, true); assert.equal(publication.completeMethodReview, true);
    assert.equal(publication.actionableFindings, 0); assert.deepEqual(publication.files, files);
  }
  return { sha256: hashFile(filename), parentPid: binding.parentPid, criterionId: binding.criterionId, revision: binding.revision };
}

module.exports = { validate, childBinding };
