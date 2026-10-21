/** @file Runs pinned, unmodified WPT fixtures against jsdom and rustdom with the real WPT harness. */
'use strict';
const { readFileSync, writeFileSync, mkdirSync } = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const assert = require('node:assert/strict');
const { setImmediate: yieldToEventLoop } = require('node:timers/promises');
const { getHeapStatistics } = require('node:v8');
const { assertWptParity } = require('./comparison.cjs');

/** Corpus paths and digests identify the actual upstream input, not a claim of complete WPT coverage. */
const root = path.resolve(__dirname, '../fixtures/wpt');
const manifest = JSON.parse(readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const { executeFixture } = require('./process.cjs');
const { TEST_TIMEOUT_MS, PROCESS_TIMEOUT_MS, WPT_TIMEOUT_MULTIPLIER } = require('./constants/execution.cjs');
for (const [file, expected] of Object.entries(manifest.files)) {
  assert.equal(createHash('sha256').update(readFileSync(path.join(root, file))).digest('hex'), expected,
    `WPT fixture integrity: ${file}`);
}

/** @returns {Promise<void>} Saves complete observations, including shared upstream failures and any mismatch. */
async function main() {
  const requested = process.argv.slice(2);
  // Keep unsupported bootstrap paths reproducible by explicit request, without counting them as coverage.
  const blockedSuites = manifest.blockedSuites || {};
  const suites = requested.length ? requested : Object.keys(manifest.suites).filter((suite) => !blockedSuites[suite]);
  for (const suite of suites) assert.ok(manifest.suites[suite], `Unknown WPT suite: ${suite}`);
  const report = { capturedAt: new Date().toISOString(), node: process.version, platform: process.platform,
    execArgv: process.execArgv, heapSizeLimitBytes: getHeapStatistics().heap_size_limit,
    fixtureLifecycle: 'A fresh process per engine/fixture; close the realm and wait for process termination. Original assertions, upstream runner timeout multiplier applied equally to both engines; no forced GC.',
    wptRevision: manifest.revision, jsdom: require('jsdom/package.json').version, suites,
    outerTimeoutMs: TEST_TIMEOUT_MS,
    fixtureProcessTimeoutMs: PROCESS_TIMEOUT_MS,
    timeoutMultiplier: WPT_TIMEOUT_MULTIPLIER,
    methodology: 'Unmodified upstream assertions; local static resource loader; status, name and failure messages compared. Matching expected failures do not imply standards conformance.',
    diagnosticNormalization: 'Only the wall-clock Date input description in the known Blob-constructor invalid-input assertion is canonicalized for comparison. Raw messages, statuses and actual/expected exception diagnostics are preserved.',
    excludedFixtures: manifest.excludedFixtures || {},
    blockedSuites, complete: Object.keys(blockedSuites).length === 0 && Object.keys(manifest.excludedFixtures || {}).length === 0,
    results: [], pass: true };
  for (const [suite, blocker] of Object.entries(blockedSuites)) {
    process.stdout.write(`BLOQUEADO ${suite}: ${blocker.reason}; no se cuenta como cobertura aprobada.\n`);
  }
  for (const file of suites.flatMap((suite) => manifest.suites[suite])) {
    try {
      const reference = executeFixture('jsdom', file);
      const candidate = executeFixture('rustdom', file);
      const expected = reference.result;
      const actual = candidate.result;
      let pass = true;
      try {
        assertWptParity(file, actual, expected);
      } catch { pass = false; }
      const standardsPass = actual.tests.filter((test) => test.status === 0).length;
      report.results.push({ file, pass, standardsPass, expected, actual, execution: { reference: reference.execution, candidate: candidate.execution } });
      report.pass &&= pass;
      process.stdout.write(`${file}: ${pass ? 'PARIDAD' : 'DIFERENCIA'}, ${standardsPass}/${actual.tests.length} WPT aprobados\n`);
    } catch (error) {
      report.pass = false; report.results.push({ file, pass: false, error: error.stack, execution: error.execution });
      process.stderr.write(`${file}: ${error.message}\n`);
    }
    // Promise continuations can otherwise keep weak targets alive across the
    // entire corpus. End this turn after both realms close, outside assertions.
    await yieldToEventLoop();
  }
  mkdirSync('reports/compatibility', { recursive: true });
  const output = `reports/compatibility/${report.capturedAt.replaceAll(':', '-')}-${process.platform}-wpt.json`;
  writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`Guardado: ${output}\n`);
  if (!report.pass) process.exitCode = 1;
}

main().catch((error) => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
