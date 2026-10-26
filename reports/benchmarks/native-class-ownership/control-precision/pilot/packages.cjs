/** @module pilot-functional-packages Fingerprints the already-authenticated numeric payload without loading a runtime. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { fingerprint } = require('../../paired-experiment.cjs');
const { readJSON } = require('../../owner-batch-study/io.cjs');
const policy = require('./constants/worker.json');
const method = require('./constants/capture.json');

/**
 * Map an externally authenticated package into the unchanged raw worker schema; no authentication is inferred here.
 * @param {string} root - Actual extracted numeric package, verified by the current Python assembler before this call.
 * @param {object} authentication - Independent parent receipt from that verifier.
 * @param {'functional'|'capture'} mode - Explicit producer role; metadata cannot promote functional data.
 * @returns {object} Every physical root/inventory, with explicit parent verification provenance.
 */
function createManifest(root, authentication, mode) {
  assert.ok(method.modes.includes(mode));
  assert.equal(process.platform, 'linux');
  assert.equal(authentication.verified, true); assert.equal(authentication.artifactId, policy.selectedArtifactId);
  assert.equal(authentication.nativeBinarySha256, policy.nativeBinarySha256);
  root = fs.realpathSync(root); const copies = {}; const distributions = {};
  for (const label of Object.keys(policy.distributions)) {
    const directory = path.join(root, ...(label === 'B' ? ['candidate'] : ['controls', 'packages', label]));
    const current = fingerprint(directory, label.startsWith('J') ? ['lib', 'package.json'] : ['dist', 'package.json']);
    assert.equal(current.sha256, policy.distributions[label], 'Pilot package manifest: changed physical package ' + label);
    if (label.startsWith('J')) assert.equal(readJSON(path.join(directory, 'package.json')).version, policy.referenceVersion);
    copies[label] = directory; distributions[label] = current;
  }
  return { copies, distributions, packageRoot: root, functionalOnly: mode === method.functionalMode, formalPackageAssembled: true,
    selectedArtifactId: policy.selectedArtifactId, numericPackageVerifiedByParent: true,
    nativeBinarySha256: policy.nativeBinarySha256, archiveSha256: policy.archiveSha256,
    authenticationPerformedHere: false, performanceAccepted: null, gateReevaluated: false };
}

/** @param {string} root - Authenticated package root. @param {object} authentication - Parent verifier result. @returns {object} Existing functional-role manifest. */
function createFunctionalManifest(root, authentication) { return createManifest(root, authentication, method.functionalMode); }

module.exports = { createManifest, createFunctionalManifest };
