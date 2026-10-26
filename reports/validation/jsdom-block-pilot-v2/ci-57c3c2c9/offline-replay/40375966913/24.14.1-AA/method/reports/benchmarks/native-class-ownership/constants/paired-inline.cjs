/** @file Fixed original workload design with the separately built inline candidate C. */
'use strict';
const original = require('./paired-main.cjs');
module.exports = {
  ...original,
  revision: 'paired-main-inline-v1',
  distributionHashes: { ...original.distributionHashes,
    B: '9d2d14c14d17f0b1b64473bbeaed435ff893bfc8421029ebba853be67b6e7b6c' },
};
