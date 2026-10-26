/** @file Equivalent public iterator/walker scans, including actual filter callback crossings. */
'use strict';
const assert = require('node:assert/strict');

/** @param {object} runtime - Real runtime. @param {Window} window - Prepared DOM. @param {number} size - Row count. @param {string} name - Movement and filter workload. @returns {object} Timed scan plus untimed validation. */
function traversalFixture(runtime, window, size, name) {
  const root = window.document.querySelector('tbody');
  const iterator = name.startsWith('iterator-'); const filtered = name.endsWith('-filter');
  const expected = [root, ...root.querySelectorAll('*')].filter((node) => (!filtered || node.localName === 'tr') && (iterator || node !== root));
  let cursor; let calls = 0; let seen;
  const before = runtime.getNativeTreeStatistics?.().traversals.created;
  return {
    /** @returns {void} Prepare a fresh public cursor and callback outside timing. */
    prepare() {
      calls = 0; seen = [];
      const filter = filtered ? (node) => { calls++; return node.localName === 'tr' ? 1 : 3; } : null;
      cursor = window.document[iterator ? 'createNodeIterator' : 'createTreeWalker'](root, 1, filter);
    },
    /** @returns {number} Scan all accepted nodes while consuming their public names. */
    run() { let checksum = 0; let node; while ((node = cursor.nextNode()) !== null) { seen.push(node); checksum += node.nodeName.length; } return checksum; },
    /** @param {number} result - Timed checksum. @returns {void} Verify all identities, callback count and native activation. */
    validate(result) {
      assert.deepEqual(seen, expected); assert.equal(result, expected.reduce((sum, node) => sum + node.nodeName.length, 0));
      assert.equal(root.children.length, size);
      if (filtered) assert.equal(calls, root.querySelectorAll('*').length + Number(iterator));
      else assert.equal(calls, 0);
      if (before !== undefined) assert.ok(runtime.getNativeTreeStatistics().traversals.created > before);
    },
  };
}
module.exports = { traversalFixture };
