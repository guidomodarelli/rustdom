/** @module combined-range-baselines Copies authenticated controls and dependencies without loading a runtime. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const previous = require('../range-collapse-study/preparation.cjs');
const originalCompiler = require('../cold-cleanup-build/constants/inputs.json');
const { fingerprint, inspectLinks, captureSourceIdentity } = require('../range-collapse-packages/identity.cjs');
const policy = require('./constants/baselines.json');
const repository = path.resolve(__dirname, '../../../..');
const hash = (filename) => createHash('sha256').update(fs.readFileSync(filename)).digest('hex');
const read = (filename) => JSON.parse(fs.readFileSync(filename, 'utf8'));

/** @returns {object} Independently pinned historical identity; never a recalculated local index alone. */
function canonical() {
  assert.equal(hash(path.join(repository, policy.methodReceipt.path)), policy.methodReceipt.sha256);
  const receipt = read(path.join(repository, policy.methodReceipt.path));
  assert.equal(Object.keys(receipt.files).length, policy.methodReceipt.files);
  for (const [relative, expected] of Object.entries(receipt.files)) {
    assert.equal(hash(path.join(repository, relative)), expected, 'Combined baselines: changed historical method ' + relative);
  }
  assert.equal(hash(path.join(repository, policy.archive.path)), policy.archive.sha256);
  const original = previous.verifyQualification();
  assert.equal(original.originalIdentity.inputs.sources.A, policy.baselineSourceHash);
  assert.equal(policy.baselineCompilerCommit, originalCompiler.baselineCommit);
  assert.equal(policy.baselineCompilerTagObject, originalCompiler.baselineTagObject);
  return original.originalIdentity;
}

/** @param {string} root - Complete baseline-only tree. @returns {object} Current authenticated payload and actual snapshot Git metadata. */
function payload(root) {
  assert.deepEqual(inspectLinks(root), policy.expectedLinks, 'Combined baselines: changed runtime-resolution links');
  assert.deepEqual(fs.readdirSync(path.join(root, policy.paths.packages)).sort(), [...policy.labels].sort());
  const distributions = {};
  for (const label of policy.labels) {
    const directory = path.join(root, policy.paths.packages, label);
    const parts = label.startsWith('J') ? policy.referenceParts : policy.nativeParts;
    const current = fingerprint(directory, parts);
    assert.equal(current.sha256, policy.distributions[label], 'Combined baselines: changed distribution ' + label);
    for (const entry of current.files) {
      const status = fs.lstatSync(path.join(directory, entry.path));
      assert.ok(status.isFile(), 'Combined baselines: regular runtime files required');
      assert.equal(status.nlink, 1, 'Combined baselines: independently owned runtime files required');
    }
    distributions[label] = current;
  }
  const dependencies = fingerprint(root, [policy.paths.dependencies]);
  assert.equal(dependencies.sha256, policy.dependenciesSha256, 'Combined baselines: changed dependencies');
  const sources = captureSourceIdentity(path.join(root, policy.paths.sources));
  assert.equal(sources.sourceHash, policy.baselineSourceHash, 'Combined baselines: changed baseline source snapshot');
  return { distributions, dependencies, sourceTransportIdentity: sources };
}

/**
 * Verify every copied control, dependency, source and link against the original qualified preparation.
 * @param {string} directory - Baseline-only output, never a candidate or a performance result.
 * @returns {object} Byte identity and actual snapshot provenance; no DOM has been loaded.
 */
function verify(directory) {
  const historicalIdentity = canonical();
  const root = fs.realpathSync.native(directory);
  const index = read(path.join(root, policy.paths.index));
  assert.equal(index.revision, policy.revision); assert.equal(index.complete, true);
  assert.equal(index.failure, undefined);
  assert.equal(index.runtimeExecuted, false); assert.equal(index.benchmarkExecuted, false);
  assert.equal(index.installExecuted, false); assert.equal(index.rustRebuilt, false);
  assert.equal(index.performanceAccepted, null); assert.equal(index.gateReevaluated, false);
  assert.deepEqual(index.historicalIdentity, historicalIdentity);
  assert.deepEqual(index.archive, policy.archive);
  assert.deepEqual(index.baselineCompilerProvenance,
    { commit: policy.baselineCompilerCommit, tagObject: policy.baselineCompilerTagObject });
  const actual = payload(root);
  assert.deepEqual(actual.distributions, index.distributions);
  assert.deepEqual(actual.dependencies, index.dependencies);
  assert.deepEqual(actual.sourceTransportIdentity, index.sourceTransportIdentity,
    'Combined baselines: preserve the actual transported snapshot Git metadata');
  return { verified: true, revision: policy.revision, historicalIdentity,
    distributions: Object.fromEntries(Object.entries(actual.distributions).map(([label, value]) => [label, value.sha256])),
    dependenciesSha256: actual.dependencies.sha256, sourceHash: actual.sourceTransportIdentity.sourceHash,
    sourceTransportIdentity: actual.sourceTransportIdentity, baselineCompilerProvenance: index.baselineCompilerProvenance,
    runtimeExecuted: false, benchmarkExecuted: false, performanceAccepted: null, gateReevaluated: false };
}

/**
 * Prepare independent controls for a future candidate assembly, preserving all historical files and identities.
 * @param {string} historicalRoot - Previously qualified complete range-collapse package tree.
 * @param {string} destination - Fresh, disjoint baseline-only directory with an existing parent.
 * @returns {object} Verified subset; there is deliberately no candidate B or active study.
 */
function prepare(historicalRoot, destination) {
  assert.equal(process.platform, 'linux', 'Combined baselines: prepare Linux package links on Linux');
  historicalRoot = fs.realpathSync.native(historicalRoot);
  const output = path.join(fs.realpathSync.native(path.dirname(path.resolve(destination))), path.basename(destination));
  assert.equal(fs.lstatSync(output, { throwIfNoEntry: false }), undefined, 'Combined baselines: preserve existing destination');
  for (const input of [repository, historicalRoot]) {
    assert.ok(output !== input && !output.startsWith(input + path.sep) && !input.startsWith(output + path.sep),
      'Combined baselines: output overlaps protected input');
  }
  const historicalIdentity = canonical();
  const original = previous.createManifest(historicalRoot);
  assert.deepEqual(original.preparation.identity.originalIdentity, historicalIdentity);
  fs.mkdirSync(output);
  const index = { revision: policy.revision, complete: false, archive: policy.archive, historicalIdentity,
    baselineCompilerProvenance: { commit: policy.baselineCompilerCommit, tagObject: policy.baselineCompilerTagObject },
    runtimeExecuted: false, benchmarkExecuted: false, installExecuted: false, rustRebuilt: false,
    performanceAccepted: null, gateReevaluated: false };
  const save = () => fs.writeFileSync(path.join(output, policy.paths.index), JSON.stringify(index, null, 2) + '\n');
  save();
  try {
    fs.mkdirSync(path.join(output, policy.paths.packages));
    for (const label of policy.labels) {
      const target = path.join(output, policy.paths.packages, label); fs.mkdirSync(target);
      const parts = label.startsWith('J') ? policy.referenceParts : policy.nativeParts;
      for (const relative of parts) {
        fs.cpSync(path.join(historicalRoot, policy.paths.packages, label, relative), path.join(target, relative),
          { recursive: true, verbatimSymlinks: true, force: false, errorOnExist: true });
      }
      fs.symlinkSync('../../' + policy.paths.dependencies, path.join(target, policy.paths.dependencies), 'dir');
    }
    for (const relative of [policy.paths.dependencies, policy.paths.sources]) {
      fs.cpSync(path.join(historicalRoot, relative), path.join(output, relative),
        { recursive: true, verbatimSymlinks: true, force: false, errorOnExist: true });
    }
    Object.assign(index, payload(output));
    assert.deepEqual(previous.createManifest(historicalRoot), original, 'Combined baselines: historical input changed while copying');
    index.complete = true; save();
    return verify(output);
  } catch (error) {
    index.complete = false; index.failure = { message: error.message, stack: error.stack }; throw error;
  } finally { save(); }
}

if (require.main === module) {
  try {
    const operation = process.argv[2]; let result;
    if (operation === policy.operations.verify) {
      assert.equal(process.argv.length, 4); result = verify(process.argv[3]);
    } else {
      assert.equal(operation, policy.operations.prepare); assert.equal(process.argv.length, 5);
      result = prepare(process.argv[3], process.argv[4]);
    }
    console.log(JSON.stringify(result));
  } catch (error) { console.error('Combined baselines failed: ' + error.stack); process.exitCode = 1; }
}

module.exports = { prepare, verify };
