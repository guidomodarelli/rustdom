/** @module cold-preparation-replay Authenticates prepared packages and saved functional reports without loading a DOM. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const preparation = require('../cold-cleanup-build/prepare.cjs');
const buildPolicy = require('../cold-cleanup-build/constants/inputs.json');
const recipe = require('../cold-cleanup-build/constants/protocol.cjs');
const policy = require('./constants/transport.json');
const read = (filename) => JSON.parse(fs.readFileSync(filename, 'utf8'));

/**
 * Replays byte/input checks and validates saved weak-owner reports using current reviewed code.
 * @param {string} directory - Extracted authenticated preparation root.
 * @returns {object} Complete read-only verification with no timing acceptance.
 * @throws {Error} When packages, source provenance or saved functional observations differ.
 */
function replay(directory) {
  const root = fs.realpathSync(directory);
  for (const [name, expected] of Object.entries(policy.evidenceHashes)) {
    const actual = createHash('sha256').update(fs.readFileSync(path.join(root, name))).digest('hex');
    assert.equal(actual, expected, `Cold preparation replay: evidence file differs from authenticated artifact: ${name}`);
  }
  const build = path.join(root, policy.replay.buildDirectory);
  const identity = preparation.verify(build);
  assert.deepEqual(identity, policy.preparationIdentity,
    'Cold preparation replay: packages or identity differ from the independently pinned hosted preparation');
  assert.deepEqual(identity, read(path.join(root, policy.replay.identityFile)),
    'Cold preparation replay: saved build identity differs from actual packages');
  const patch = read(path.join(root, buildPolicy.archive.patchReceipt));
  assert.equal(patch.revision, buildPolicy.revision);
  assert.equal(patch.patchSha256, buildPolicy.patchSha256);
  assert.equal(patch.before.sourceCommit, buildPolicy.candidateCommit);
  assert.equal(patch.before.sourceHash, buildPolicy.unpatchedSourceHash);
  assert.deepEqual(patch.before.sourceChanges, []);
  assert.deepEqual(patch.before.sourceGitErrors, []);
  assert.equal(patch.after.sourceCommit, buildPolicy.candidateCommit);
  assert.equal(patch.after.sourceHash, buildPolicy.candidateSourceHash);
  assert.deepEqual(patch.after.sourceChanges, [` M ${buildPolicy.guardPath}`]);
  assert.deepEqual(patch.after.sourceGitErrors, []);
  const index = read(path.join(build, buildPolicy.archive.index));
  assert.equal(index.sourceProvenance.A.sourceCommit, buildPolicy.baselineCommit);
  assert.deepEqual(index.sourceProvenance.A.sourceChanges, []);
  assert.deepEqual(index.sourceProvenance.A.sourceGitErrors, []);
  assert.deepEqual(index.sourceProvenance.B, patch.after);
  const reports = buildPolicy.functionalReports.map(({ node, filename }) => {
    const report = read(path.join(root, filename));
    assert.equal(report.node, node);
    assert.equal(preparation.verifyFunctionalReport(report, identity).verified, true);
    return { node, windows: report.observedWindows, documents: report.observedDocuments,
      firstUnclearStates: Object.values(report.endpoints).filter((endpoint) => !endpoint.trace[0].clear).length,
      finalClearStates: Object.values(report.endpoints).reduce((total, endpoint) => total + endpoint.requiredClearSamples, 0) };
  });
  const nativeLabels = Object.entries(recipe.packageSources).filter(([, source]) => source !== policy.replay.referenceSource).map(([label]) => label);
  const binarySha256 = Object.fromEntries(nativeLabels.map((label) => [label,
    read(path.join(build, policy.replay.packagesDirectory, label, policy.replay.nativeMetadata)).binarySha256]));
  assert.notEqual(binarySha256.A0, binarySha256.B, 'Cold preparation replay: baseline and candidate addons must differ');
  return { verified: true, identity, binarySha256, reports, replayExecutedDOM: false,
    measurementExecuted: false, performanceAccepted: null, gateReevaluated: false };
}

if (require.main === module) {
  try { process.stdout.write(`${JSON.stringify(replay(process.argv[2]))}\n`); }
  catch (error) { process.stderr.write(`${error.stack}\n`); process.exitCode = buildPolicy.failureExitCode; }
}
module.exports = { replay };
