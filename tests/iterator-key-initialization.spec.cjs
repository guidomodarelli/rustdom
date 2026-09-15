/** @file Differential intrinsic-key initialization against the real XML oracle in fresh Workers. */
'use strict';
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { Worker } = require('node:worker_threads');
const { mkdirSync, writeFileSync } = require('node:fs');
const { resolve } = require('node:path');
const capturedAt = new Date().toISOString();
const observations = [];

/** @param {object} workerData - Isolated engine and mutation. @returns {Promise<object>} Results only after the Worker exits and its Env is finalized. */
function run(workerData) {
  return new Promise((resolveResult, reject) => {
    const worker = new Worker(require.resolve('./helpers/iterator-key-initialization.cjs'), { workerData });
    let output;
    worker.once('message', (message) => { output = message; });
    worker.once('error', reject);
    worker.once('exit', (code) => code === 0 ? resolveResult(output) : reject(new Error(`Iterator key Worker exited with ${code}`)));
  });
}

for (const mutation of ['array-deleted', 'array-getter', 'combined-globals', 'iterator-getter', 'iterator-decoy', 'iterator-deleted', 'generator-chain-null', 'both-iterators-deleted', 'array-deleted-generator-chain-null', 'both-deleted-globals', 'chain-null-globals', 'both-deleted-poisoned-host-prototype', 'builtin-loader-getter', 'array-deleted-builtin-loader-getter']) {
  test(`should initialize and serialize own iterables when ${mutation} is applied before load`, async () => {
    const addonPath = process.env.RUSTDOM_ITERATOR_KEY_ADDON ? resolve(process.env.RUSTDOM_ITERATOR_KEY_ADDON) : require.resolve('../dist/rustdom.node');
    const expected = await run({ engine: 'jsdom', mutation, addonPath });
    const actual = await run({ engine: 'rustdom', mutation, addonPath });
    observations.push({ mutation, expected, actual });
    const { nativeCalls, nativeReleased, ...observable } = actual;
    assert.equal(expected.loadError, undefined); assert.equal(expected.reads, 0);
    assert.ok(expected.cases.filter((entry) => entry.scenario === 0).every((entry) => entry.value === '&lt;ready&gt;'));
    assert.ok(expected.cases.filter((entry) => entry.scenario === 2).every((entry) => entry.sameMarker && entry.sameCause && entry.trace.at(-1) === 'return'));
    assert.deepEqual(observable, expected);
    assert.ok(nativeCalls > 0); assert.equal(nativeReleased, true);
  });
}

for (const mutation of ['both-deleted-globals', 'chain-null-globals']) {
  test(`should keep the public XML runtime usable after native initialization with ${mutation}`, async () => {
    const runtimeDirectory = process.env.RUSTDOM_ITERATOR_KEY_RUNTIME ? resolve(process.env.RUSTDOM_ITERATOR_KEY_RUNTIME) : resolve(__dirname, '../dist');
    const addonPath = resolve(runtimeDirectory, 'rustdom.node');
    const expected = await run({ engine: 'jsdom', mutation, addonPath, runtimeDirectory, publicRuntime: true });
    const actual = await run({ engine: 'rustdom', mutation, addonPath, runtimeDirectory, publicRuntime: true });
    observations.push({ mutation, entryPoint: 'public', expected, actual });
    const { nativeCalls, nativeReleased, publicNativeCalls, ...observable } = actual;
    assert.equal(expected.loadError, undefined); assert.equal(expected.publicError, undefined);
    assert.equal(expected.publicValue, '<root><value>ready</value></root>');
    assert.deepEqual(observable, expected);
    assert.ok(nativeCalls > 0); assert.equal(nativeReleased, true); assert.ok(publicNativeCalls > 0);
  });
}
after(() => {
  mkdirSync('reports/compatibility', { recursive: true });
  writeFileSync(`reports/compatibility/${capturedAt.replaceAll(':', '-')}-iterator-key.json`, `${JSON.stringify({
    capturedAt, node: process.version, reference: require('w3c-xmlserializer/package.json').version, cases: observations,
  }, null, 2)}\n`);
});