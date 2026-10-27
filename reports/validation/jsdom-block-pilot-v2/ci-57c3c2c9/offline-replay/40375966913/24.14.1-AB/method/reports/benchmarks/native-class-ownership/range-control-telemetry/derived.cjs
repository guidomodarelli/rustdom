/** @module range-telemetry-derived Checks the complete executable graph independently of archived receipts. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { repository, policy, read, hash } = require('./context.cjs');
const jsonHash = (value) => createHash('sha256').update(JSON.stringify(value, null, 2) + '\n').digest('hex');

/** @param {string} mode - Declared observer mode. @returns {object} Independent code/config map from reviewed Git sources only. */
function expectedMap(mode) {
  assert.ok(policy.modes.includes(mode));
  const original = read(path.join(repository, policy.nativeCodeMaps[mode]));
  const identity = read(path.join(repository, policy.packageIdentity));
  const codeFiles = { ...original.codeFiles };
  codeFiles[policy.preservedReferences[policy.paths.protocol]] = original.codeFiles[policy.paths.protocol];
  codeFiles[policy.originalSamplerEntry] = original.codeFiles[policy.samplerEntry];
  codeFiles[policy.samplerEntry] = hash(path.join(__dirname, 'sampler-entry.cjs'));
  codeFiles[policy.samplerBinding] = jsonHash({ samplerRevision: policy.samplerRevision, distributionHashes: identity.distributions, inspectOperation: policy.inspectOperation });
  codeFiles[policy.paths.protocol] = jsonHash({ ...policy, mode });
  const fileNames = [...new Set([...original.fileNames, ...Object.values(policy.preservedReferences), policy.originalSamplerEntry, policy.samplerBinding])].sort();
  return { revision: policy.revision, mode, executionPerformed: false, fileNames,
    codeFiles: Object.fromEntries(Object.keys(codeFiles).sort().map((name) => [name, codeFiles[name]])) };
}

/** @param {string} root - Untrusted evidence tree. @returns {string[]} Exact regular file names; links and overlays fail. */
function fileNames(root) {
  const names = [];
  function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const filename = path.join(directory, entry.name);
      assert.equal(entry.isSymbolicLink(), false, 'Range telemetry: derived code must not contain links');
      if (entry.isDirectory()) visit(filename);
      else { assert.ok(entry.isFile()); names.push(path.relative(root, filename).split(path.sep).join('/')); }
    }
  }
  assert.ok(fs.lstatSync(root).isDirectory() && !fs.lstatSync(root).isSymbolicLink()); visit(root); return names.sort();
}

/** @param {string} root - Derived data to authenticate, never execute. @param {string} mode - Observer mode. @param {object} sourceManifest - Actual source declaration. @returns {object} Original receipt after complete code/metadata verification. */
function verifyDerived(root, mode, sourceManifest, manifestSha256) {
  const registered = read(path.join(repository, policy.codeMaps[mode]));
  assert.deepEqual(registered, expectedMap(mode), 'Range telemetry: registered code map differs from current reviewed inputs');
  assert.deepEqual(fileNames(root), [...registered.fileNames, policy.paths.preparation].sort(), 'Range telemetry: extra or missing derived files');
  const receipt = read(path.join(root, policy.paths.preparation));
  for (const [name, expected] of Object.entries({ revision: policy.revision, mode, captureImplemented: policy.captureImplemented,
    sourceCommit: sourceManifest.commit, sourceChanges: [], sourceGitErrors: [], measurementExecuted: false,
    performanceAccepted: null, gateReevaluated: false, historicalPinsVerified: policy.historicalPins, sourceManifestSha256: manifestSha256 })) {
    assert.deepEqual(receipt[name], expected, name);
  }
  assert.deepEqual(Object.keys(receipt.derivedFiles).sort(), registered.fileNames);
  for (const [name, expected] of Object.entries(registered.codeFiles)) assert.equal(hash(path.join(root, name)), expected, name);
  for (const [name, expected] of Object.entries(receipt.derivedFiles)) assert.equal(hash(path.join(root, name)), expected, name);
  assert.deepEqual(read(path.join(root, policy.paths.protocol)), { ...policy, mode });
  const legacy = read(path.join(root, policy.preservedReferences[policy.paths.preparation]));
  const original = read(path.join(repository, policy.nativeCodeMaps[mode]));
  assert.deepEqual(Object.keys(legacy.derivedFiles).sort(), original.fileNames);
  assert.equal(legacy.sourceManifestSha256, manifestSha256);
  assert.equal(legacy.sourceHarnessSha256, policy.sourceHarnessSha256);
  assert.equal(legacy.qualifiedSamplerSha256, policy.qualifiedSamplerSha256);
  for (const [name, expected] of Object.entries(legacy.derivedFiles)) {
    const actual = name === policy.samplerEntry ? policy.originalSamplerEntry : policy.preservedReferences[name] ?? name;
    assert.equal(hash(path.join(root, actual)), expected, `original ${name}`);
  }
  return receipt;
}
if (require.main === module) console.log(JSON.stringify(expectedMap(process.argv[2]), null, 2));
module.exports = { expectedMap, verifyDerived, fileNames };
