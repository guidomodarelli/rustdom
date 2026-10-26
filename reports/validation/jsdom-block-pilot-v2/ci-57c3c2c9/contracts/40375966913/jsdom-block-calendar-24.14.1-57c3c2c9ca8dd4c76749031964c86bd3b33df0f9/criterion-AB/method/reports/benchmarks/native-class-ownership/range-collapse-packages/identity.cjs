/** @module range-packages-identity Authenticates prepared runtime bytes and their independently pinned provenance. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { fingerprint } = require('../paired-experiment.cjs');
const { inspectLinks } = require('../prepare-hosted-build.cjs');
const { captureSourceIdentity } = require('../../../../benchmarks/sources.cjs');
const policy = require('./constants/packages.json');
const oldPolicy = require('../cold-cleanup-transport/constants/transport.json');
const { replay } = require('../cold-cleanup-transport/replay.cjs');
const repository = path.resolve(__dirname, '../../../..');
const read = (filename) => JSON.parse(fs.readFileSync(filename, 'utf8'));
const hash = (filename) => createHash('sha256').update(fs.readFileSync(filename)).digest('hex');

/** @returns {object} Published functional qualification, keeping its original source metadata intact. */
function qualification() {
  assert.equal(hash(path.join(repository, policy.qualificationSourcePolicy)), policy.qualificationSourcePolicySha256);
  for (const entry of Object.values(policy.qualification)) assert.equal(hash(path.join(repository, entry.path)), entry.sha256);
  const summary = read(path.join(repository, policy.qualification['summary.json'].path));
  const review = read(path.join(repository, policy.qualification['review.json'].path));
  assert.equal(review.actionableFindings, 0); assert.equal(summary.completeFunctionalEvidence, true);
  assert.equal(summary.runId, policy.runId); assert.equal(summary.head, policy.hostedHead); assert.equal(summary.attempt, policy.attempt);
  assert.equal(summary.prospectivePerformanceBuildProfile, policy.profile);
  assert.equal(summary.performanceAccepted, null); assert.equal(summary.gateReevaluated, false);
  const selected = summary.profiles.find((profile) => profile.key === policy.profile);
  assert.equal(selected.nativeBuild.binarySha256, policy.binarySha256);
  assert.equal(selected.replayNode22MatchesNode24, true);
  assert.equal(selected.artifactPin.id, policy.artifact.id);
  return { summary, selected };
}

/**
 * Authenticate the original preparation without changing its packages or decision.
 * @param {string} directory - Previously extracted and preserved cold preparation.
 * @returns {object} Original five-package fingerprints, dependencies and source metadata.
 */
function historical(directory) {
  const verified = replay(directory);
  assert.equal(verified.identity.dependenciesSha256, policy.dependenciesSha256);
  const build = path.join(fs.realpathSync.native(directory), oldPolicy.replay.buildDirectory);
  const index = read(path.join(build, policy.paths.index));
  assert.equal(hash(path.join(build, oldPolicy.replay.packagesDirectory, policy.candidateLabel, 'package.json')), policy.packageSha256);
  assert.equal(hash(path.join(build, policy.paths.candidateSources, 'package-lock.json')), policy.lockSha256);
  return { build, identity: verified.identity, index };
}

/** @returns {object} Independent ledger derived from the pinned original ZIP, never from a resealable assembly index. */
function canonicalArtifact() {
  const command = spawnSync('python3', ['-B', path.join(__dirname, policy.paths.materializer), policy.operations.manifest, repository],
    { encoding: 'utf8', timeout: policy.materializeTimeoutMs, maxBuffer: policy.metadataOutputLimitBytes });
  assert.ifError(command.error); assert.equal(command.status, 0, command.stderr);
  return JSON.parse(command.stdout);
}

/**
 * Verify every prepared distribution, dependency, source snapshot and link without loading a runtime.
 * @param {string} directory - Independent package assembly.
 * @returns {object} Complete immutable preparation identity, never a performance decision.
 */
function verify(directory) {
  qualification();
  const root = fs.realpathSync.native(directory); const index = read(path.join(root, policy.paths.index));
  assert.equal(index.revision, policy.revision); assert.equal(index.complete, true);
  assert.equal(index.failure, undefined); assert.equal(index.rustRebuilt, false);
  assert.equal(index.benchmarkExecuted, false); assert.equal(index.performanceAccepted, null);
  assert.deepEqual(index.links, policy.expectedLinks);
  assert.deepEqual(inspectLinks(root), policy.expectedLinks, 'Range packages: runtime resolution links differ from the independent graph');
  assert.deepEqual(index.originalIdentity, oldPolicy.preparationIdentity);
  assert.equal(index.artifactId, policy.artifact.id); assert.equal(index.hostedHead, policy.hostedHead);
  assert.equal(index.actualCandidateSource.sourceCommit, policy.candidateSourceCommit);
  assert.equal(index.actualCandidateSource.sourceHash, policy.candidateSourceHash);
  assert.deepEqual(index.actualCandidateSource.sourceChanges, policy.candidateSourceChanges);
  assert.deepEqual(index.actualCandidateSource.sourceGitErrors, []);
  assert.equal(index.actualCandidateSource.measuredSources.length, policy.candidateSourceFiles);
  assert.deepEqual(fingerprint(root, [policy.paths.dependencies]), index.dependencies);
  assert.equal(index.dependencies.sha256, policy.dependenciesSha256);
  assert.deepEqual(Object.keys(index.distributions).sort(), [...policy.baselineLabels, policy.candidateLabel].sort());
  const canonical = canonicalArtifact();
  const selectedFiles = new Map(canonical.selectedFiles.map((entry) => [entry.path, entry]));
  for (const [label, recorded] of Object.entries(index.distributions)) {
    const current = path.join(root, policy.paths.packages, label);
    const parts = label.startsWith('J') ? policy.referenceDistributionParts : policy.nativeDistributionParts;
    assert.deepEqual(fingerprint(current, parts), recorded);
    for (const entry of recorded.files) assert.ok(fs.lstatSync(path.join(current, entry.path)).isFile(), 'Range packages: runtime members must be regular files');
    assert.equal(fs.readlinkSync(path.join(current, policy.paths.dependencies)), '../../' + policy.paths.dependencies);
    assert.equal(fs.realpathSync.native(path.join(current, policy.paths.dependencies)), path.join(root, policy.paths.dependencies));
    if (label !== policy.candidateLabel) assert.equal(recorded.sha256, oldPolicy.preparationIdentity.distributions[label]);
    else {
      assert.equal(recorded.sha256, policy.candidateDistributionSha256);
      const native = read(path.join(current, 'dist/native-build.json'));
      assert.equal(hash(path.join(current, 'dist/rustdom.node')), policy.binarySha256);
      assert.equal(native.binarySha256, policy.binarySha256); assert.equal(native.node, policy.expectedNativeNode);
      assert.equal(hash(path.join(current, 'package.json')), policy.packageSha256);
      assert.equal(hash(path.join(current, 'package-lock.json')), policy.lockSha256);
      assert.equal(recorded.files.length, policy.candidateDistributionFiles);
      for (const entry of recorded.files) {
        const expected = selectedFiles.get(entry.path);
        assert.ok(expected); assert.equal(entry.bytes, expected.bytes); assert.equal(entry.sha256, expected.sha256);
      }
    }
  }
  const receipt = read(path.join(root, policy.paths.artifactReceipt));
  assert.deepEqual(receipt, canonical, 'Range packages: materialization receipt differs from the independent original artifact');
  for (const entry of receipt.selectedFiles) {
    const filename = path.join(root, policy.paths.packages, policy.candidateLabel, entry.path);
    assert.ok(fs.lstatSync(filename).isFile());
    assert.equal(fs.statSync(filename).size, entry.bytes); assert.equal(hash(filename), entry.sha256);
  }
  for (const [name, expected] of Object.entries(index.files)) {
    const filename = path.resolve(root, name);
    assert.ok(filename.startsWith(root + path.sep)); assert.equal(hash(filename), expected);
  }
  for (const [label, name] of [['A', policy.paths.baselineSources], ['B', policy.paths.candidateSources]]) {
    const current = captureSourceIdentity(path.join(root, name));
    assert.equal(current.sourceHash, label === 'A' ? oldPolicy.preparationIdentity.inputs.sources.A : policy.candidateSourceHash);
    // Snapshot Git metadata describes its transport location; original Git provenance remains separately preserved above.
    assert.ok(current.measuredSources.length > 0);
  }
  return { verified: true, revision: policy.revision, originalIdentity: index.originalIdentity,
    sourceHashes: { A: oldPolicy.preparationIdentity.inputs.sources.A, B: policy.candidateSourceHash },
    distributions: Object.fromEntries(Object.entries(index.distributions).map(([label, value]) => [label, value.sha256])),
    binarySha256: policy.binarySha256, dependenciesSha256: index.dependencies.sha256,
    artifactId: policy.artifact.id, benchmarkExecuted: false, rustRebuilt: false, performanceAccepted: null };
}
module.exports = { qualification, historical, verify, hash, read, fingerprint, inspectLinks, captureSourceIdentity, canonicalArtifact };
