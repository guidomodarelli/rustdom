/** @file Compares complete FormData iterator transitions and mutable conversion behavior with independent jsdom. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Worker } = require('node:worker_threads');

/** Every worker exercises 152 protocol/value scenarios in two realms at both iterable sites. */
const EXPECTED_CASES = 608;
/** Mutation names describe observable consumer changes, not alternate implementation modes. */
const mutations = ['none', 'TypeError:getter', 'TypeError:constructor', 'TypeError:null',
  'String:getter', 'String:constructor', 'String:null', 'String:getter-function', 'String:ill-formed',
  'String:undefined-result', 'String:null-result', 'String:number-result', 'String:symbol-result',
  'String:method-getter', 'String:method-null', 'String:method-function'];

/** @param {string} engine - Actual implementation. @param {string} mutation - Consumer mutation. @returns {Promise<object>} Scalar observations after the worker exits cleanly. */
function run(engine, mutation) {
  return new Promise((resolve, reject) => {
    let result;
    const worker = new Worker(require.resolve('./helpers/formdata-iterator-errors.cjs'), { workerData: { engine, mutation } });
    worker.on('message', (value) => { result = value; });
    worker.on('error', reject);
    worker.on('exit', (code) => {
      if (code !== 0 || result === undefined) reject(new Error(`FormData iterator worker ${engine}/${mutation} exited ${code} without a complete result`));
      else resolve(result);
    });
  });
}

for (const mutation of mutations) {
  test(`should preserve FormData iterator diagnostics, close and realm under ${mutation}`, async () => {
    const expected = await run('jsdom', mutation);
    const observed = await run('rustdom', mutation);
    assert.equal(expected.failure, undefined);
    assert.equal(observed.failure, undefined);
    assert.equal(expected.cases.length, EXPECTED_CASES);
    assert.equal(observed.cases.length, EXPECTED_CASES);
    const { native, ...actualContract } = observed;
    assert.deepEqual(actualContract, expected);
    assert.equal(native.active, 0);
    assert.equal(native.builds, EXPECTED_CASES);
    assert.ok(observed.stringReceivers.every(Boolean));
    assert.ok(observed.conversionReceivers.every(Boolean));
  });
}
