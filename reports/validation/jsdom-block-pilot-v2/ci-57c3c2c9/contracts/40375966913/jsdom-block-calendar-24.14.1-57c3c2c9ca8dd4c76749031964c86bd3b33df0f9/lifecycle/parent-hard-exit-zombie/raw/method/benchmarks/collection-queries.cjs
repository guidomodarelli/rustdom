/** @module benchmarks/collection-queries Measures live collection refresh, creation and stable cached reads through public DOM APIs. */
'use strict';
const assert = require('node:assert/strict');
const { COLLECTION_QUERY_ITERATIONS, MANY_CLASS_QUERY_TOKEN_COUNT, COLLECTION_QUERY_WORKLOADS, HTML_NAMESPACE, COLLECTION_NAMESPACE } = require('./constants/collection-queries.cjs');

/** @param {object} runtime - Real engine. @param {Window} window - Prepared realm. @param {number} size - Descendant count. @param {string} name - Canonical workload. @returns {object} Timed operation with untimed validation and cleanup. */
function collectionQueryFixture(runtime, window, size, name) {
  assert.ok(COLLECTION_QUERY_WORKLOADS.includes(name), `Unsupported collection query benchmark: ${name}`);
  let root = window.document.createElement('section');
  let expected = [];
  const isTag = name === 'collection-tag-live';
  const isNamespace = name === 'collection-namespace-live';
  const creates = name === 'collection-class-create';
  const cached = name === 'collection-class-cached';
  const classQuery = name === 'collection-class-many-live'
    ? Array.from({ length: MANY_CLASS_QUERY_TOKEN_COUNT }, (_, index) => `token-${index}`).join(' ') : 'match shared';
  for (let index = 0; index < size; index++) {
    const namespace = index % 4 === 0 ? COLLECTION_NAMESPACE : HTML_NAMESPACE;
    const localName = namespace === COLLECTION_NAMESPACE ? 'x:entry' : 'div';
    const element = window.document.createElementNS(namespace, localName);
    element.setAttribute('class', index % 2 === 0 ? classQuery : 'other shared');
    element.setAttribute('data-entry', String(index)); root.append(element);
    if (isTag ? namespace === HTML_NAMESPACE : isNamespace ? namespace === COLLECTION_NAMESPACE : index % 2 === 0) expected.push(element);
  }
  window.document.body.append(root);
  /** @returns {HTMLCollection} Actual generated live collection. */
  const select = () => isTag ? root.getElementsByTagName('DIV')
    : isNamespace ? root.getElementsByTagNameNS(COLLECTION_NAMESPACE, 'entry') : root.getElementsByClassName(classQuery);
  let collection = creates ? null : select();
  const before = runtime.getNativeTreeStatistics?.().nativeCollectionQueries;
  if (runtime.getNativeTreeStatistics && !process.env.RUSTDOM_BENCHMARK_PACKAGE) assert.equal(typeof before, 'number', 'Workspace collections must execute native filtering');
  return {
    /** @returns {number} Consume length and the final result identity after every operation. */
    run() {
      let checksum = 0;
      for (let iteration = 0; iteration < COLLECTION_QUERY_ITERATIONS; iteration++) {
        if (!cached) root.setAttribute('data-query-version', String(iteration));
        if (creates) collection = select();
        checksum += collection.length + Number(collection.item(expected.length - 1) === expected.at(-1));
      }
      return checksum;
    },
    /** @param {number} checksum - Timed public results. @returns {void} Check every element, actual refreshes and the unchanged descendant tree. */
    validate(checksum) {
      assert.equal(checksum, COLLECTION_QUERY_ITERATIONS * (expected.length + 1));
      assert.deepEqual(Array.from(collection), expected);
      assert.equal(root.children.length, size);
      for (const [index, element] of expected.entries()) assert.equal(collection.item(index), element);
      if (before !== undefined) {
        const delta = runtime.getNativeTreeStatistics().nativeCollectionQueries - before;
        assert.equal(delta, cached ? 0 : COLLECTION_QUERY_ITERATIONS);
      }
    },
    /** @returns {void} Remove the fixture and release every retained DOM/collection reference. */
    dispose() { root.remove(); root = null; expected = null; collection = null; },
  };
}
module.exports = { collectionQueryFixture };
