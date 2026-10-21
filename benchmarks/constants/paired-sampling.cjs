/** @module benchmarks/constants/paired-sampling Predeclared diagnostic sampling; no regression-budget changes. */
'use strict';
module.exports = {
  PAIRED_WARMUP_SAMPLES: 16,
  PAIRED_MEASURED_SAMPLES: 32,
  PAIRED_WORKER_PAIRS: 2,
  PAIRED_REQUEST_TIMEOUT_MS: 60_000,
  PAIRED_SHUTDOWN_TIMEOUT_MS: 10_000,
  PAIRED_STDERR_LIMIT_CHARACTERS: 16_384,
  PAIRED_BLOCK_ORDERS: [['first', 'second', 'second', 'first'], ['second', 'first', 'first', 'second']],
  PAIRED_CONTROL_WORKLOADS: ['form-data-construct', 'attribute-get'],
};
