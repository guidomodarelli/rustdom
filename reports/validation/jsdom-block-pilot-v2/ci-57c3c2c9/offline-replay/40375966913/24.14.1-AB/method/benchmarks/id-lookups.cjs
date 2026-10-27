/** @module benchmarks/id-lookups Times real public Document indexing and SVG lookup operations. */
'use strict';
const assert = require('node:assert/strict');
const { HTML_NAMESPACE, COLLECTION_NAMESPACE } = require('./constants/collection-queries.cjs');
const { DOCUMENT_ID_MISS, DOCUMENT_ID_REGISTER, DOCUMENT_ID_CHANGE, SVG_ID_SELF, SVG_ID_EMPTY,
  ID_LOOKUP_WORKLOADS, ID_LOOKUP_ITERATIONS, ID_LOOKUP_VALUE_PREFIX, ID_LOOKUP_CHANGED_VALUES,
  ID_LOOKUP_ROOT_VALUE, ID_LOOKUP_MISSING_VALUE, ID_LOOKUP_ENTRY_ATTRIBUTE, SVG_NAMESPACE,
} = require('./constants/id-lookups.cjs');

/**
 * Prepare detached registrations or stable public lookups outside the measured interval.
 * @param {object} runtime - Actual runtime module.
 * @param {Window} window - Original owner, preserved by cleanup.
 * @param {number} size - Number of child elements with distinct IDs.
 * @param {string} name - Canonical public workload.
 * @returns {object} Measured operations, full untimed checks, serialization and reference cleanup.
 */
function idLookupFixture(runtime, window, size, name) {
  assert.ok(ID_LOOKUP_WORKLOADS.includes(name), `Unsupported ID lookup benchmark: ${name}`);
  const registers = name === DOCUMENT_ID_REGISTER;
  const changes = name === DOCUMENT_ID_CHANGE;
  const svg = name.startsWith('svg-');
  let document = window.document;
  let scope = svg ? document.createElementNS(SVG_NAMESPACE, 'svg') : document.createElement('section');
  if (name === SVG_ID_SELF) scope.setAttribute('id', ID_LOOKUP_ROOT_VALUE);
  let nodes = [];
  for (let index = 0; index < size; index++) {
    const namespace = index % 2 === 0 ? HTML_NAMESPACE : COLLECTION_NAMESPACE;
    const element = document.createElementNS(namespace, namespace === HTML_NAMESPACE ? 'div' : 'p:entry');
    element.setAttribute(ID_LOOKUP_ENTRY_ATTRIBUTE, String(index));
    element.setAttributeNS(null, 'id', name === SVG_ID_EMPTY && index === size - 1 ? '' : `${ID_LOOKUP_VALUE_PREFIX}${index}`);
    element.setAttributeNS(COLLECTION_NAMESPACE, 'p:id', ID_LOOKUP_MISSING_VALUE);
    scope.append(element); nodes.push(element);
  }
  if (!registers) document.body.append(scope);
  const query = name === SVG_ID_SELF ? ID_LOOKUP_ROOT_VALUE : name === SVG_ID_EMPTY ? ''
    : name === DOCUMENT_ID_MISS ? ID_LOOKUP_MISSING_VALUE : `${ID_LOOKUP_VALUE_PREFIX}${size - 1}`;
  let target = name === DOCUMENT_ID_MISS ? null : name === SVG_ID_SELF ? scope : nodes.at(-1);
  let queryRoot = svg ? scope : document;
  if (!registers) assert.equal(queryRoot.getElementById(query), target);
  const before = runtime.getNativeTreeStatistics?.();
  return {
    /** @returns {number} Consume actual identities, completed setters or the single public attachment. */
    run() {
      if (registers) { document.body.append(scope); return Number(scope.parentNode === document.body); }
      let checksum = 0;
      for (let iteration = 0; iteration < ID_LOOKUP_ITERATIONS; iteration++) {
        if (changes) { target.setAttributeNS(null, 'id', ID_LOOKUP_CHANGED_VALUES[iteration % ID_LOOKUP_CHANGED_VALUES.length]); checksum++; }
        else checksum += Number(queryRoot.getElementById(query) === target);
      }
      return checksum;
    },
    /** @param {number} checksum - Completed operation count. @returns {void} Check native activity, every ID and complete physical contents outside timing. */
    validate(checksum) {
      assert.equal(checksum, registers ? 1 : ID_LOOKUP_ITERATIONS);
      const after = runtime.getNativeTreeStatistics?.();
      if (before?.documentIds) {
        if (!registers && !changes) assert.equal(after.nativeCollectionQueries - before.nativeCollectionQueries, ID_LOOKUP_ITERATIONS);
        if (registers) for (const key of ['names', 'entries', 'elements', 'memberships']) {
          assert.equal(after.documentIds[key] - before.documentIds[key], size);
        }
        if (changes) for (const key of ['documents', 'names', 'entries', 'elements', 'memberships']) {
          assert.equal(after.documentIds[key], before.documentIds[key]);
        }
      }
      assert.equal(scope.parentNode, document.body);
      assert.equal(scope.childNodes.length, size);
      for (const [index, element] of nodes.entries()) {
        const id = changes && index === size - 1 ? ID_LOOKUP_CHANGED_VALUES[(ID_LOOKUP_ITERATIONS - 1) % ID_LOOKUP_CHANGED_VALUES.length]
          : name === SVG_ID_EMPTY && index === size - 1 ? '' : `${ID_LOOKUP_VALUE_PREFIX}${index}`;
        assert.equal(scope.childNodes.item(index), element);
        assert.equal(element.namespaceURI, index % 2 === 0 ? HTML_NAMESPACE : COLLECTION_NAMESPACE);
        assert.equal(element.getAttribute(ID_LOOKUP_ENTRY_ATTRIBUTE), String(index));
        assert.equal(element.getAttributeNS(null, 'id'), id);
        assert.equal(element.getAttributeNS(COLLECTION_NAMESPACE, 'id'), ID_LOOKUP_MISSING_VALUE);
        assert.equal(queryRoot.getElementById(id), element);
      }
      assert.equal(queryRoot.getElementById(ID_LOOKUP_MISSING_VALUE), null);
      assert.equal(queryRoot.getElementById(changes ? ID_LOOKUP_CHANGED_VALUES.at(-1) : query), target);
      if (changes) {
        assert.equal(document.getElementById(query), null);
        assert.equal(document.getElementById(ID_LOOKUP_CHANGED_VALUES[0]), null);
      }
    },
    /** @returns {string} Include all prepared descendants and namespaced attributes in the result hash. */
    serialize() { return new window.XMLSerializer().serializeToString(scope); },
    /** @returns {void} Preserve original body contents and release every strong fixture reference. */
    dispose() { scope.remove(); scope.replaceChildren(); scope = null; nodes = null; target = null; queryRoot = null; document = null; window = null; },
  };
}
module.exports = { idLookupFixture };
