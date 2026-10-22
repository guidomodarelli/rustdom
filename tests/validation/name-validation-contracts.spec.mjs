/** @file Exercises retained name-validation decisions through real public DOM interfaces. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const reference = require('jsdom');
assert.ok(process.env.RUSTDOM_PUBLIC_PACKAGE_ROOT, 'Set the real pinned RUSTDOM_PUBLIC_PACKAGE_ROOT');
const candidate = require(join(process.env.RUSTDOM_PUBLIC_PACKAGE_ROOT, 'dist/index.cjs'));
const XML_NAMESPACE = 'http://www.w3.org/XML/1998/namespace';
const XMLNS_NAMESPACE = 'http://www.w3.org/2000/xmlns/';

/** Preserve only observable scalar values and release both owning realms. */
function observe(runtime) {
  const dom = new runtime.JSDOM('<main data-original="kept"></main>');
  const other = new runtime.JSDOM();
  try {
    const document = dom.window.document;
    const element = document.querySelector('main');
    const attempts = [];
    const record = (operation, name, namespace) => {
      try {
        const node = operation.endsWith('NS') ? document[operation](namespace, name) : document[operation](name);
        attempts.push({ operation, name, namespace, value: [node.nodeType, node.nodeName, node.namespaceURI, node.prefix, node.localName] });
      } catch (error) {
        attempts.push({ operation, name, namespace, error: [error.name, error.code, error instanceof dom.window.DOMException] });
      }
    };
    for (const operation of ['createElement', 'createAttribute']) {
      for (const name of ['valid', ':local', 'p:local:tail', 'Élément', 'a\u0301', '\u{10000}node', '', 'a b', 'a\u0000', 'a\ud800']) {
        record(operation, name, undefined);
      }
    }
    for (const operation of ['createElementNS', 'createAttributeNS']) {
      for (const [namespace, name] of [
        [null, 'local'], ['', 'local'], [undefined, 'local'], ['urn:one', 'p:local'],
        [null, 'p:local'], ['', 'p:local'], [null, ':local'], ['urn:one', 'a:b:c'],
        ['urn:one', 'a:'], ['urn:one', 'a b'], ['urn:one', 'É:élément'], ['urn:one', 'a\ud800'],
        [XML_NAMESPACE, 'xml:lang'], ['urn:wrong', 'xml:lang'],
        [XMLNS_NAMESPACE, 'xmlns'], [XMLNS_NAMESPACE, 'xmlns:p'], [XMLNS_NAMESPACE, 'local'],
        ['urn:wrong', 'xmlns'], ['urn:wrong', 'xmlns:p'], ['urn:one', 'XML:local'],
      ]) record(operation, name, namespace);
    }
    const coercions = [];
    const namespace = { toString() { coercions.push('namespace'); return 'urn:coerced'; } };
    const name = { toString() {
      coercions.push('name'); element.append(document.createTextNode('reentrant')); return 'p:coerced';
    } };
    const coerced = document.createElementNS(namespace, name);
    const failureNames = [];
    for (const operation of [() => document.createElement(Symbol('name')),
      () => document.createElementNS(Symbol('namespace'), 'p:name'),
      () => document.createAttributeNS(null, Symbol('name')),
      () => element.setAttributeNS(null, 'p:value', 'changed')]) {
      try { operation(); failureNames.push('unexpected success'); }
      catch (error) { failureNames.push(error.name); }
    }
    let borrowedError;
    try { other.window.Document.prototype.createElementNS.call(document, null, 'p:local'); }
    catch (error) { borrowedError = [error.name, error instanceof dom.window.DOMException, error instanceof other.window.DOMException]; }
    return { attempts, coercions, coerced: [coerced.namespaceURI, coerced.prefix, coerced.localName],
      text: element.textContent, failureNames, borrowedError,
      attributes: [...element.attributes].map((attribute) => [attribute.name, attribute.value]) };
  } finally { dom.window.close(); other.window.close(); }
}

test('public name validation preserves Unicode, namespace errors, coercion order, reentrancy and exception realms', () => {
  const expected = observe(reference);
  assert.deepEqual(observe(candidate), expected);
  assert.equal(expected.attempts.length, 60);
  assert.deepEqual(expected.coercions, ['namespace', 'name']);
  assert.deepEqual(expected.coerced, ['urn:coerced', 'p', 'coerced']);
  assert.equal(expected.text, 'reentrant');
  assert.deepEqual(expected.failureNames, ['TypeError', 'TypeError', 'TypeError', 'NamespaceError']);
  assert.deepEqual(expected.borrowedError, ['NamespaceError', true, false]);
  assert.deepEqual(expected.attributes, [['data-original', 'kept']]);
  assert.ok(expected.attempts.some((entry) => entry.name === 'a:b:c' && entry.error[0] === 'InvalidCharacterError'));
});
