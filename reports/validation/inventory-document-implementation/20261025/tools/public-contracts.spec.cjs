/** @file Exercises real DOMImplementation receivers, unused arguments, realms and native control without measuring performance. */
'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const runtime = require(process.env.RUSTDOM_DOCUMENT_INVENTORY_RUNTIME);
const reference = require(process.env.RUSTDOM_DOCUMENT_INVENTORY_REFERENCE);
const native = require(process.env.RUSTDOM_DOCUMENT_INVENTORY_NATIVE);

/** @param {object} engine - Real independent engine. @param {boolean} vm - Separate realm mode. @returns {object} Observable public contract and resource state. */
function observe(engine, vm) {
  const options = vm ? { runScripts: 'outside-only' } : {};
  const first = new engine.JSDOM('', options);
  let second; let owner; let descriptors;
  try {
    second = new engine.JSDOM('', options);
    const { window } = first;
    const api = window.document.implementation;
    const method = window.DOMImplementation.prototype.hasFeature;
    const secondApi = second.window.document.implementation;
    assert.throws(() => new window.DOMImplementation(), window.TypeError);
    assert.throws(() => method.call({}), window.TypeError);
    owner = api[Object.getOwnPropertySymbols(api).find((symbol) => symbol.description === 'impl')];
    descriptors = Object.fromEntries(['_globalObject', '_ownerDocument'].map((name) => [name, Object.getOwnPropertyDescriptor(owner, name)]));
    let reads = 0;
    for (const name of Object.keys(descriptors)) Object.defineProperty(owner, name, {
      configurable: true, get() { reads++; throw new Error('hasFeature must not read its owner'); },
    });
    let coercions = 0;
    const unused = { [Symbol.toPrimitive]() { coercions++; throw new Error('hasFeature must not coerce unused arguments'); } };
    const before = native.documentImplementationStatistics();
    const values = [method.call(api, unused, Symbol('version')), method.call(secondApi), method.call(api, undefined)];
    const after = native.documentImplementationStatistics();
    assert.deepEqual(values, [true, true, true]); assert.equal(reads, 0); assert.equal(coercions, 0);
    if (engine === runtime) assert.equal(after.calls - before.calls, 3);
    else assert.equal(after.calls, before.calls);
    assert.equal(after.active, 0);
    return { values, reads, coercions, crossRealm: secondApi instanceof second.window.DOMImplementation };
  } finally {
    if (owner && descriptors) for (const [name, descriptor] of Object.entries(descriptors)) {
      if (descriptor) Object.defineProperty(owner, name, descriptor); else delete owner[name];
    }
    first.window.close(); second?.window.close();
  }
}
for (const vm of [false, true]) test(`should preserve receivers, unused arguments and native hasFeature control in ${vm ? 'VM' : 'default'} realms`, () => {
  assert.deepEqual(observe(runtime, vm), observe(reference, vm));
});
