/** @file Exercises large attribute bursts on live elements against independent jsdom. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const reference = require('jsdom');
const runtime = require('../dist/index.cjs');

/** @param {object} engine - Real DOM implementation. @returns {object[]} Observable post-burst states. */
function exerciseAttributeBursts(engine) {
  const dom = new engine.JSDOM('<!doctype html><main></main><aside></aside>');
  const document = dom.window.document;
  const element = document.querySelector('main');
  const other = document.querySelector('aside');
  const original = document.createAttributeNS('urn:alias', 'p:key');
  const replacement = document.createAttributeNS('urn:alias', 'q:key');
  original.value = 'original';
  replacement.value = 'replacement';
  const observations = [];
  try {
    element.setAttributeNodeNS(original);
    element.setAttributeNodeNS(replacement);
    element.removeAttributeNode(replacement);
    other.setAttributeNodeNS(original);
    for (let batch = 0; batch < 4; batch++) {
      const attributes = [];
      for (let index = 0; index < 2048; index++) {
        const attribute = document.createAttribute(`data-burst-${batch}-${index}`);
        attribute.value = `value-${index}`;
        attributes.push(attribute);
        element.setAttributeNode(attribute);
      }
      // Leave a small live tail before clearing it, so both sparse and empty states are exercised.
      for (let index = attributes.length - 1; index >= 8; index--) {
        assert.equal(element.removeAttributeNode(attributes[index]), attributes[index]);
        assert.equal(attributes[index].ownerElement, null);
      }
      observations.push({
        names: element.getAttributeNames(),
        html: element.outerHTML,
        tail: attributes.slice(0, 8).map((attribute) => [
          attribute.name, element.getAttributeNode(attribute.name) === attribute,
          attribute.ownerElement === element,
        ]),
      });
      for (const attribute of attributes.slice(0, 8)) element.removeAttributeNode(attribute);
      original.value = `alias-${batch}`;
      observations.push({
        names: element.getAttributeNames(), html: element.outerHTML,
        aliasValue: element.getAttribute('p:key'),
        aliasIdentity: element.getAttributeNode('p:key') === original,
        aliasOwner: original.ownerElement === other,
        aliasByNamespace: element.getAttributeNodeNS('urn:alias', 'key'),
        replacementOwner: replacement.ownerElement,
      });
      assert.equal(document.querySelector('main'), element);
    }
    return observations;
  } finally {
    dom.window.close();
  }
}

test('should preserve names, identities, owners and live aliases through large attribute bursts', () => {
  assert.deepEqual(exerciseAttributeBursts(runtime), exerciseAttributeBursts(reference));
});
