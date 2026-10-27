/** @file Measures public XML serialization and well-formedness failures on equivalent prepared documents. */
'use strict';
const assert = require('node:assert/strict');
const { XML_SERIALIZER_GETTER_ERROR_WORKLOAD, XML_SERIALIZER_GETTER_ERROR_MESSAGE } = require('./constants/xml-serializer-controller.cjs');

/** @param {object} runtime - Actual DOM implementation. @param {number} size - Row count. @param {string} name - Serialization entrypoint. @returns {object} Timed operation and independent checks. */
function serializationFixture(runtime, size, name) {
  const rows = Array.from({ length: size }, (_, index) => `<p:row id="r${index}" p:k="v${index}"><value>Row ${index} &amp; value</value><![CDATA[c${index}]]></p:row>`).join('');
  const dom = new runtime.JSDOM(`<root xmlns="urn:root" xmlns:p="urn:row">${rows}</root>`, { contentType: 'text/xml' });
  const root = dom.window.document.documentElement;
  if (name === 'xml-serialize-error') root.append(dom.window.document.createTextNode('\0'));
  const getterError = name === XML_SERIALIZER_GETTER_ERROR_WORKLOAD;
  if (getterError) {
    const tail = dom.window.document.createTextNode('late getter'); root.append(tail);
    Object.defineProperty(tail, 'data', { get() { throw new Error(XML_SERIALIZER_GETTER_ERROR_MESSAGE); } });
  }
  let output; let failure; let before; let controllerBefore;
  return {
    inputBytes: Buffer.byteLength(rows),
    /** @returns {void} Capture native diagnostics before timing. */
    prepare() {
      const statistics = runtime.getNativeTreeStatistics?.(); before = statistics?.xmlSerialization.created;
      controllerBefore = statistics?.xmlSerializerOperations?.calls;
    },
    /** @returns {number} Consume output length or failure count. */
    run() {
      try {
        if (name === 'xml-serialize' || getterError) output = new dom.window.XMLSerializer().serializeToString(root);
        else if (name === 'xml-inner-serialize') output = root.innerHTML;
        else if (name === 'xml-document-serialize') output = dom.serialize();
        else output = root.outerHTML;
      } catch (error) { if (name !== 'xml-serialize-error' && !getterError) throw error; failure = { name: error.name, message: error.message }; }
      return failure ? 1 : output.length;
    },
    /** @param {number} result - Timed result. @param {number} [operations=1] - Public calls since prepare. @returns {void} Check escaping, every row and error/reference cleanup. */
    validate(result, operations = 1) {
      if (name === 'xml-serialize-error' || getterError) {
        assert.equal(result, 1); assert.equal(failure.name, 'InvalidStateError');
        if (getterError) assert.equal(failure.message, XML_SERIALIZER_GETTER_ERROR_MESSAGE);
        else assert.match(failure.message, /text node data is not well-formed/);
      } else {
        assert.equal(result, output.length); assert.equal((output.match(/<p:row /g) ?? []).length, size);
        for (let index = 0; index < size; index++) {
          assert.ok(output.includes(`id="r${index}"`)); assert.ok(output.includes(`p:k="v${index}"`));
          assert.ok(output.includes(`Row ${index} &amp; value`)); assert.ok(output.includes(`<![CDATA[c${index}]]>`));
        }
      }
      if (before !== undefined) {
        const statistics = runtime.getNativeTreeStatistics().xmlSerialization;
        assert.ok(statistics.created > before); assert.equal(statistics.live, 0); assert.equal(statistics.references, 0); assert.equal(statistics.cleanupErrors, 0);
      }
      if (controllerBefore !== undefined) {
        const statistics = runtime.getNativeTreeStatistics().xmlSerializerOperations;
        assert.equal(statistics.calls - controllerBefore, name === 'xml-serialize' || getterError ? operations : 0);
        assert.equal(statistics.active, 0);
      }
    },
    /** @returns {string} Exact output or error used for cross-engine hashes. */
    serialize() { return output ?? JSON.stringify(failure); },
    /** @returns {void} Close and release the fixture. */
    dispose() { dom.window.close(); },
  };
}
module.exports = { serializationFixture };
