/** @file Differential XML/FormData errors against independent engines with mutable conversion hooks. */
'use strict';
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { Worker } = require('node:worker_threads');
const { mkdirSync, writeFileSync } = require('node:fs');
const observations = [];
const capturedAt = new Date().toISOString();

/** @param {object} workerData - Isolated engine/scenario. @returns {Promise<object>} Behavior after the Worker has released its Env. */
function run(workerData) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(require.resolve('./helpers/iterator-diagnostics.cjs'), {
      workerData: { ...workerData, runtimeDirectory: process.env.RUSTDOM_DIAGNOSTIC_RUNTIME },
    });
    let result;
    worker.once('message', (message) => { result = message; });
    worker.once('error', reject);
    worker.once('exit', (code) => code === 0 ? resolve(result) : reject(new Error(`Iterator diagnostic worker exited with ${code}`)));
  });
}

for (const surface of ['xml', 'form-data']) {
  for (const mutation of ['symbol-method', 'symbol-getter', 'symbol-throw', 'string-function', 'string-null', 'string-getter', 'type-error-getter']) {
    test(`should preserve ${surface} iterator diagnostics when ${mutation} is replaced`, async () => {
      const expected = await run({ surface, mutation, engine: 'jsdom' });
      const actual = await run({ surface, mutation, engine: 'rustdom' });
      observations.push({ surface, mutation, expected, actual });
      const { nativeReleased, nativeCalls, ...observable } = actual;
      assert.equal(expected.loadError, undefined);
      assert.equal(expected.reads, 0); assert.equal(expected.calls, 0);
      assert.ok(expected.cases.every((result) => result.name === 'TypeError' && !result.poisonIdentity));
      assert.ok(expected.cases.every((result) => result.trace.join(',') === 'iterator,next'));
      assert.deepEqual(observable, expected);
      assert.equal(nativeReleased, true); assert.ok(nativeCalls > 0);
    });
  }
}

after(() => {
  mkdirSync('reports/compatibility', { recursive: true });
  writeFileSync(`reports/compatibility/${capturedAt.replaceAll(':', '-')}-iterator-diagnostics.json`, `${JSON.stringify({
    capturedAt, node: process.version, jsdom: require('jsdom/package.json').version,
    xmlSerializer: require('w3c-xmlserializer/package.json').version, cases: observations,
  }, null, 2)}\n`);
});