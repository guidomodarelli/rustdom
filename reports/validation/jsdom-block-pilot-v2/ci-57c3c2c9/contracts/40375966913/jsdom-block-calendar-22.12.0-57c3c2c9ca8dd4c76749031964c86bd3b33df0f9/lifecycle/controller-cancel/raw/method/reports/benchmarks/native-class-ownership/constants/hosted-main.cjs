/** @file Pins the complete hosted packages without changing the validated public sampler or budgets. */
'use strict';
const original = require('./paired-inline.cjs');
const receipt = require('../../../validation/native-class-ownership/hosted-build-ci/39720077911/receipt.json');
module.exports = {
  ...original,
  revision: 'hosted-main-inline-v1',
  distributionHashes: receipt.identity.distributions,
};
