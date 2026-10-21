/** @module benchmarks/constants/xml-serializer-controller Defines additional public controller rows without changing historical XML cases. */
'use strict';
module.exports = {
  XML_SERIALIZER_GETTER_ERROR_WORKLOAD: 'xml-serializer-getter-error',
  XML_SERIALIZER_GETTER_ERROR_MESSAGE: 'XMLSerializer benchmark getter failed',
  XML_SERIALIZER_SMALL_SIZES: [1, 16],
  XML_SERIALIZER_ERROR_SIZES: [1, 100, 1000],
  XML_SERIALIZER_BATCH_SIZES: { 1: 64, 16: 16, 100: 4, 1000: 1 },
  XML_SERIALIZER_WARMUP_BATCHES: 16,
  XML_SERIALIZER_MEASURED_BATCHES: 32,
  XML_SERIALIZER_PHASE_ORDER: ['A', 'B', 'B', 'A', 'B', 'A', 'A', 'B'],
  XML_SERIALIZER_CALIBRATION_BUDGET_PERCENT: 2,
  XML_SERIALIZER_REGRESSION_BUDGET_PERCENT: 5,
  XML_SERIALIZER_BENCHMARK_TIMEOUT_MS: 600_000,
};
