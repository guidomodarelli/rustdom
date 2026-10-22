/** @file Artifact names and identity/lifetime fixture contracts for current-build validation. */
'use strict';
const { validationNodeVersions } = require('./hosted-build.cjs');
module.exports = {
  sha256Pattern: /^[0-9a-f]{64}$/,
  sourceInputsDirectoryPrefix: 'rustdom-current-build-inputs-',
  preparationDirectoryPrefix: 'rustdom-current-preparation-',
  functionalReports: [
    { filename: 'ownership-node22.json', node: validationNodeVersions[0] },
    { filename: 'ownership-node24.json', node: validationNodeVersions[1] },
  ],
};
