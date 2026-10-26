/** @module range-packages-preparation Assembles five independent, qualified packages without installing, compiling or measuring. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const identity = require('./identity.cjs');
const policy = require('./constants/packages.json');
const { assertRuntimeContext } = require('../cold-cleanup-study/preparation.cjs');
const repository = path.resolve(__dirname, '../../../..');

/** @param {string} filename - Caller-owned JSON destination. @param {object} value - Serializable data. @returns {void} */
function write(filename, value) { fs.writeFileSync(filename, JSON.stringify(value, null, 2) + '\n'); }

/**
 * Prepare a self-contained runtime set while preserving both original Git provenances.
 * @param {string} historicalRoot - Authenticated original cold preparation.
 * @param {string} candidateSource - Real Linux Git checkout of the published candidate patch on its base commit.
 * @param {string} destination - Fresh, disjoint output with an existing parent.
 * @returns {object} Complete package identity with no timing decision.
 * @throws {Error} Preserves partial output and rejects invalid provenance, bytes, links or destination.
 */
function prepare(historicalRoot, candidateSource, destination) {
  assertRuntimeContext();
  historicalRoot = fs.realpathSync.native(historicalRoot); candidateSource = fs.realpathSync.native(candidateSource);
  const output = path.join(fs.realpathSync.native(path.dirname(path.resolve(destination))), path.basename(destination));
  assert.ok(!fs.existsSync(output), 'Range packages: preserve existing preparation');
  for (const input of [repository, historicalRoot, candidateSource]) {
    assert.ok(output !== input && !output.startsWith(input + path.sep) && !input.startsWith(output + path.sep),
      'Range packages: output and original inputs must be disjoint');
  }
  const qualified = identity.qualification(); const previous = identity.historical(historicalRoot);
  const actualSource = identity.captureSourceIdentity(candidateSource);
  assert.equal(actualSource.sourceCommit, policy.candidateSourceCommit);
  assert.equal(actualSource.sourceHash, policy.candidateSourceHash);
  assert.deepEqual(actualSource.sourceChanges, policy.candidateSourceChanges); assert.deepEqual(actualSource.sourceGitErrors, []);
  assert.equal(actualSource.measuredSources.length, policy.candidateSourceFiles);
  assert.equal(identity.hash(path.join(candidateSource, policy.paths.package)), policy.packageSha256);
  assert.equal(identity.hash(path.join(candidateSource, policy.paths.lock)), policy.lockSha256);
  fs.mkdirSync(output);
  const index = { revision: policy.revision, complete: false, benchmarkExecuted: false, rustRebuilt: false,
    performanceAccepted: null, originalIdentity: previous.identity, actualCandidateSource: actualSource,
    hostedHead: qualified.summary.head, artifactId: policy.artifact.id, profile: policy.profile, files: {}, distributions: {} };
  const save = () => write(path.join(output, policy.paths.index), index); save();
  try {
    const packages = path.join(output, policy.paths.packages); fs.mkdirSync(packages);
    const command = spawnSync('python3', ['-B', path.join(__dirname, policy.paths.materializer), repository,
      path.join(packages, policy.candidateLabel)],
    { encoding: 'utf8', timeout: policy.materializeTimeoutMs, maxBuffer: policy.metadataOutputLimitBytes });
    fs.writeFileSync(path.join(output, 'materialize.stdout.log'), command.stdout ?? '');
    fs.writeFileSync(path.join(output, 'materialize.stderr.log'), command.stderr ?? '');
    assert.ifError(command.error); assert.equal(command.status, 0, command.stderr);
    write(path.join(output, policy.paths.artifactReceipt), JSON.parse(command.stdout));
    for (const label of policy.baselineLabels) {
      const target = path.join(packages, label); fs.mkdirSync(target);
      const parts = label.startsWith('J') ? policy.referenceDistributionParts : policy.nativeDistributionParts;
      for (const name of parts) fs.cpSync(path.join(previous.build, policy.paths.packages, label, name), path.join(target, name), { recursive: true });
    }
    fs.cpSync(path.join(previous.build, policy.paths.dependencies), path.join(output, policy.paths.dependencies),
      { recursive: true, verbatimSymlinks: true });
    for (const label of [...policy.baselineLabels, policy.candidateLabel]) {
      const target = path.join(packages, label);
      fs.symlinkSync('../../' + policy.paths.dependencies, path.join(target, policy.paths.dependencies), 'dir');
      const parts = label.startsWith('J') ? policy.referenceDistributionParts : policy.nativeDistributionParts;
      index.distributions[label] = identity.fingerprint(target, parts);
    }
    fs.cpSync(path.join(previous.build, policy.paths.baselineSources), path.join(output, policy.paths.baselineSources), { recursive: true });
    for (const name of actualSource.measuredSources) {
      const target = path.join(output, policy.paths.candidateSources, name); fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(path.join(candidateSource, name), target, fs.constants.COPYFILE_EXCL);
    }
    for (const part of [policy.paths.baselineSources, policy.paths.candidateSources]) {
      for (const entry of identity.fingerprint(output, [part]).files) index.files[entry.path] = entry.sha256;
    }
    index.dependencies = identity.fingerprint(output, [policy.paths.dependencies]);
    index.files[policy.paths.artifactReceipt] = identity.hash(path.join(output, policy.paths.artifactReceipt));
    index.links = identity.inspectLinks(output);
    assert.deepEqual(identity.historical(historicalRoot).identity, previous.identity);
    assert.deepEqual(identity.captureSourceIdentity(candidateSource), actualSource);
    identity.qualification(); index.complete = true; save();
    return identity.verify(output);
  } catch (error) {
    index.complete = false; index.failure = { message: error.message, stack: error.stack }; throw error;
  } finally { save(); }
}
if (require.main === module) {
  try {
    const operation = process.argv[2]; let result;
    if (operation === policy.operations.verify) {
      assert.equal(process.argv.length, 4); result = identity.verify(process.argv[3]);
    } else {
      assert.equal(operation, policy.operations.prepare); assert.equal(process.argv.length, 6);
      result = prepare(...process.argv.slice(3));
    }
    console.log(JSON.stringify(result));
  } catch (error) { console.error(`Range package preparation failed: ${error.stack}`); process.exitCode = 1; }
}
module.exports = { prepare, verify: identity.verify };
