/** @module cold-cleanup-build-policy Declares preparation without changing historical tools or timing policy. */
'use strict';
const current = require('../../constants/current-hosted-build.cjs');
const policy = require('./inputs.json');
const directory = 'reports/benchmarks/native-class-ownership/cold-cleanup-build';
module.exports = { ...current, revision: policy.revision,
  preparationFiles: [...new Set([...current.preparationFiles, policy.patchPath, policy.inputReceipt,
    '.github/workflows/ownership-cold-cleanup-build.yml',
    ...['constants/inputs.json', 'constants/protocol.cjs', 'inputs.cjs', 'prepare.cjs', 'worker.cjs',
      'contracts.spec.cjs', 'PROTOCOL.md'].map((name) => `${directory}/${name}`)])] };
