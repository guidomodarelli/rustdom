/** @file Measures parsing, membership, bulk additions and ordered replacement through actual classList. */
'use strict';
const assert = require('node:assert/strict');

/** @param {object} runtime - Actual engine. @param {Window} window - Prepared realm. @param {number} size - Number of unique tokens. @param {string} name - Operation. @returns {object} Timed work with untimed checks. */
function tokenListFixture(runtime, window, size, name) {
  const tokens = Array.from({ length: size }, (_, index) => `t${index}`);
  const missing = tokens.map((token) => `missing-${token}`);
  const element = window.document.createElement('div'); window.document.body.append(element);
  const before = runtime.getNativeTreeStatistics?.().tokenLists.created;
  element.setAttribute('class', name === 'token-add' ? '' : tokens.flatMap((token) => [token, token]).join('  '));
  const list = element.classList;
  if (name !== 'token-parse') assert.equal(list.length, name === 'token-add' ? 0 : size);
  return {
    /** @returns {number} Consumed result of the actual public operation. */
    run() {
      if (name === 'token-parse') return list.length + list.item(0).length + list.item(size - 1).length;
      if (name === 'token-contains') { let count = 0; for (let index = 0; index < size; index++) count += Number(list.contains(tokens[index])) + Number(list.contains(missing[index])); return count; }
      if (name === 'token-add') { list.add(...tokens); return list.value.length; }
      const replaced = list.replace(tokens[0], tokens.at(-1));
      return list.value.length + Number(replaced);
    },
    /** @param {number} result - Timed checksum. @returns {void} Verify order, duplicates, raw/canonical values and activation. */
    validate(result) {
      if (name === 'token-parse') assert.equal(result, size + tokens[0].length + tokens.at(-1).length);
      else if (name === 'token-contains') assert.equal(result, size);
      else assert.equal(result, list.value.length + Number(name === 'token-replace'));
      const expected = name === 'token-replace' ? [tokens.at(-1), ...tokens.slice(1, -1)] : tokens;
      assert.deepEqual([...list], expected);
      if (name === 'token-add' || name === 'token-replace') assert.equal(element.getAttribute('class'), expected.join(' '));
      else assert.equal(element.getAttribute('class'), tokens.flatMap((token) => [token, token]).join('  '));
      if (before !== undefined) assert.ok(runtime.getNativeTreeStatistics().tokenLists.created > before);
    },
  };
}
module.exports = { tokenListFixture };
