/** @module range-study-preparation Authenticates the exact independently qualified package archive without loading DOM. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const packages = require('../range-collapse-packages/identity.cjs');
const recipe = require('../range-collapse-packages/constants/packages.json');
const identity = require('./constants/identity.json');
const policy = require('./constants/protocol.json');
const repository = path.resolve(__dirname, '../../../..');

/** @returns {object} Independently pinned complete preparation, preserving both original source provenances. */
function verifyQualification() {
  packages.qualification();
  for (const [name, expected] of Object.entries(policy.packageEvidencePins)) {
    assert.equal(packages.hash(path.join(repository, policy.packageEvidenceDirectory, name)), expected);
  }
  const review = packages.read(path.join(repository, policy.packageEvidenceDirectory, 'review.json'));
  assert.equal(review.actionableFindings, 0);
  assert.equal(packages.hash(path.join(repository, policy.archive.path)), policy.archive.sha256);
  assert.equal(fs.statSync(path.join(repository, policy.archive.path)).size, policy.archive.bytes);
  return packages.read(path.join(repository, policy.packageEvidenceDirectory, 'preparation.json'));
}

/**
 * Build a sampler manifest from the exact extracted archive, without changing recorded identities.
 * @param {string} directory - Independently extracted package root.
 * @returns {object} Complete real paths, distributions and immutable provenance.
 */
function createManifest(directory) {
  const original = verifyQualification(); const checked = packages.verify(directory);
  const root = fs.realpathSync.native(directory);
  const index = packages.read(path.join(root, recipe.paths.index));
  assert.deepEqual(index, original, 'Range study: complete package metadata differs from the independently qualified archive');
  assert.deepEqual(checked.distributions, identity.distributions);
  assert.deepEqual(checked.sourceHashes, identity.inputs.sources);
  assert.equal(checked.dependenciesSha256, identity.dependenciesSha256);
  assert.equal(checked.binarySha256, identity.binarySha256);
  assert.deepEqual(index.actualCandidateSource, identity.actualCandidateSource);
  assert.deepEqual(index.originalIdentity, identity.originalIdentity);
  return { roots: { A: path.join(root, recipe.paths.baselineSources), B: path.join(root, recipe.paths.candidateSources) },
    copies: Object.fromEntries(Object.keys(identity.distributions).map((label) => [label, path.join(root, recipe.paths.packages, label)])),
    distributions: index.distributions, referenceVersion: require('../constants/hosted-build.cjs').referenceVersion,
    preparation: { archiveSha256: policy.archive.sha256, hostedHead: identity.hostedHead, artifactId: identity.artifactId, identity },
    preparationBefore: identity };
}
module.exports = { verifyQualification, createManifest, assertRuntimeContext: require('../cold-cleanup-study/preparation.cjs').assertRuntimeContext };
