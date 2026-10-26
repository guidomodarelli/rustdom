/** @file Preserves a new GC-boundary study; historical rejections remain immutable. */
'use strict';
const { createSinglePackageStudy } = require('./single-package-experiment.cjs');
const { runStudyCli } = require('./paired-main-experiment.cjs');
const study = createSinglePackageStudy({ settings: require('./constants/pre-gc-warmup.cjs'),
  method: require('./constants/pre-gc-warmup-study.cjs') });
if (require.main === module) runStudyCli(study);
module.exports = study;
