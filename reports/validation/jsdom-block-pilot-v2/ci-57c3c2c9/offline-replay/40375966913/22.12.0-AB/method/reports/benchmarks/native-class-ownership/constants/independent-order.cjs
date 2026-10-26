/** @file Separates engine lead from pair, physical-package and workload ordering. */
'use strict';
const original = require('./single-package.cjs');
module.exports = { ...original, revision: 'independent-order-v1', workerCount: 16, engineLeadMask: 8 };
