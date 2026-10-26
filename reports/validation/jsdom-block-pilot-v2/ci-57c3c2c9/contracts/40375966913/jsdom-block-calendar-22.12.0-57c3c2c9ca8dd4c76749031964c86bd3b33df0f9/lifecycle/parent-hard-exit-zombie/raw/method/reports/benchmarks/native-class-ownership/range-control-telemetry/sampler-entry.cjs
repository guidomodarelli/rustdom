/** @file Binds the existing real sampler to exact AA packages; inspection never invokes an operation. */
'use strict';
const original = require('./constants/current-ownership.cjs');
const binding = require('./constants/range-control-telemetry.json');
const { createSinglePackageWorker } = require('./single-package-worker.cjs');
const settings = { ...original, revision: binding.samplerRevision, distributionHashes: binding.distributionHashes };
const sampler = createSinglePackageWorker(settings);

/** @returns {object} Actual runtime configuration and startup flags, with no DOM or sampler invocation. */
function inspect() {
  return { settings, samplerInvoked: false,
    workerArguments: settings.v8Seeds.map((seed, position) => sampler.workerArguments(position)) };
}
if (require.main === module) {
  if (process.argv.length !== 3 || process.argv[2] !== binding.inspectOperation) throw new Error('Range telemetry entry: only inspection is callable directly');
  console.log(JSON.stringify(inspect(), null, 2));
}
module.exports = { ...sampler, inspect };
