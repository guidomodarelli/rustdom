/** @file Guards diagnostic parity against volatile Date descriptions without hiding semantic WPT failures. */
'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const { assertWptParity } = require('./wpt/comparison.cjs');

/** @param {string} clock - Diagnostic input time. @param {string} [error] - Actual thrown error description. @returns {object} Completed WPT failure observation. */
function observation(clock, error = 'TypeError: tmp is not iterable') {
  return { status: 0, message: null, tests: [{ name: 'Passing non-objects, Dates and RegExps for blobParts should throw a TypeError.', status: 1,
    message: `assert_throws_js: Should throw for argument object "Tue Sep 15 2026 ${clock} GMT-0300 (Argentina Standard Time)". function "function() { new Blob(arg); }" threw object "${error}" expected instance of function "function TypeError() { [native code] }"` }] };
}

test('should compare the same Blob failure across a wall-clock boundary while retaining raw observations', () => {
  const expected = observation('02:05:36'); const actual = observation('02:05:37'); const before = structuredClone(actual);
  assertWptParity('FileAPI/blob/Blob-constructor.any.js', actual, expected);
  assert.deepEqual(actual, before); assert.notEqual(actual.tests[0].message, expected.tests[0].message);
});

test('should still reject changed thrown errors, statuses, test names and harness failures', () => {
  const expected = observation('02:05:36');
  assert.throws(() => assertWptParity('FileAPI/blob/Blob-constructor.any.js', observation('02:05:37', 'RangeError: changed'), expected));
  for (const change of [
    (result) => { result.tests[0].status = 0; },
    (result) => { result.tests[0].name = 'different test'; },
    (result) => { result.status = 2; },
    (result) => { result.tests = []; },
  ]) { const actual = observation('02:05:37'); change(actual); assert.throws(() => assertWptParity('FileAPI/blob/Blob-constructor.any.js', actual, expected)); }
});

test('should preserve clock differences in other fixtures and assertion descriptions', () => {
  const expected = observation('02:05:36'); const actual = observation('02:05:37');
  assert.throws(() => assertWptParity('unrelated.html', actual, expected));
  actual.tests[0].message = actual.tests[0].message.replace('argument object', 'output object');
  assert.throws(() => assertWptParity('FileAPI/blob/Blob-constructor.any.js', actual, expected));
});
