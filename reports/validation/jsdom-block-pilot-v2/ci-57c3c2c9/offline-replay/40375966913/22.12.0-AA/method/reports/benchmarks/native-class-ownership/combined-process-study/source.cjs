/** @module combined-process-source Authenticates the frozen measurement graph and actual scoped Git provenance without loading DOM. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const legacy = require('../current-ownership-experiment.cjs');
const policy = require('./constants/protocol.json');
const repository = path.resolve(__dirname, '../../../..');

/** @returns {object} Exact 434-file measurement graph and its actual current Git identity. */
function captureHarness() {
  assert.ok(fs.lstatSync(path.join(repository, '.git')).isDirectory(), 'Combined source: use a native real Git checkout');
  const canonicalBytes = fs.readFileSync(path.join(repository, policy.derivation.canonicalManifest));
  assert.equal(createHash('sha256').update(canonicalBytes).digest('hex'), policy.derivation.canonicalManifestSha256);
  const canonical = JSON.parse(canonicalBytes);
  const harness = legacy.captureHarness();
  assert.deepEqual(harness.files, canonical.files);
  assert.equal(harness.files.length, policy.sourceHarnessFiles);
  assert.equal(harness.sha256, policy.sourceHarnessSha256);
  assert.deepEqual(harness.identity.sourceChanges, []); assert.deepEqual(harness.identity.sourceGitErrors, []);
  assert.match(harness.identity.sourceCommit, /^[a-f0-9]{40}$/);
  return harness;
}

if (require.main === module) {
  assert.equal(process.argv.length, 3, 'Combined source: provide a fresh disjoint manifest filename');
  const output = path.join(fs.realpathSync.native(path.dirname(path.resolve(process.argv[2]))), path.basename(process.argv[2]));
  assert.ok(!output.startsWith(repository + path.sep), 'Combined source: preserve the measurement source tree');
  const harness = captureHarness();
  fs.writeFileSync(output, JSON.stringify({ commit: harness.identity.sourceCommit, harnessSha256: harness.sha256, files: harness.files }, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ sourceCommit: harness.identity.sourceCommit, sourceHash: harness.identity.sourceHash,
    sourceChanges: harness.identity.sourceChanges, sourceGitErrors: harness.identity.sourceGitErrors,
    harnessSha256: harness.sha256, files: harness.files.length, samplerInvoked: false }));
}
module.exports = { captureHarness };
