/** @module owner-batch-package-manifest Read authenticated distribution pins into worker roots without loading a DOM. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { fingerprint } = require('../paired-experiment.cjs');
const binding = require('../owner-batch-study/constants/worker.json');

/** @param {string} root - Independently verified extracted package. @returns {object} Physical roots and their bound file inventories. */
function createManifest(root) {
  root = fs.realpathSync(root); const copies = {}; const distributions = {};
  for (const label of Object.keys(binding.distributions)) {
    const directory = path.join(root, ...(label === 'B' ? ['candidate'] : ['controls', 'packages', label]));
    const current = fingerprint(directory, label.startsWith('J') ? ['lib', 'package.json'] : ['dist', 'package.json']);
    assert.equal(current.sha256, binding.distributions[label], 'Owner batch manifest: changed physical package ' + label);
    copies[label] = directory; distributions[label] = current;
  }
  return { copies, distributions, functionalOnly: true, formalPackageAssembled: true,
    selectedArtifactId: binding.selectedArtifactId, performanceAccepted: null, gateReevaluated: false };
}
if (require.main === module) {
  assert.equal(process.argv.length, 4, 'Provide verified package directory and new manifest output');
  fs.writeFileSync(process.argv[3], JSON.stringify(createManifest(process.argv[2]), null, 2) + '\n', { flag: 'wx' });
}
module.exports = { createManifest };
