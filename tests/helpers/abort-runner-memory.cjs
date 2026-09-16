/** @file Exercises the shared runner fixture with real Node tests, DOMs and weak realm observations. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { writeFileSync } = require('node:fs');
const { JSDOM } = require('@rustdom/rustdom');
const { NativeAbortState } = require('@rustdom/rustdom/native');
const registerAbortSuite = require('../integration/abort-suite.cjs');
const { captureMemoryState, waitForMemoryQuiescence } = require('../../scripts/memory-endpoint.cjs');

/** @param {unknown} actual - Observed public result. @returns {object} Node strict assertions in the shared runner matcher shape. */
function expectWithNode(actual) {
  return { toBe(expected) { assert.strictEqual(actual, expected); }, toEqual(expected) { assert.deepStrictEqual(actual, expected); } };
}

test('should collect every owned native Window and Document while parent environment and test callbacks remain alive', async (context) => {
  assert.equal(typeof global.gc, 'function');
  const { default: environment } = await import('../../src/environments/vitest.mjs');
  const target = { setTimeout, clearTimeout }; const session = environment.setup(target, {});
  const observed = { documents: [], windows: [] };
  const initialAbortStates = NativeAbortState.statistics().live;
  let endpoint;
  try {
    for (let cycle = 0; cycle < 5; cycle++) {
      const pending = [];
      registerAbortSuite({ runnerGlobal: target, expect: expectWithNode,
        /** @returns {object} A real owned JSDOM with weak observations recorded before the shared fixture closes it. */
        createNativeDom() {
          const dom = new JSDOM('<!doctype html>');
          observed.documents.push(new WeakRef(dom.window.document));
          observed.windows.push(new WeakRef(dom.window));
          return dom;
        },
        test: (name, callback) => { const result = context.test(`${name}, cycle ${cycle}`, callback); pending.push(result); return result; } });
      await Promise.all(pending);
    }
    assert.equal(observed.documents.length, 5); assert.equal(observed.windows.length, 5);
    endpoint = await waitForMemoryQuiescence({ label: 'shared-runner-owned-dom-fixture', sample: () => captureMemoryState(observed, null) });
    assert.equal(endpoint.reached, true, JSON.stringify(endpoint.state));
    assert.equal(NativeAbortState.statistics().live, initialAbortStates);
  } finally {
    session.teardown();
    writeFileSync(`reports/validation/abort-runner-node24/fixture-memory-${process.version}.json`, JSON.stringify({ node: process.version, endpoint }, null, 2) + '\n');
  }
});
