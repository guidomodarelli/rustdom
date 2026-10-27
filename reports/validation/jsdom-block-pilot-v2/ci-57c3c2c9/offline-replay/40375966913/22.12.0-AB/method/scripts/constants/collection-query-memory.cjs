/** @module collection-query-memory Finite lifetime and mutation budgets for live collection ownership. */
'use strict';
module.exports = {
  WINDOWS_PER_BATCH: 12,
  ELEMENTS_PER_WINDOW: 24,
  MUTATIONS_PER_WINDOW: 40,
  MEASURED_CYCLES: 3,
  RETAINED_QUERY_CYCLES: 200,
  TEST_TIMEOUT_MS: 120_000,
};
