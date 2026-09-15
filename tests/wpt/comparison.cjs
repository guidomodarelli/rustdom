/** @file Compares WPT results while retaining raw diagnostics and narrowly identifying volatile input descriptions. */
'use strict';
const assert = require('node:assert/strict');

/** This upstream test embeds `new Date()` only in its explanatory invalid-input description. */
const DATE_ARGUMENT_TEST = 'Passing non-objects, Dates and RegExps for blobParts should throw a TypeError.';
/** The specific diagnostic prefix excludes actual thrown/expected values, stacks and other assertion text. */
const DATE_ARGUMENT_DESCRIPTION = /^(assert_throws_js: Should throw for argument object ")(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun) (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{2} \d{4} \d{2}:\d{2}:\d{2} GMT[+-]\d{4} \([^"\r\n]*\)("\. function )/u;

/** @param {string} file - Upstream fixture path. @param {object} result - Raw WPT result. @returns {object} Comparison copy with only the known wall-clock input description canonicalized. */
function comparableResult(file, result) {
  if (file !== 'FileAPI/blob/Blob-constructor.any.js') return result;
  return { ...result, tests: result.tests.map((entry) => entry.name === DATE_ARGUMENT_TEST && entry.status === 1 && typeof entry.message === 'string'
    ? { ...entry, message: entry.message.replace(DATE_ARGUMENT_DESCRIPTION, '$1<Date input>$2') } : entry) };
}

/** @param {string} file - Fixture path. @param {object} actual - Actual engine observations. @param {object} expected - Oracle observations. @returns {void} Reject every semantic result mismatch and incomplete harness run. */
function assertWptParity(file, actual, expected) {
  assert.equal(expected.status, 0); assert.equal(actual.status, 0);
  assert.ok(expected.tests.length > 0);
  assert.deepEqual(comparableResult(file, actual), comparableResult(file, expected));
}

module.exports = { assertWptParity };
