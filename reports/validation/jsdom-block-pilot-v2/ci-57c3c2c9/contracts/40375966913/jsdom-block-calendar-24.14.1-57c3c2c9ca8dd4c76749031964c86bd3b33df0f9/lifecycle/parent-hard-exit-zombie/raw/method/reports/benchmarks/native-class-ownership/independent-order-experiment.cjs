/** @file Produces and verifies an independently ordered archive without changing the estimator. */
'use strict';
const { createSinglePackageStudy } = require('./single-package-experiment.cjs');
const { runStudyCli } = require('./paired-main-experiment.cjs');
const study = createSinglePackageStudy({ settings: require('./constants/independent-order.cjs'),
  method: require('./constants/independent-order-study.cjs') });
if (require.main === module) runStudyCli(study);
module.exports = study;
