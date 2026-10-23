/** @file Fixed runner timeout policy for both engines; upstream harness bytes remain unchanged. */
'use strict';
const WPT_LONG_TIMEOUT_MS = 60_000;
// The unmodified jsdom reference took 137.43 s for a long fixture on hosted Windows.
// Configure the upstream runner extension equally for both engines before any tests.
const WPT_TIMEOUT_MULTIPLIER = 3;
const FIXTURE_STARTUP_MARGIN_MS = 30_000;
const TEST_TIMEOUT_MS = WPT_LONG_TIMEOUT_MS * WPT_TIMEOUT_MULTIPLIER + FIXTURE_STARTUP_MARGIN_MS;
module.exports = {
  WPT_LONG_TIMEOUT_MS,
  WPT_TIMEOUT_MULTIPLIER,
  TEST_TIMEOUT_MS,
  PROCESS_TIMEOUT_MS: TEST_TIMEOUT_MS + FIXTURE_STARTUP_MARGIN_MS,
  WORKER_EXEC_ARGV: ['--max-old-space-size=2048'],
  MAX_PROCESS_OUTPUT_BYTES: 64 * 1024 * 1024,
  MAX_ERROR_DIAGNOSTIC_UNITS: 2048,
  FIXTURE_HOST: 'web-platform.test',
  REPORTER: `setup({timeout_multiplier:${WPT_TIMEOUT_MULTIPLIER}});add_completion_callback((tests, status) => __wptDone(JSON.stringify({status:status.status,message:status.message,tests:tests.map(test=>({name:test.name,status:test.status,message:test.message}))})));`,
};
