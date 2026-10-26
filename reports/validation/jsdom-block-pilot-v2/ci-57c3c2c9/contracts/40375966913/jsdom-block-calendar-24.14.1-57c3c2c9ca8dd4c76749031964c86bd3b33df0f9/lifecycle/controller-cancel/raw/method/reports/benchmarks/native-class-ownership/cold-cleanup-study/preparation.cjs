/** @module cold-study-preparation Authenticates the exact qualified hosted packages without loading DOM code. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const replay = require('../cold-cleanup-transport/replay.cjs');
const transport = require('../cold-cleanup-transport/constants/transport.json');
const buildPolicy = require('../cold-cleanup-build/constants/inputs.json');
const recipe = require('../cold-cleanup-build/constants/protocol.cjs');
const policy = require('./constants/protocol.json');
const repository = path.resolve(__dirname, '../../../..');
const hash = (filename) => createHash('sha256').update(fs.readFileSync(filename)).digest('hex');
const read = (filename) => JSON.parse(fs.readFileSync(filename, 'utf8'));

/**
 * Reads the immutable functional qualification and retains actual Git metadata.
 * @returns {object} Authenticated summary and source identity.
 * @throws {Error} When the independent qualification or its reviewed identity differs.
 */
function verifyQualification() {
  assert.equal(hash(path.join(repository, policy.transportPolicy.path)), policy.transportPolicy.sha256);
  for (const entry of Object.values(policy.qualifiedEvidence)) assert.equal(hash(path.join(repository, entry.path)), entry.sha256);
  const summary = read(path.join(repository, policy.qualifiedEvidence.summary.path));
  const review = read(path.join(repository, policy.qualifiedEvidence.review.path));
  const source = read(path.join(repository, policy.qualifiedEvidence.source.path));
  assert.equal(review.actionableFindings, 0);
  assert.equal(summary.artifactRunId, transport.runId); assert.equal(summary.artifactId, transport.artifactId);
  assert.equal(Object.keys(summary.suiteCommands).length, policy.functionalCommandCount);
  for (const command of Object.values(summary.suiteCommands)) assert.equal(command.exitCode, 0);
  assert.equal(source.sourceCommit, buildPolicy.candidateCommit);
  assert.equal(source.sourceHash, buildPolicy.candidateSourceHash);
  assert.deepEqual(source.sourceChanges, [` M ${buildPolicy.guardPath}`]); assert.deepEqual(source.sourceGitErrors, []);
  assert.equal(summary.performanceAccepted, null); assert.equal(summary.benchmarkExecuted, false);
  return { summary, source };
}

/**
 * Selects the five already-built packages and authenticates their actual files.
 * @param {string} directory - Root extracted by the current safe transport reader.
 * @returns {object} Manifest for the existing sampler, with original source provenance untouched.
 * @throws {Error} When any package, probe or qualification differs from its independent pin.
 */
function createManifest(directory) {
  const qualified = verifyQualification();
  const checked = replay.replay(directory);
  assert.equal(qualified.summary.candidateBinarySha256, checked.binarySha256.B);
  const root = path.join(fs.realpathSync(directory), transport.replay.buildDirectory);
  const index = read(path.join(root, buildPolicy.archive.index));
  return { roots: { A: path.join(root, 'baseline-sources'), B: path.join(root, 'sources') },
    copies: Object.fromEntries(Object.keys(checked.identity.distributions).map((label) => [label, path.join(root, transport.replay.packagesDirectory, label)])),
    distributions: index.distributions, referenceVersion: recipe.referenceVersion,
    preparation: { runId: transport.runId, artifactId: transport.artifactId, attempt: transport.attempt,
      sourceCommit: transport.head, identity: checked.identity }, preparationBefore: checked.identity };
}

/**
 * Enforces the original hosted platform and environment before a timing sequence.
 * @returns {void} No value when the current process matches the declared platform.
 * @throws {Error} When host, libc, runtime or startup environment differs.
 */
function assertRuntimeContext() {
  assert.equal(process.platform, recipe.platform); assert.equal(process.arch, recipe.arch);
  assert.equal(process.report.getReport().header.glibcVersionRuntime, recipe.glibc);
  const runtimeHashes = require('../constants/current-ownership.json').runtimeExecutableHashes;
  assert.equal(hash(process.execPath), runtimeHashes[process.version], 'Cold study: unsupported Node executable');
  for (const name of recipe.forbiddenEnvironment) assert.ok(!process.env[name], `Cold study: undeclared ${name}`);
  for (const name of Object.keys(process.env)) {
    if (recipe.absoluteDirectoryEnvironment.includes(name)) {
      if (process.env[name]) assert.ok(path.isAbsolute(process.env[name]), `Cold study: ${name} must be absolute`);
    } else if (recipe.forbiddenEnvironmentPrefixes.some((prefix) => name.startsWith(prefix))) {
      assert.ok(!process.env[name], `Cold study: undeclared ${name}`);
    }
  }
}
module.exports = { createManifest, verifyQualification, assertRuntimeContext };
