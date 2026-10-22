/** @file Captures fresh producer inputs without reusing or approving a historical performance study. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { captureSourceIdentity } = require('../../../benchmarks/sources.cjs');
const historical = require('./constants/ownership-evidence.json');
const recipe = require('./constants/current-hosted-build.cjs');
const study = require('./paired-inline-experiment.cjs');

/**
 * Record every source, optional build input and harness digest before and after a fresh build.
 * Baseline stays fixed; new candidates are recorded, never treated as accepted timing evidence.
 * @param {string} baseline - Actual checkpoint067 sources.
 * @param {string} candidate - Actual new candidate sources, with the full harness.
 * @returns {object} Portable identities that the producer must preserve exactly.
 */
function captureCurrentInputs(baseline, candidate) {
  const identities = { A: captureSourceIdentity(baseline), B: captureSourceIdentity(candidate) };
  assert.equal(identities.A.sourceHash, historical.sourceHashes.A, 'Current hosted build: checkpoint067 sources differ');
  const buildInputHashes = {};
  for (const [label, root] of Object.entries({ A: baseline, B: candidate })) {
    const names = [...new Set([...Object.keys(historical.buildInputHashes[label]), ...recipe.additionalBuildInputs])].sort();
    buildInputHashes[label] = Object.fromEntries(names.map((name) => {
      const filename = path.join(root, name);
      return [name, fs.existsSync(filename) ? createHash('sha256').update(fs.readFileSync(filename)).digest('hex') : null];
    }));
    if (label === 'A') for (const [name, expected] of Object.entries(historical.buildInputHashes.A)) {
      assert.equal(buildInputHashes.A[name], expected, `Current hosted build: checkpoint067 build input differs: ${name}`);
    }
  }
  return { policy: recipe.revision,
    sources: Object.fromEntries(Object.entries(identities).map(([label, identity]) => [label, identity.sourceHash])),
    harnessSha256: study.captureHarness(candidate).sha256, buildInputHashes };
}

module.exports = { captureCurrentInputs };
