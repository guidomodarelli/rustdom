/** @module ownership-seeded-pre-gc-study Archives new fixed-seed evidence without relabeling historical timings. */
'use strict';
const { createSinglePackageStudy } = require('./single-package-experiment.cjs');
const { runStudyCli } = require('./paired-main-experiment.cjs');
const study = createSinglePackageStudy({ settings: require('./constants/seeded-pre-gc.cjs'),
  method: require('./constants/seeded-pre-gc-study.cjs') });
if (require.main === module) runStudyCli(study);
module.exports = study;
