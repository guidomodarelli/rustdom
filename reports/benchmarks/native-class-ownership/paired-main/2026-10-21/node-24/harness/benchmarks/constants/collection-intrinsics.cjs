/** @module benchmarks/constants/collection-intrinsics Reproducible generic-collection transport comparison. */
'use strict';
module.exports = {
  COLLECTION_SIZES: [100, 1000],
  COLLECTION_KINDS: ['children', 'controls', 'forms'],
  CACHE_MODES: ['live', 'cached'],
  WARMUP_SAMPLES: 3,
  MEASURED_SAMPLES: 9,
  PROCESS_ORDERS: [['before', 'after', 'jsdom'], ['after', 'before', 'jsdom']],
  WORKER_TIMEOUT_MS: 180_000,
};
