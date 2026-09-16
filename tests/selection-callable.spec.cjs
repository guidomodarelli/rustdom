/** @file Compares Range method slots and intrinsic Selection errors against the independent jsdom runtime. */
'use strict';
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { writeFileSync } = require('node:fs');
const engines = { jsdom: require('jsdom'), rustdom: require('../dist/index.cjs') };
const NativeTypeError = TypeError;
const report = { capturedAt: new Date().toISOString(), node: process.version, reference: require('jsdom/package.json').version, cases: [] };
/** Values exercise non-callable slots, construct-only functions and ordinary callable receiver identity. */
const kinds = ['undefined', 'null', 'boolean', 'number', 'bigint', 'string', 'symbol', 'object', 'noncallable-proxy', 'class', 'callable', 'callable-proxy', 'revoked-proxy'];
/** @param {string} kind - Input category. @param {object} range - Real Range implementation. @returns {unknown} Fresh method slot input. */
function methodValue(kind, range) {
  if (kind === 'undefined') return undefined;
  if (kind === 'null') return null;
  if (kind === 'boolean') return false;
  if (kind === 'number') return 0;
  if (kind === 'bigint') return 1n;
  if (kind === 'string') return 'not callable';
  if (kind === 'symbol') return Symbol('not callable');
  if (kind === 'object') return {};
  if (kind === 'noncallable-proxy') return new Proxy({}, {});
  if (kind === 'class') return class RangeMethodConstructor {};
  const callable = function callableRangeMethod() { assert.equal(this, range); return 'custom'; };
  if (kind === 'callable-proxy') return new Proxy(callable, {});
  if (kind === 'revoked-proxy') { const revocable = Proxy.revocable(callable, {}); revocable.revoke(); return revocable.proxy; }
  return callable;
}
for (const mode of ['default', 'vm']) {
  for (const method of ['toString', 'deleteContents']) {
    test(`should preserve Selection diagnostics when ${method} changes in ${mode}`, () => {
      const observations = {};
      for (const [engine, runtime] of Object.entries(engines)) {
        const dom = new runtime.JSDOM('<p>abcdef</p>', mode === 'vm' ? { runScripts: 'outside-only' } : {});
        const outcomes = [];
        try {
          const WindowTypeError = dom.window.TypeError;
          const selection = dom.window.getSelection(); selection.collapse(dom.window.document.querySelector('p').firstChild, 1);
          const wrapper = selection.getRangeAt(0);
          const range = wrapper[Object.getOwnPropertySymbols(wrapper).find((symbol) => symbol.description === 'impl')];
          const original = Object.getOwnPropertyDescriptor(range, method);
          try {
            for (const kind of kinds) {
              for (const mutation of ['unchanged', 'null', 'getter']) {
                const value = methodValue(kind, range); let reads = 0; let hooks = 0;
                const globalDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'TypeError');
                Object.defineProperty(range, method, { configurable: true, get() { reads++; return value; } });
                let result;
                try {
                  if (mutation === 'null') Object.defineProperty(globalThis, 'TypeError', { configurable: true, value: null });
                  if (mutation === 'getter') Object.defineProperty(globalThis, 'TypeError', { configurable: true, get() { hooks++; throw new Error('unexpected TypeError getter'); } });
                  try {
                    const returned = method === 'toString' ? String(selection) : selection.deleteFromDocument();
                    result = { threw: false, returned };
                  } catch (error) {
                    result = { threw: true, name: error.name, message: error.message, intrinsicTypeError: error instanceof NativeTypeError, windowTypeError: error instanceof WindowTypeError };
                  }
                } finally { Object.defineProperty(globalThis, 'TypeError', globalDescriptor); }
                outcomes.push({ kind, mutation, reads, hooks, ...result });
              }
            }
          } finally { if (original) Object.defineProperty(range, method, original); else delete range[method]; }
        } finally { dom.window.close(); }
        observations[engine] = outcomes;
      }
      report.cases.push({ mode, method, ...observations });
      assert.deepEqual(observations.rustdom, observations.jsdom);
      for (const outcome of observations.rustdom) { assert.equal(outcome.reads, 1); assert.equal(outcome.hooks, 0); }
    });
  }
}
after(() => { writeFileSync(`reports/compatibility/${report.capturedAt.replaceAll(':', '-')}-selection-callable.json`, `${JSON.stringify(report, null, 2)}\n`); });
