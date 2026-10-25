/** @module owner-batch-binding Binds direct child invocations to actual parent provenance, fixed SDK and reviewed producer bytes. */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { readJSON, hashFile } = require('./io.cjs');
const policy = require('./constants/capture.json');
const repository = path.resolve(__dirname, '../../../..');

/** @param {object} files - Independently declared relative source hashes. @returns {string} Stable graph digest, without accepting data-provided code. */
function filesDigest(files) {
  return createHash('sha256').update(JSON.stringify(Object.fromEntries(Object.entries(files).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)))).digest('hex');
}

/** @param {object} binding - Scalar method binding. @param {object} expected - Independent source/invocation context. @returns {void} Match every SDK, parent, role and published-source declaration. */
function validate(binding, expected) {
  assert.equal(binding.revision, policy.revision);
  assert.ok(['functional', 'capture'].includes(binding.mode)); assert.equal(binding.mode, expected.mode);
  assert.equal(binding.sourceDirectory, expected.sourceDirectory);
  assert.equal(binding.node, expected.node); assert.equal(binding.parentPid, expected.parentPid);
  assert.match(binding.sourceCommit, /^[a-f0-9]{40}$/);
  assert.equal(binding.sourceCommit, expected.sourceCommit);
  assert.equal(binding.sourceFilesDigest, filesDigest(expected.files));
  assert.equal(binding.performanceAccepted, null); assert.equal(binding.gateReevaluated, false);
  if (binding.mode === 'capture') {
    assert.equal(policy.executionReady, true); assert.match(binding.publicationSha256, /^[a-f0-9]{64}$/);
    assert.equal(binding.hosted.repository, policy.repository); assert.equal(binding.hosted.workflow, policy.workflowName);
    assert.equal(binding.hosted.jobKey, policy.jobKey); assert.equal(binding.hosted.attempt, 1);
    assert.equal(binding.hosted.eventHead, binding.sourceCommit); assert.equal(binding.hosted.label, policy.label);
    assert.equal(binding.hosted.pullRequest, 80); assert.match(binding.hosted.runId, /^[1-9][0-9]*$/);
  } else { assert.equal(binding.publicationSha256, null); assert.equal(binding.hosted, null); }
}

/** @param {'functional'|'capture'} mode - Actual child role. @returns {object|null} Verified live binding, or no binding for standalone functional unit tests. */
function childBinding(mode) {
  const filename = process.env[policy.bindingEnvironment];
  if (filename === undefined) { assert.equal(mode, 'functional', 'Owner batch binding: scientific worker requires its parent binding'); return null; }
  const catalog = readJSON(path.join(repository, policy.catalog));
  const files = { ...catalog.files, [policy.catalog]: hashFile(path.join(repository, policy.catalog)) };
  const binding = readJSON(filename);
  assert.ok(fs.lstatSync(path.join(repository, '.git')).isDirectory(), 'Owner batch binding: native Git checkout required');
  const commit = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: repository, encoding: 'utf8',
    timeout: policy.maximumMetadataCommandMs, maxBuffer: policy.maximumMetadataOutputBytes });
  assert.ifError(commit.error); assert.equal(commit.status, 0, commit.stderr);
  validate(binding, { mode, sourceDirectory: repository, sourceCommit: commit.stdout.trim(), node: process.version, parentPid: process.ppid, files });
  for (const relative of [policy.workerFile, 'reports/benchmarks/native-class-ownership/owner-batch-study/batches.cjs',
    'reports/benchmarks/native-class-ownership/owner-batch-study/constants/sampler.json']) {
    assert.equal(hashFile(path.join(repository, relative)), files[relative], 'Owner batch binding: changed child implementation ' + relative);
  }
  if (mode === 'capture') {
    assert.equal(process.env.GITHUB_ACTIONS, 'true'); assert.equal(process.env.GITHUB_RUN_ATTEMPT, '1');
    assert.equal(process.env.GITHUB_REPOSITORY, binding.hosted.repository); assert.equal(process.env.GITHUB_WORKFLOW, binding.hosted.workflow);
    assert.equal(process.env.GITHUB_JOB, binding.hosted.jobKey); assert.equal(process.env.GITHUB_RUN_ID, binding.hosted.runId);
    assert.equal(hashFile(path.join(repository, policy.publication)), binding.publicationSha256);
    const publication = readJSON(path.join(repository, policy.publication));
    assert.equal(publication.actionableFindings, 0); assert.equal(publication.executionReady, true); assert.deepEqual(publication.files, files);
  }
  return { sha256: hashFile(filename), parentPid: binding.parentPid };
}
module.exports = { filesDigest, validate, childBinding };
