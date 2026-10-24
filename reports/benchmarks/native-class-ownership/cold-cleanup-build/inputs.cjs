/** @module cold-cleanup-inputs Authenticates baseline and qualified candidate sources. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { captureSourceIdentity } = require('../../../../benchmarks/sources.cjs');
const { createBuildInputsCapture } = require('../current-build-inputs.cjs');
const recipe = require('./constants/protocol.cjs');
const policy = require('./constants/inputs.json');
const repository = path.resolve(__dirname, '../../../..');
const originalInputs = require(path.join(repository, policy.inputReceipt)).identity.inputs;
const capture = createBuildInputsCapture({ recipe, baselineName: policy.baselineName,
  baselineSourceHash: policy.baselineSourceHash, baselineBuildInputHashes: originalInputs.buildInputHashes.A });

/**
 * Captures exact source, build and harness identities without requiring Git in archive snapshots.
 * @param {string} baseline - Actual baseline checkout or its preserved sources.
 * @param {string} candidate - Actual patched checkout or its preserved sources.
 * @returns {object} Fixed source/build inputs without performance acceptance.
 * @throws {Error} When an implementation, harness or root build input differs.
 */
function captureInputs(baseline, candidate) {
  assert.equal(captureSourceIdentity(candidate).sourceHash, policy.candidateSourceHash,
    'Cold cleanup build: candidate sources differ from the qualified variant');
  const guard = fs.readFileSync(path.join(candidate, policy.guardPath));
  assert.equal(createHash('sha256').update(guard).digest('hex'), policy.candidateGuardSha256,
    'Cold cleanup build: candidate ownership guard differs');
  const inputs = capture(baseline, candidate);
  assert.equal(inputs.harnessSha256, policy.candidateBuildHarnessSha256,
    'Cold cleanup build: build harness differs from the qualified source scope');
  assert.deepEqual(inputs.buildInputHashes.B, originalInputs.buildInputHashes.B,
    'Cold cleanup build: candidate root build inputs differ from the fixed runtime');
  return inputs;
}
module.exports = { captureInputs };
