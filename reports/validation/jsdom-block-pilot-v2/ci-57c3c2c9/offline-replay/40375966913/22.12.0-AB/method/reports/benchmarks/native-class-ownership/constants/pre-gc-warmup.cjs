/** @file Declared correction: the same three forced GCs precede operation warmup, with unchanged budgets. */
'use strict';
const original = require('./realm-warmup.cjs');
const policy = require('../../../../benchmarks/constants/ownership-warmup.cjs');
module.exports = { ...original, revision: 'pre-gc-warmup-v1', warmupGcOrder: policy.gcOrder.beforeWarmup };
