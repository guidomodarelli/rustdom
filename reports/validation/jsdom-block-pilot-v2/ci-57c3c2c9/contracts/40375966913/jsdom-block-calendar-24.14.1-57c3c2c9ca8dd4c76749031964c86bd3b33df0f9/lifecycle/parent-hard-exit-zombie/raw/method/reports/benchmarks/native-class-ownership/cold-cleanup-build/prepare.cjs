/** @module cold-cleanup-preparation Builds and reads packages without a performance sequence. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const producer = require('../prepare-hosted-build.cjs');
const { captureSourceIdentity } = require('../../../../benchmarks/sources.cjs');
const { captureInputs } = require('./inputs.cjs');
const recipe = require('./constants/protocol.cjs');
const policy = require('./constants/inputs.json');
const repository = path.resolve(__dirname, '../../../..');
/** Computes a file's SHA256. @param {string} filename - Actual file. @returns {string} Digest of its bytes. */
const hash = (filename) => createHash('sha256').update(fs.readFileSync(filename)).digest('hex');

/**
 * Applies the published patch only to the clean real checkout declared by policy.
 * @param {string} candidate - Owned source checkout to change.
 * @returns {object} Actual before/after identities and patch digest.
 * @throws {Error} When Git identity, inputs or patch application differs.
 */
function applyCandidatePatch(candidate) {
  const root = fs.realpathSync(candidate);
  const before = captureSourceIdentity(root);
  assert.equal(before.sourceHash, policy.unpatchedSourceHash, 'Cold cleanup patch: unpatched sources differ');
  assert.equal(before.sourceCommit, policy.candidateCommit, 'Cold cleanup patch: checkout commit differs');
  assert.deepEqual(before.sourceChanges, [], 'Cold cleanup patch: preserve existing source changes');
  assert.deepEqual(before.sourceGitErrors, [], 'Cold cleanup patch: real Git identity is required');
  assert.equal(hash(path.join(root, policy.guardPath)), policy.unpatchedGuardSha256);
  const patch = path.join(repository, policy.patchPath);
  assert.equal(hash(patch), policy.patchSha256, 'Cold cleanup patch: published patch changed');
  for (const arguments_ of [['apply', '--check', patch], ['apply', patch]]) {
    const result = spawnSync('git', arguments_, { cwd: root, encoding: 'utf8', timeout: recipe.validationTimeoutMs });
    assert.ifError(result.error);
    assert.equal(result.status, 0, `Cold cleanup patch: git ${arguments_[0]} failed: ${result.stderr}`);
  }
  const after = captureSourceIdentity(root);
  assert.equal(after.sourceHash, policy.candidateSourceHash, 'Cold cleanup patch: resulting sources differ');
  assert.equal(hash(path.join(root, policy.guardPath)), policy.candidateGuardSha256);
  return { revision: policy.revision, patchSha256: policy.patchSha256, before, after,
    measurementExecuted: false, performanceAccepted: null };
}

/**
 * Requires archived producer sources to match the current reviewed code, even after resealing an index.
 * @param {string} directory - Preserved build to inspect without executing its code.
 * @returns {void} No value when every declared source matches.
 * @throws {Error} When a named archived preparation source differs.
 */
function verifyMethodSources(directory) {
  for (const name of recipe.preparationFiles) {
    assert.equal(hash(path.join(directory, policy.archive.sources, name)), hash(path.join(repository, name)),
      `Cold cleanup build: archived preparation source differs: ${name}`);
  }
}

/**
 * Inspects actual packages and method provenance without loading a DOM.
 * @param {string} directory - Complete prepared build.
 * @returns {object} Verified identity with performanceAccepted=null.
 * @throws {Error} When packages, build inputs or method identity differ.
 */
function verify(directory) {
  const identity = producer.verify(directory, { recipe, captureInputs });
  verifyMethodSources(directory);
  return identity;
}

/**
 * Builds fresh packages through the existing producer and retains its partials on failure.
 * @param {string} baseline - Independent fixed baseline checkout without dist.
 * @param {string} candidate - Independent patched candidate checkout without dist.
 * @param {string} output - New owned output outside either source tree.
 * @returns {object} Verified preparation identity without timing acceptance.
 * @throws {Error} When inputs, toolchain, compilation or final integrity fail.
 */
function prepare(baseline, candidate, output) {
  producer.prepare(baseline, candidate, output, { recipe, captureInputs });
  return verify(output);
}

if (require.main === module) {
  try {
    const operation = process.argv[2];
    const result = operation === policy.operations.verify ? verify(process.argv[3])
      : operation === policy.operations.patch ? applyCandidatePatch(process.argv[3]) : prepare(...process.argv.slice(2));
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) { process.stderr.write(`${error.stack}\n`); process.exitCode = policy.failureExitCode; }
}
module.exports = { applyCandidatePatch, prepare, verify, verifyFunctionalReport: producer.verifyFunctionalReport };
