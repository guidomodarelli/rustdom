/** @module benchmarks/name-queries Measures real global Document name queries and live NodeList caching. */
'use strict';
const assert = require('node:assert/strict');
const { HTML_NAMESPACE, COLLECTION_NAMESPACE } = require('./constants/collection-queries.cjs');
const { NAME_QUERY_CREATE, NAME_QUERY_LIVE, NAME_QUERY_CACHED, NAME_QUERY_MISS, NAME_QUERY_WORKLOADS,
  NAME_QUERY_ITERATIONS, NAME_QUERY_SELECTED_VALUE, NAME_QUERY_OTHER_VALUE, NAME_QUERY_MISSING_VALUE,
  NAME_QUERY_ENTRY_ATTRIBUTE, NAME_QUERY_VERSION_ATTRIBUTE } = require('./constants/name-queries.cjs');

/** @param {object} runtime - Real DOM engine. @param {Window} window - Prepared owner. @param {number} size - Element count. @param {string} name - Canonical public workload. @returns {object} Public operations with untimed complete identity/path validation and cleanup. */
function nameQueryFixture(runtime, window, size, name) {
  assert.ok(NAME_QUERY_WORKLOADS.includes(name), `Unsupported document name benchmark: ${name}`);
  let document = window.document;
  let root = document.createElement('section');
  let nodes = [], matched = [];
  for (let index = 0; index < size; index++) {
    const namespace = index % 2 === 0 ? HTML_NAMESPACE : COLLECTION_NAMESPACE;
    const node = document.createElementNS(namespace, namespace === HTML_NAMESPACE ? 'div' : 'p:entry');
    const selected = index % 4 < 2;
    node.setAttribute(NAME_QUERY_ENTRY_ATTRIBUTE, String(index));
    node.setAttributeNS(null, 'name', selected ? NAME_QUERY_SELECTED_VALUE : NAME_QUERY_OTHER_VALUE);
    // A same-local-name namespaced attribute must never affect the selected set.
    node.setAttributeNS(COLLECTION_NAMESPACE, 'p:name', NAME_QUERY_MISSING_VALUE);
    root.append(node); nodes.push(node); if (selected) matched.push(node);
  }
  document.body.append(root);
  const miss = name === NAME_QUERY_MISS;
  const fresh = name === NAME_QUERY_CREATE || miss;
  const query = miss ? NAME_QUERY_MISSING_VALUE : NAME_QUERY_SELECTED_VALUE;
  let expected = miss ? [] : matched;
  let retained = fresh ? null : document.getElementsByName(query);
  // Initial construction/cache population is deliberately outside the measured interval.
  if (retained) assert.equal(retained.length, expected.length);
  const before = runtime.getNativeTreeStatistics?.().nativeCollectionQueries;
  if (runtime.getNativeTreeStatistics && !process.env.RUSTDOM_BENCHMARK_PACKAGE) assert.equal(typeof before, 'number');
  return {
    /** @returns {number} Consume every actual NodeList length and final matching identity. */
    run() {
      let checksum = 0;
      for (let iteration = 0; iteration < NAME_QUERY_ITERATIONS; iteration++) {
        if (name === NAME_QUERY_LIVE) root.setAttribute(NAME_QUERY_VERSION_ATTRIBUTE, String(iteration));
        const list = fresh ? document.getElementsByName(query) : retained;
        checksum += list.length + Number(list.item(miss ? 0 : expected.length - 1) === (miss ? null : expected.at(-1)));
      }
      return checksum;
    },
    /** @param {number} checksum - Timed result. @returns {void} Check native activity first, then every identity/attribute and the full result. */
    validate(checksum) {
      assert.equal(checksum, NAME_QUERY_ITERATIONS * (expected.length + 1));
      if (before !== undefined && !process.env.RUSTDOM_BENCHMARK_PACKAGE) {
        assert.equal(runtime.getNativeTreeStatistics().nativeCollectionQueries - before, name === NAME_QUERY_CACHED ? 0 : NAME_QUERY_ITERATIONS);
      }
      assert.equal(root.childNodes.length, size);
      for (const [index, node] of nodes.entries()) {
        assert.equal(root.childNodes.item(index), node);
        assert.equal(node.getAttribute(NAME_QUERY_ENTRY_ATTRIBUTE), String(index));
        assert.equal(node.getAttributeNS(null, 'name'), index % 4 < 2 ? NAME_QUERY_SELECTED_VALUE : NAME_QUERY_OTHER_VALUE);
        assert.equal(node.getAttributeNS(COLLECTION_NAMESPACE, 'name'), NAME_QUERY_MISSING_VALUE);
      }
      assert.deepEqual(Array.from(document.getElementsByName(query)), expected);
      assert.deepEqual(Array.from(document.getElementsByName(NAME_QUERY_SELECTED_VALUE)), matched);
    },
    /** @returns {void} Restore the body and release every extra strong fixture reference. */
    dispose() { root.remove(); root = null; document = null; nodes = null; matched = null; expected = null; retained = null; },
  };
}
module.exports = { nameQueryFixture };
