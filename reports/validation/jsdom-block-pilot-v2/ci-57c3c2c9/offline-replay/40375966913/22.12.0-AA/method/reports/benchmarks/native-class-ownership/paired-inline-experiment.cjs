/** @file Runs or verifies the planned comparison with C while preserving the historical study. */
'use strict';
const { createPairedStudy, runStudyCli } = require('./paired-main-experiment.cjs');
const settings = require('./constants/paired-inline.cjs');
const method = require('./constants/paired-inline-study.cjs');
const study = createPairedStudy({ settings, method, sourceHashes: method.sourceHashes,
  workerFilename: method.workerFilename });
if (require.main === module) runStudyCli(study);
module.exports = study;
