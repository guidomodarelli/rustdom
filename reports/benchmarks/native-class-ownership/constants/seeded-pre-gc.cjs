/** @module ownership-seeded-pre-gc-settings Declares fixed startup entropy while retaining the complete pre-GC workload. */
'use strict';
const original = require('./pre-gc-warmup.cjs');
/** Use seeds 1..16 in position order and three startup RNG draws outside every workload timer. */
module.exports = { ...original, revision: 'seeded-pre-gc-v1',
  v8Seeds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16], v8SeedProbeSamples: 3 };
