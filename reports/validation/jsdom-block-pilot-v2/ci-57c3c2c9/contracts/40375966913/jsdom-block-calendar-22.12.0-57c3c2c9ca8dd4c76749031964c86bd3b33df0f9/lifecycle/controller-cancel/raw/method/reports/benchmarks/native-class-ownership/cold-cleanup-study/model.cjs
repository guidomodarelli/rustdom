/** @module cold-study-model Uses the unchanged scheduler, worker validator and pooled-median estimator. */
'use strict';
const { createSinglePackageStudy } = require('../single-package-experiment.cjs');
const original = require('../constants/current-ownership.cjs');
const identity = require('../cold-cleanup-transport/constants/transport.json').preparationIdentity;
const { bindSettings } = require('./settings.cjs');
const settings = bindSettings(original, identity);
const model = createSinglePackageStudy({ settings,
  method: { sourceHashes: identity.inputs.sources, methodFiles: [], preparation: { identity } } });
module.exports = { settings, plan: model.processSchedule, validateWorker: model.validateWorker,
  validateSeedProbes: model.validateSeedProbes, summarize: model.summarize };
