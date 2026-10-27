/** @module ownership-row-isolation-study Preserves all global factors while isolating workloads in separate processes. */
'use strict';
const { createSinglePackageStudy } = require('./single-package-experiment.cjs');
const { runStudyCli } = require('./paired-main-experiment.cjs');
const study = createSinglePackageStudy({ settings: require('./constants/row-isolation.cjs'),
  method: require('./constants/row-isolation-study.cjs') });
if (require.main === module) runStudyCli(study);
module.exports = study;
