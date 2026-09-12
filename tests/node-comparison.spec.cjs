/** @file Differential contracts for native node comparison and immutable node metadata. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const engines = { jsdom: require('jsdom'), rustdom: require('../dist/index.cjs') };

/** @param {Function} inspect - Public DOM scenario. @returns {void} Compares independent real engines. */
function compare(inspect) {
  const results = Object.values(engines).map((engine) => {
    const dom = new engine.JSDOM('<!doctype html><main><div a="one" b="two"><p>text</p><!--comment--></div><aside></aside></main>');
    try { return inspect(dom.window.document, dom.window); }
    finally { dom.window.close(); }
  });
  assert.deepEqual(results[1], results[0]);
}

test('should preserve every pairwise position, containment and equality across node families', () => {
  compare((document) => {
    const element = document.querySelector('div');
    const detached = document.createElement('detached');
    detached.append('detached text');
    const fragment = document.createDocumentFragment();
    fragment.append(document.createElement('fragment-child'));
    const foreign = document.implementation.createDocument(null, 'root');
    const shadow = document.querySelector('aside').attachShadow({ mode: 'open' });
    shadow.append(document.createElement('shadow-child'));
    const template = document.createElement('template');
    template.innerHTML = '<i>inert</i>';
    const nodes = [document, document.doctype, document.documentElement, document.body, element,
      element.firstChild, element.firstChild.firstChild, element.lastChild, element.attributes[0],
      element.attributes[1], document.createAttribute('detached'), document.createAttribute('detached'),
      detached, detached.firstChild, fragment, fragment.firstChild, foreign, foreign.documentElement,
      foreign.createCDATASection('one'), foreign.createCDATASection('different'),
      foreign.createProcessingInstruction('target', 'data'), shadow, shadow.firstChild,
      template, template.content, template.content.firstChild];
    return nodes.map((left) => ({ nullContains: left.contains(null), nullEquals: left.isEqualNode(null),
      pairs: nodes.map((right) => [left.compareDocumentPosition(right), left.contains(right), left.isEqualNode(right)]) }));
  });
});

test('should compare doctypes and processing instructions after character data mutations', () => {
  compare((document) => {
    const doctypes = [['root', '', ''], ['root', 'public', ''], ['root', '', 'system'],
      ['other', '', ''], ['root', '\ud800', '\udc00']].map((parts) => document.implementation.createDocumentType(...parts));
    const instruction = document.createProcessingInstruction('target', 'initial');
    const observations = [];
    for (const mutate of [() => { instruction.data = 'changed'; }, () => instruction.appendData('\ud800'),
      () => instruction.replaceData(1, 3, 'x'), () => { instruction.textContent = 'final'; },
      () => { instruction.nodeValue = 'value'; }]) {
      mutate();
      observations.push([instruction.target, instruction.nodeName, instruction.data,
        instruction.isEqualNode(document.createProcessingInstruction('target', instruction.data)),
        instruction.isEqualNode(document.createProcessingInstruction('other', instruction.data)),
        instruction.cloneNode().target]);
    }
    return { doctypes: doctypes.map((left) => [left.name, left.publicId, left.systemId,
      ...doctypes.map((right) => left.isEqualNode(right))]), instructions: observations };
  });
});

test('should compare unordered attributes and preserve legacy aliases after replacement and movement', () => {
  compare((document) => {
    const first = document.createElementNS('urn:element', 'p:item');
    const second = document.createElementNS('urn:element', 'p:item');
    first.setAttributeNS('urn:attribute', 'a:key', 'value');
    first.setAttribute('plain', 'text');
    second.setAttribute('plain', 'text');
    second.setAttributeNS('urn:attribute', 'b:key', 'value');
    const oldAttribute = first.getAttributeNodeNS('urn:attribute', 'key');
    const replacement = document.createAttributeNS('urn:attribute', 'c:key');
    replacement.value = 'value';
    const initial = first.isEqualNode(second);
    first.setAttributeNodeNS(replacement);
    second.setAttributeNodeNS(oldAttribute);
    const moved = first.isEqualNode(second);
    oldAttribute.value = 'changed';
    const changed = first.isEqualNode(second);
    first.append(document.createTextNode('\ud800'));
    second.append(document.createTextNode('\ud800'));
    const cloned = first.cloneNode(true);
    return { initial, moved, changed, cloned: first.isEqualNode(cloned),
      aliases: [first.getAttribute('a:key'), first.getAttribute('c:key')],
      positions: [oldAttribute.compareDocumentPosition(replacement), replacement.compareDocumentPosition(oldAttribute)] };
  });
});

test('should observe changed parentage and current descendant data without stale comparison results', () => {
  compare((document) => {
    const left = document.querySelector('div');
    const right = left.cloneNode(true);
    document.querySelector('main').append(right);
    const child = right.firstChild;
    const observations = [];
    for (let iteration = 0; iteration < 40; iteration++) {
      const parent = iteration % 2 ? left : right;
      parent.append(child);
      child.firstChild.data = `value-${iteration}`;
      observations.push([left.isEqualNode(right), left.contains(child), right.contains(child),
        left.compareDocumentPosition(child), right.compareDocumentPosition(child), left.isEqualNode(left.cloneNode(true))]);
    }
    return observations;
  });
});
