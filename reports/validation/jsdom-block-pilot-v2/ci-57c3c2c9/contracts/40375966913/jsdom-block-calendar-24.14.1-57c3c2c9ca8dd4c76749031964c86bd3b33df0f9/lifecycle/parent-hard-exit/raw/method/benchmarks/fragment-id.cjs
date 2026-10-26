/** @module benchmarks/fragment-id Measures first/last/missing ID lookups over real physical fragment scopes. */
'use strict';
const assert = require('node:assert/strict');
const { HTML_NAMESPACE, COLLECTION_NAMESPACE } = require('./constants/collection-queries.cjs');
const { FRAGMENT_ID_FIRST, FRAGMENT_ID_MISS, SHADOW_ID_LAST, FRAGMENT_ID_WORKLOADS,
  FRAGMENT_ID_ITERATIONS, FRAGMENT_ID_SELECTED_VALUE, FRAGMENT_ID_MISSING_VALUE,
  FRAGMENT_ID_OTHER_PREFIX, FRAGMENT_ID_ENTRY_ATTRIBUTE } = require('./constants/fragment-id.cjs');

/** @param {object} runtime - Actual engine. @param {Window} window - Prepared owner. @param {number} size - Element count. @param {string} name - Public workload. @returns {object} Timed lookups and complete untimed validation/serialization/cleanup. */
function fragmentIdFixture(runtime, window, size, name) {
  assert.ok(FRAGMENT_ID_WORKLOADS.includes(name), `Unsupported fragment ID benchmark: ${name}`);
  let host = name === SHADOW_ID_LAST ? window.document.createElement('div') : null;
  let scope = host ? host.attachShadow({ mode: 'open' }) : window.document.createDocumentFragment();
  if (host) window.document.body.append(host);
  const miss = name === FRAGMENT_ID_MISS;
  const selectedIndex = name === FRAGMENT_ID_FIRST ? 0 : size - 1;
  let nodes = [];
  for (let index = 0; index < size; index++) {
    const namespace = index % 2 === 0 ? HTML_NAMESPACE : COLLECTION_NAMESPACE;
    const element = window.document.createElementNS(namespace, namespace === HTML_NAMESPACE ? 'div' : 'p:entry');
    element.setAttribute(FRAGMENT_ID_ENTRY_ATTRIBUTE, String(index));
    element.setAttributeNS(null, 'id', !miss && index === selectedIndex ? FRAGMENT_ID_SELECTED_VALUE : `${FRAGMENT_ID_OTHER_PREFIX}${index}`);
    element.setAttributeNS(COLLECTION_NAMESPACE, 'p:id', FRAGMENT_ID_MISSING_VALUE);
    scope.append(element); nodes.push(element);
  }
  const query = miss ? FRAGMENT_ID_MISSING_VALUE : FRAGMENT_ID_SELECTED_VALUE;
  let target = miss ? null : nodes[selectedIndex];
  assert.equal(scope.getElementById(query), target);
  const before = runtime.getNativeTreeStatistics?.().nativeCollectionQueries;
  return {
    /** @returns {number} Consume the identity returned by every actual public lookup. */
    run() {
      let checksum = 0;
      for (let iteration = 0; iteration < FRAGMENT_ID_ITERATIONS; iteration++) checksum += Number(scope.getElementById(query) === target);
      return checksum;
    },
    /** @param {number} checksum - Measured result. @returns {void} Check native activity first, then all nodes, namespaces, attributes and result identities. */
    validate(checksum) {
      assert.equal(checksum, FRAGMENT_ID_ITERATIONS);
      if (before !== undefined && !process.env.RUSTDOM_BENCHMARK_PACKAGE) {
        assert.equal(runtime.getNativeTreeStatistics().nativeCollectionQueries - before, FRAGMENT_ID_ITERATIONS);
      }
      assert.equal(scope.childNodes.length, size);
      for (const [index, element] of nodes.entries()) {
        assert.equal(scope.childNodes.item(index), element);
        assert.equal(element.namespaceURI, index % 2 === 0 ? HTML_NAMESPACE : COLLECTION_NAMESPACE);
        assert.equal(element.getAttribute(FRAGMENT_ID_ENTRY_ATTRIBUTE), String(index));
        assert.equal(element.getAttributeNS(null, 'id'), !miss && index === selectedIndex ? FRAGMENT_ID_SELECTED_VALUE : `${FRAGMENT_ID_OTHER_PREFIX}${index}`);
        assert.equal(element.getAttributeNS(COLLECTION_NAMESPACE, 'id'), FRAGMENT_ID_MISSING_VALUE);
      }
      assert.equal(scope.getElementById(query), target);
      assert.equal(scope.getElementById(FRAGMENT_ID_MISSING_VALUE), null);
      assert.equal(scope.getElementById(''), null);
    },
    /** @returns {string} Hash every prepared descendant outside timing, including detached/shadow content. */
    serialize() { return new window.XMLSerializer().serializeToString(scope); },
    /** @returns {void} Restore the original document and release every strong fixture reference. */
    dispose() { scope.replaceChildren(); host?.remove(); host = null; scope = null; nodes = null; target = null; window = null; },
  };
}
module.exports = { fragmentIdFixture };
