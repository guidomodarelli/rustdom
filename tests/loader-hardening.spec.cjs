/** @file Compares actual cold/warm native serializer entry points under the same host mutations. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Worker } = require('node:worker_threads');
const { resolve } = require('node:path');
/** @param {object} workerData - Actual entry point and timing. @returns {Promise<object>} Result after releasing the Env. */
function run(workerData) { return new Promise((resolveResult, reject) => {
  const worker = new Worker(require.resolve('./helpers/loader-conditions.cjs'), { workerData }); let result;
  worker.once('message', (message) => { result = message; }); worker.once('error', reject);
  worker.once('exit', (code) => code === 0 ? resolveResult(result) : reject(new Error(`Native loader Worker exited ${code}`)));
}); }
for (const target of ['native', 'addon']) {
  test(`should preserve ${target} warm-load behavior against an equivalently loaded serializer`, async () => {
    const runtimeDirectory = resolve(process.env.RUSTDOM_LOADER_RUNTIME ?? 'dist');
    const expected = await run({ target: 'serializer', mode: 'warm', runtimeDirectory });
    const actual = await run({ target, mode: 'warm', runtimeDirectory });
    assert.equal(expected.phase, 'complete'); assert.equal(expected.value, 'ready'); assert.equal(expected.hookReads, 0);
    assert.equal(actual.phase, expected.phase, JSON.stringify(actual));
    assert.equal(actual.value, expected.value); assert.equal(actual.hookReads, 0); assert.ok(actual.nativeCalls > 0);
  });
  test(`should initialize ${target} cold without consulting the replaced builtin hook`, async () => {
    const runtimeDirectory = resolve(process.env.RUSTDOM_LOADER_RUNTIME ?? 'dist');
    const actual = await run({ target, mode: 'cold', runtimeDirectory });
    assert.equal(actual.phase, 'complete', JSON.stringify(actual));
    assert.equal(actual.value, 'ready'); assert.equal(actual.hookReads, 0); assert.ok(actual.nativeCalls > 0);
  });
}