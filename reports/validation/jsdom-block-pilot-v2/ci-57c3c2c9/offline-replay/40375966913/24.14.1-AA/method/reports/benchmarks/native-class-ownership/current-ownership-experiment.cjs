/** @file Uses the existing complete ownership experiment with an independently authenticated current preparation. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const producer = require('./prepare-current-hosted-build.cjs');
const { captureCurrentInputs } = require('./current-build-inputs.cjs');
const { captureSourceIdentity } = require('../../../benchmarks/sources.cjs');
const { createSinglePackageStudy } = require('./single-package-experiment.cjs');
const { runStudyCli } = require('./paired-main-experiment.cjs');
const settings = require('./constants/current-ownership.cjs');
const method = require('./constants/current-ownership-study.cjs');
const policy = require('./constants/current-ownership.json');
const recipe = require('./constants/current-hosted-build.cjs');
const repository = path.resolve(__dirname, '../../..');
const digest = (filename) => createHash('sha256').update(fs.readFileSync(filename)).digest('hex');

/**
 * Authenticate the complete preparation, its real public probes and the exact current runtime.
 * This reads metadata and packaged files; it never loads the DOM or collects samples.
 * @param {string} directory - Extracted original preparation with the two original functional reports beside it.
 * @returns {object} Independently verified pinned preparation identity.
 */
function inspectPreparation(directory) {
  assert.ok(settings.nodeVersions.includes(process.version), 'Current ownership: unsupported Node version');
  assert.equal(process.platform, recipe.platform, 'Current ownership: platform differs');
  assert.equal(process.arch, recipe.arch, 'Current ownership: architecture differs');
  assert.equal(process.report.getReport().header.glibcVersionRuntime, recipe.glibc, 'Current ownership: libc differs');
  assert.equal(digest(process.execPath), policy.runtimeExecutableHashes[process.version], 'Current ownership: Node executable differs');
  for (const name of recipe.forbiddenEnvironment) assert.ok(!process.env[name], `Current ownership: undeclared ${name}`);
  for (const name of Object.keys(process.env)) {
    if (recipe.absoluteDirectoryEnvironment.includes(name)) {
      if (process.env[name]) assert.ok(path.isAbsolute(process.env[name]), `Current ownership: ${name} must be absolute`);
    } else if (recipe.forbiddenEnvironmentPrefixes.some((prefix) => name.startsWith(prefix))) {
      assert.ok(!process.env[name], `Current ownership: undeclared ${name}`);
    }
  }
  const root = fs.realpathSync(directory);
  const identity = producer.verify(root);
  assert.deepEqual(identity, method.preparation.identity, 'Current ownership: preparation differs from the declared artifact');
  assert.equal(captureSourceIdentity(repository).sourceHash, policy.candidateSourceHash,
    'Current ownership: current implementation differs from the prepared candidate');
  assert.deepEqual(captureCurrentInputs(path.join(root, 'baseline-sources'), repository), identity.inputs,
    'Current ownership: current source/build inputs differ from the prepared candidate');
  for (const [name, expected] of Object.entries(policy.functionalReportHashes)) {
    const filename = path.join(path.dirname(root), name);
    assert.equal(digest(filename), expected, `Current ownership: original public probe changed: ${name}`);
    producer.verifyFunctionalReport(JSON.parse(fs.readFileSync(filename, 'utf8')), identity);
  }
  return identity;
}

/**
 * Select the five physical packages without building or loading them.
 * @param {string} directory - Complete authenticated original preparation.
 * @returns {object} Manifest consumed by the unchanged sampler and offline verifier.
 */
function createManifest(directory) {
  const root = fs.realpathSync(directory);
  const identity = inspectPreparation(root);
  const index = JSON.parse(fs.readFileSync(path.join(root, 'index.json'), 'utf8'));
  return { roots: { A: path.join(root, 'baseline-sources'), B: path.join(root, 'sources') },
    copies: Object.fromEntries(Object.keys(settings.distributionHashes).map((label) => [label, path.join(root, 'packages', label)])),
    distributions: index.distributions, referenceVersion: recipe.referenceVersion,
    preparation: method.preparation, preparationBefore: identity };
}

const study = createSinglePackageStudy({ settings, method, preparation: { inspectPreparation, createManifest } });
if (require.main === module) {
  if (process.argv[2] === '--inspect') {
    try { process.stdout.write(`${JSON.stringify(inspectPreparation(process.argv[3]))}\n`); }
    catch (error) { process.stderr.write(`${error.stack}\n`); process.exitCode = 2; }
  } else runStudyCli(study);
}
module.exports = { ...study, createManifest };
