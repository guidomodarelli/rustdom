/** @module benchmarks/attribute-reads Measures complete public value and presence reads over canonical attributes. */
'use strict';
const assert = require('node:assert/strict');
const { ATTRIBUTE_READ_WORKLOADS, ATTRIBUTE_READ_ITERATIONS, ATTRIBUTE_READ_NAMESPACE, ATTRIBUTE_READ_NAME_PREFIX,
  ATTRIBUTE_READ_VALUE_PREFIX, ATTRIBUTE_READ_MISSING_NAME, ATTRIBUTE_READ_REFLECTED_VALUE,
  ATTRIBUTE_READ_LONG_VALUE_UNITS } = require('./constants/attribute-reads.cjs');

/**
 * Build mixed-namespace attributes before timing; every output and retained owner is checked afterward.
 * @param {object} runtime - Actual engine module.
 * @param {Window} window - Original owner, preserved by disposal.
 * @param {number} size - Prepared attributes, plus one fixed title used for reflection.
 * @param {string} name - Public workload.
 * @returns {object} Timed reads, full checks and reference cleanup.
 */
function attributeReadFixture(runtime, window, size, name) {
  assert.ok(ATTRIBUTE_READ_WORKLOADS.includes(name), `Unsupported attribute read benchmark: ${name}`);
  let document = window.document;
  let element = document.createElement('section'); let attributes = [];
  const long = name === 'attribute-get-long' || name === 'attribute-get-utf16';
  const specialValue = name === 'attribute-get-utf16' ? '\ud800\0'.repeat(ATTRIBUTE_READ_LONG_VALUE_UNITS / 2)
    : 'x'.repeat(ATTRIBUTE_READ_LONG_VALUE_UNITS);
  for (let index = 0; index < size; index++) {
    const namespace = index % 2 === 0 ? null : ATTRIBUTE_READ_NAMESPACE;
    const localName = `${ATTRIBUTE_READ_NAME_PREFIX}${index}`;
    const attribute = document.createAttributeNS(namespace, namespace === null ? localName : `p:${localName}`);
    attribute.value = long && index === size - 1 ? specialValue : `${ATTRIBUTE_READ_VALUE_PREFIX}${index}`;
    element.setAttributeNodeNS(attribute); attributes.push(attribute);
  }
  element.title = ATTRIBUTE_READ_REFLECTED_VALUE; document.body.append(element);
  const missing = name.endsWith('-miss'); const has = name.startsWith('attribute-has');
  const namespaced = name.includes('-ns');
  const localName = missing ? ATTRIBUTE_READ_MISSING_NAME : `${ATTRIBUTE_READ_NAME_PREFIX}${size - 1}`;
  const qualifiedName = missing ? ATTRIBUTE_READ_MISSING_NAME : `P:${localName.toUpperCase()}`;
  const expected = has ? !missing : missing ? null : name === 'attribute-reflection' ? ATTRIBUTE_READ_REFLECTED_VALUE
    : long ? specialValue : `${ATTRIBUTE_READ_VALUE_PREFIX}${size - 1}`;
  const before = runtime.getNativeTreeStatistics?.().nativeAttributeReads;
  return {
    /** @returns {number} Consume every value/boolean from the actual public getter or method. */
    run() {
      let checksum = 0;
      for (let iteration = 0; iteration < ATTRIBUTE_READ_ITERATIONS; iteration++) {
        const result = name === 'attribute-reflection' ? element.title : namespaced
          ? has ? element.hasAttributeNS(ATTRIBUTE_READ_NAMESPACE, localName) : element.getAttributeNS(ATTRIBUTE_READ_NAMESPACE, localName)
          : has ? element.hasAttribute(qualifiedName) : element.getAttribute(qualifiedName);
        checksum += Number(result === expected);
      }
      return checksum;
    },
    /** @param {number} checksum - Number of correct reads. @returns {void} Validate native work before auxiliary reads, then all canonical identities and values. */
    validate(checksum) {
      assert.equal(checksum, ATTRIBUTE_READ_ITERATIONS);
      if (before !== undefined) assert.equal(runtime.getNativeTreeStatistics().nativeAttributeReads - before, ATTRIBUTE_READ_ITERATIONS);
      assert.equal(element.parentNode, document.body); assert.equal(element.attributes.length, size + 1);
      for (const [index, attribute] of attributes.entries()) {
        const value = long && index === size - 1 ? specialValue : `${ATTRIBUTE_READ_VALUE_PREFIX}${index}`;
        assert.equal(element.attributes.item(index), attribute); assert.equal(attribute.ownerElement, element);
        assert.equal(attribute.value, value); assert.equal(attribute.localName, `${ATTRIBUTE_READ_NAME_PREFIX}${index}`);
        assert.equal(attribute.namespaceURI, index % 2 === 0 ? null : ATTRIBUTE_READ_NAMESPACE);
        assert.equal(element.getAttributeNS(attribute.namespaceURI, attribute.localName), value);
      }
      assert.equal(element.title, ATTRIBUTE_READ_REFLECTED_VALUE);
      assert.equal(element.getAttribute(ATTRIBUTE_READ_MISSING_NAME), null);
    },
    /** @returns {string} Complete prepared scope, including every namespaced attribute and long UTF-16 value. */
    serialize() { return new window.XMLSerializer().serializeToString(element); },
    /** @returns {void} Restore the original owner and drop all fixture references. */
    dispose() { element.remove(); element = null; attributes = null; document = null; window = null; },
  };
}
module.exports = { attributeReadFixture };
