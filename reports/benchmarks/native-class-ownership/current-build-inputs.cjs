/** @file Captures fresh producer inputs without reusing or approving a historical performance study. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { captureSourceIdentity } = require('../../../benchmarks/sources.cjs');
const historical = require('./constants/ownership-evidence.json');
const defaultRecipe = require('./constants/current-hosted-build.cjs');
const contracts = require('./constants/current-build-contracts.cjs');
const study = require('./paired-inline-experiment.cjs');

/**
 * Bind fresh source capture to an explicit baseline while preserving the historical default.
 * @param {object} [options] - Versioned recipe and fixed reference input policy.
 * @param {object} [options.recipe] - Same producer tools and source snapshot settings.
 * @param {string} [options.baselineName] - Reference name used in actionable diagnostics.
 * @param {string} [options.baselineSourceHash] - Canonical identity of the selected reference.
 * @param {object} [options.baselineBuildInputHashes] - Actual fixed root build inputs of that reference.
 * @returns {Function} Capture function that records current inputs without granting timing acceptance.
 */
function createBuildInputsCapture({ recipe = defaultRecipe, baselineName = contracts.baselineName,
  baselineSourceHash = historical.sourceHashes.A, baselineBuildInputHashes = historical.buildInputHashes.A } = {}) {
  /** @param {string} baseline - Actual fixed reference. @param {string} candidate - Complete current candidate. @returns {object} Recorded before/after identity. */
  return function captureInputs(baseline, candidate) {
    const identities = { A: captureSourceIdentity(baseline), B: captureSourceIdentity(candidate) };
    assert.equal(identities.A.sourceHash, baselineSourceHash, `Current hosted build: ${baselineName} sources differ`);
    const buildInputHashes = {};
    for (const [label, root] of Object.entries({ A: baseline, B: candidate })) {
      const declared = label === 'A' ? baselineBuildInputHashes : historical.buildInputHashes.B;
      const names = [...new Set([...Object.keys(declared), ...recipe.additionalBuildInputs])].sort();
      buildInputHashes[label] = Object.fromEntries(names.map((name) => {
        const filename = path.join(root, name);
        return [name, fs.existsSync(filename) ? createHash('sha256').update(fs.readFileSync(filename)).digest('hex') : null];
      }));
      if (label === 'A') for (const [name, expected] of Object.entries(baselineBuildInputHashes)) {
        assert.equal(buildInputHashes.A[name], expected, `Current hosted build: ${baselineName} build input differs: ${name}`);
      }
    }
    return { policy: recipe.revision,
      sources: Object.fromEntries(Object.entries(identities).map(([label, identity]) => [label, identity.sourceHash])),
      harnessSha256: study.captureHarness(candidate).sha256, buildInputHashes };
  };
}

const captureCurrentInputs = createBuildInputsCapture();
module.exports = { captureCurrentInputs, createBuildInputsCapture };
