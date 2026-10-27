/** @module ownership-current-provenance Keeps the current SUT separate from all consumed historical studies. */
'use strict';
const original = require('./row-isolation-study.cjs');
const preparationRecipe = require('./current-hosted-build.cjs');
const receipt = require('../../../validation/native-class-ownership/current-source-preparation/39906777389/receipt.json');
module.exports = { ...original, revision: 'ownership-current-source-study-v1',
  workerFilename: 'current-ownership-worker.cjs', sourceHashes: receipt.identity.inputs.sources,
  preparation: receipt,
  methodFiles: [...new Set([...original.methodFiles, ...preparationRecipe.preparationFiles,
    'reports/validation/native-class-ownership/current-source-preparation/39906777389/receipt.json',
    'reports/benchmarks/native-class-ownership/constants/current-ownership.json',
    'reports/benchmarks/native-class-ownership/constants/current-ownership.cjs',
    'reports/benchmarks/native-class-ownership/constants/current-ownership-study.cjs',
    'reports/benchmarks/native-class-ownership/current-ownership-experiment.cjs',
    'reports/benchmarks/native-class-ownership/current-ownership-worker.cjs',
    'reports/benchmarks/native-class-ownership/current-ownership.spec.cjs',
    'reports/benchmarks/native-class-ownership/current-ownership-consumption.cjs',
    'reports/benchmarks/native-class-ownership/current-ownership-metadata.spec.cjs',
    'reports/benchmarks/native-class-ownership/CURRENT-OWNERSHIP-PROTOCOL.md',
    '.github/workflows/ownership-current-source.yml',
  ])] };
