/** @file Preserves the official packages, workloads, samples and budgets for process isolation. */
'use strict';
const original = require('./hosted-main.cjs');
module.exports = { ...original, revision: 'single-package-v1', labels: ['A', 'B'] };
