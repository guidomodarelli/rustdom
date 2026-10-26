/** @module combined-publication-contracts Exercises the actual independent reviewed method and its Python/Node identity contract. */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');
const study = require('./study.cjs');
const { methodFilesDigest, verifyPublication } = require('./publication.cjs');
const capture = require('./constants/capture.json');
const policy = require('./constants/protocol.json');
const transport = require('./constants/transport.json');

test('current independently reviewed method has the same activation identity in Python and Node', () => {
  const reviewed = study.publication();
  assert.equal(reviewed.performanceAccepted, null); assert.equal(reviewed.gateReevaluated, false);
  const reordered = Object.fromEntries(Object.entries(reviewed.files).reverse());
  assert.equal(methodFilesDigest(reordered), reviewed.methodFilesSha256);
  const child = spawnSync('python3', ['-B', path.join(__dirname, 'transport.py'), transport.methodIdentityOperation,
    path.resolve(__dirname, '../../../..')], { encoding: 'utf8', timeout: policy.preparationTimeoutMs });
  assert.ifError(child.error); assert.equal(child.status, 0, child.stderr);
  const identity = JSON.parse(child.stdout);
  assert.equal(identity.methodFilesSha256, reviewed.methodFilesSha256);
  assert.equal(identity.publicationSha256, require('./io.cjs').hashFile(path.resolve(__dirname, '../../../..', capture.publicationReceipt)));
  assert.equal(identity.performanceAccepted, null); assert.equal(identity.gateReevaluated, false);
});

test('changed source graphs, unresolved review and self-declared acceptance cannot satisfy method publication', () => {
  const reviewed = study.publication();
  for (const replacement of [{ actionableFindings: 1 }, { completeMethodReview: false }, { methodFilesSha256: '0'.repeat(64) },
    { performanceAccepted: true }, { gateReevaluated: true }, { executionReady: !policy.executionReady },
    { packageArchiveSha256: '0'.repeat(64) }, { acceptanceRule: 'unrelated-rule' }]) {
    assert.throws(() => verifyPublication({ ...reviewed, ...replacement }, reviewed.files));
  }
  const changed = { ...reviewed.files }; delete changed[Object.keys(changed)[0]];
  assert.throws(() => verifyPublication(reviewed, changed));
});
