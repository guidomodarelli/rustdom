/** @file Archives and verifies a new operation-warmup study without accepting historical rejections. */
'use strict';
const { createSinglePackageStudy } = require('./single-package-experiment.cjs');
const { runStudyCli } = require('./paired-main-experiment.cjs');
const study = createSinglePackageStudy({ settings: require('./constants/realm-warmup.cjs'),
  method: require('./constants/realm-warmup-study.cjs') });
if (require.main === module) runStudyCli(study);
module.exports = study;
