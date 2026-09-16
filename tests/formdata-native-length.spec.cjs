/** @file Verifies runtime initialization parity and native ID lengths without mutable host constructors. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { NativeFormDataEntries } = require('../dist/native.cjs');

for (const mode of ['default', 'vm']) for (const preparation of ['cold', 'preloaded']) {
  for (const mutation of ['undefined', 'null', 'replacement', 'prototype-hook', 'global-getter']) {
    test(`should preserve FormData initialization with ${mutation} Float64Array in ${preparation}/${mode}`, () => {
      const outcomes = [];
      for (const engine of ['jsdom', 'rustdom']) {
        const child = spawnSync(process.execPath, ['tests/helpers/formdata-native-length-load.cjs', engine, preparation, mutation, mode], { encoding: 'utf8', timeout: 60_000 });
        assert.equal(child.error, undefined); assert.equal(child.status, 0, child.stderr);
        const { engine: ignoredEngine, errorStack, ...result } = JSON.parse(child.stdout);
        outcomes.push(result);
      }
      assert.deepEqual(outcomes[1], outcomes[0]);
      if (mutation === 'replacement' || mutation === 'prototype-hook' || preparation === 'preloaded' && mutation === 'undefined') {
        assert.equal(outcomes[0].pass, true);
        assert.deepEqual(outcomes[0].initial, ['first', 'second']);
        assert.deepEqual(outcomes[0].entries, [['tail', 'value']]);
        assert.equal(outcomes[0].prototypeReads, 0);
      }
    });
  }
}

test('should read typed ID metadata without constructors, getters, iteration or mutation', () => {
  const list = new NativeFormDataEntries();
  for (let index = 0; index < 5; index++) list.append('key', 'value');
  const ids = list.ids('key'), empty = list.ids('missing'), offset = ids.subarray(1, 3);
  const length = NativeFormDataEntries.idArrayLength;
  const FloatConstructor = Float64Array;
  const originalGlobal = Object.getOwnPropertyDescriptor(globalThis, 'Float64Array');
  const keys = ['length', 'buffer', 'byteLength', 'byteOffset', Symbol.iterator];
  const descriptors = keys.map((key) => Object.getOwnPropertyDescriptor(FloatConstructor.prototype, key));
  let calls = 0;
  try {
    Object.defineProperty(globalThis, 'Float64Array', { configurable: true, get() { calls++; throw new Error('constructor lookup'); } });
    for (const key of keys) Object.defineProperty(FloatConstructor.prototype, key, { configurable: true, get() { calls++; throw new Error('prototype lookup'); } });
    assert.equal(length(ids), 5); assert.equal(length(empty), 0); assert.equal(length(offset), 2);
  } finally {
    Object.defineProperty(globalThis, 'Float64Array', originalGlobal);
    keys.forEach((key, index) => { if (descriptors[index]) Object.defineProperty(FloatConstructor.prototype, key, descriptors[index]); else delete FloatConstructor.prototype[key]; });
  }
  assert.equal(calls, 0); assert.deepEqual(Array.from(ids), [1, 2, 3, 4, 5]);
  for (const invalid of [null, undefined, [], {}, new Uint8Array(2)]) assert.throws(() => length(invalid));
});
