/** @module benchmarks/constants/attribute-copy Equivalent canonical-data copy inputs and sampling. */
'use strict';
module.exports = {
  ATTRIBUTE_COPY_OPERATIONS: 1000,
  ATTRIBUTE_COPY_WARMUP: 3,
  ATTRIBUTE_COPY_SAMPLES: 9,
  ATTRIBUTE_COPY_WORKER_TIMEOUT_MS: 600_000,
  ATTRIBUTE_COPY_ORDERS: [['bridge', 'native'], ['native', 'bridge']],
  ATTRIBUTE_COPY_FIXTURES: [
    { name: 'plain-short', valueUnits: 32, namespace: null, prefix: null, malformed: false },
    { name: 'plain-long', valueUnits: 4096, namespace: null, prefix: null, malformed: false },
    { name: 'namespaced-utf16', valueUnits: 4096, namespace: 'urn:attribute-copy-benchmark', prefix: 'p', malformed: true },
  ],
};
