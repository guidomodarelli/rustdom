/** @file Same independent full schedule and budgets, with explicit per-window operation warmup. */
'use strict';
const original = require('./independent-order.cjs');
const warmup = require('../../../../benchmarks/constants/ownership-warmup.cjs');
module.exports = { ...original, revision: 'realm-warmup-v1', warmupCurrentRealm: true,
  withinRealmWarmupRounds: warmup.rounds };
