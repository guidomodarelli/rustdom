/** @file Fixed WPT process and outer failsafe limits; upstream normal/long timeouts remain unchanged. */
'use strict';
const WPT_LONG_TIMEOUT_MS = 60_000;
const FIXTURE_STARTUP_MARGIN_MS = 30_000;
const TEST_TIMEOUT_MS = WPT_LONG_TIMEOUT_MS + FIXTURE_STARTUP_MARGIN_MS;
module.exports = {
  TEST_TIMEOUT_MS,
  PROCESS_TIMEOUT_MS: TEST_TIMEOUT_MS + FIXTURE_STARTUP_MARGIN_MS,
  WORKER_EXEC_ARGV: ['--max-old-space-size=2048'],
  MAX_PROCESS_OUTPUT_BYTES: 64 * 1024 * 1024,
  MAX_ERROR_DIAGNOSTIC_UNITS: 2048,
  FIXTURE_HOST: 'web-platform.test',
  REPORTER: 'add_completion_callback((tests, status) => __wptDone(JSON.stringify({status:status.status,message:status.message,tests:tests.map(test=>({name:test.name,status:test.status,message:test.message}))})));',
};
