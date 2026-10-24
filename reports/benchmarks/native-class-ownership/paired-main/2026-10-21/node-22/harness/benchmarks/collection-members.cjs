/** @module benchmarks/collection-members Measures public named lookup and complete own-property enumeration on stable live collections. */
'use strict';
const assert = require('node:assert/strict');
const { HTML_NAMESPACE, COLLECTION_NAMESPACE } = require('./constants/collection-queries.cjs');
const { COLLECTION_MEMBER_LOOKUP_ITERATIONS, COLLECTION_MEMBER_ENUMERATION_ITERATIONS, COLLECTION_MEMBER_WORKLOADS } = require('./constants/collection-members.cjs');

/** @param {object} runtime - Real engine. @param {Window} window - Prepared realm. @param {number} size - Member count. @param {string} name - Canonical workload. @returns {object} Timed public operation with independent result checks and cleanup. */
function collectionMemberFixture(runtime, window, size, name) {
  assert.ok(COLLECTION_MEMBER_WORKLOADS.includes(name), `Unsupported collection member benchmark: ${name}`);
  let root = window.document.createElement('section');
  let expected = [];
  let propertyNames = Array.from({ length: size }, (_, index) => String(index));
  for (let index = 0; index < size; index++) {
    const namespace = index % 4 === 0 ? COLLECTION_NAMESPACE : HTML_NAMESPACE;
    const element = window.document.createElementNS(namespace, 'entry');
    element.setAttribute('id', `member-${index}`);
    element.setAttribute('name', `alias-${index}`);
    root.append(element); expected.push(element);
    propertyNames.push(`member-${index}`);
    if (namespace === HTML_NAMESPACE) propertyNames.push(`alias-${index}`);
  }
  window.document.body.append(root);
  let collection = root.getElementsByTagName('*');
  assert.equal(collection.length, size);
  const enumerates = name === 'collection-property-names';
  const iterations = enumerates ? COLLECTION_MEMBER_ENUMERATION_ITERATIONS : COLLECTION_MEMBER_LOOKUP_ITERATIONS;
  const key = name === 'collection-named-hit' ? `member-${size - 1}` : 'missing-member';
  const before = runtime.getNativeTreeStatistics?.();
  if (before && !process.env.RUSTDOM_BENCHMARK_PACKAGE) {
    assert.equal(typeof before.nativeCollectionNamedReads, 'number');
    assert.equal(typeof before.nativeCollectionNameEnumerations, 'number');
  }
  return {
    /** @returns {number} Consume the exact final member or complete ordered property-name array. */
    run() {
      let checksum = 0;
      for (let iteration = 0; iteration < iterations; iteration++) {
        if (enumerates) {
          const names = Object.getOwnPropertyNames(collection);
          checksum += names.length + Number(names.at(-1) === propertyNames.at(-1));
        } else {
          checksum += Number(collection.namedItem(key) === (name === 'collection-named-hit' ? expected.at(-1) : null));
        }
      }
      return checksum;
    },
    /** @param {number} checksum - Timed public result. @returns {void} Validate every identity, name order, namespace restriction and native path outside timing. */
    validate(checksum) {
      assert.equal(checksum, iterations * (enumerates ? propertyNames.length + 1 : 1));
      if (before && !process.env.RUSTDOM_BENCHMARK_PACKAGE) {
        const after = runtime.getNativeTreeStatistics();
        const operationCounter = enumerates ? 'nativeCollectionNameEnumerations' : 'nativeCollectionNamedReads';
        assert.equal(after.nativeCollectionQueries, before.nativeCollectionQueries);
        assert.ok(after[operationCounter] - before[operationCounter] >= iterations);
      }
      assert.deepEqual(Array.from(collection), expected);
      assert.deepEqual(Object.getOwnPropertyNames(collection), propertyNames);
      assert.equal(collection.namedItem('alias-0'), null);
      assert.equal(collection.namedItem(`member-${size - 1}`), expected.at(-1));
      assert.equal(root.children.length, size);
    },
    /** @returns {void} Restore the document and release all retained public objects. */
    dispose() { root.remove(); root = null; collection = null; expected = null; propertyNames = null; },
  };
}
module.exports = { collectionMemberFixture };
