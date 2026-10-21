/** @file Public attribute read contracts against an independent jsdom, including coercion, aliases and adoption. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const engines = { jsdom: require('jsdom'), rustdom: require('../dist/index.cjs') };
const HTML_NAMESPACE = 'http://www.w3.org/1999/xhtml';

/** @param {object} engine - Actual DOM engine. @param {string} mode - Document syntax. @param {string} realm - Script realm. @returns {object} Real owner. */
function createOwner(engine, mode, realm) {
  return new engine.JSDOM(mode === 'xml' ? '<root/>' : '<!doctype html><body>', {
    ...(mode === 'xml' ? { contentType: 'application/xml' } : {}),
    ...(realm === 'vm' ? { runScripts: 'outside-only' } : {}),
  });
}

/** @param {Element} element - Current owner. @param {string[]} names - Qualified queries. @param {Array} namespaces - Namespace/local-name queries. @returns {object} Values, booleans and current collection identities. */
function observe(element, names, namespaces) {
  return {
    names: element.getAttributeNames(),
    qualified: names.map((name) => [name, element.getAttribute(name), element.hasAttribute(name),
      element.getAttributeNode(name)?.marker ?? null]),
    namespaces: namespaces.map(([namespace, name]) => [namespace, name, element.getAttributeNS(namespace, name),
      element.hasAttributeNS(namespace, name), element.getAttributeNodeNS(namespace, name)?.marker ?? null]),
    attributes: [...element.attributes].map((attribute) => [attribute.name, attribute.namespaceURI,
      attribute.localName, attribute.value, attribute.ownerElement === element, attribute.marker ?? null]),
  };
}

for (const mode of ['html', 'xml']) for (const realm of ['default', 'vm']) {
  /** @param {Function} operation - Public contract. @returns {void} Compare actual runtimes with independent owners. */
  function compare(operation) {
    const observations = {};
    for (const [engine, runtime] of Object.entries(engines)) {
      const owner = createOwner(runtime, mode, realm);
      try { observations[engine] = operation(owner.window, runtime); }
      finally { owner.window.close(); }
    }
    assert.deepEqual(observations.rustdom, observations.jsdom);
  }

  test(`should read qualified and namespaced attributes with exact aliases in ${mode}/${realm}`, () => compare((window) => {
    const document = window.document;
    const element = document.createElementNS(HTML_NAMESPACE, 'section');
    const other = document.createElementNS('urn:other', 'entry');
    const attributes = [[null, 'DATA', 'uppercase'], [null, 'data', 'lowercase'], ['urn:first', 'p:key', 'first'],
      ['urn:second', 'p:key', 'second'], [null, 'constructor', 'constructor-value'], [null, '__proto__', 'prototype-value'],
      [null, 'Ä', 'upper-nonascii'], [null, 'ä', 'lower-nonascii'], [null, 'empty', '']].map(([namespace, name, value], index) => {
      const attribute = document.createAttributeNS(namespace, name); attribute.value = value; attribute.marker = index;
      element.setAttributeNodeNS(attribute); return attribute;
    });
    const names = ['DATA', 'data', 'DaTa', 'p:key', 'q:key', 'key', 'constructor', '__proto__', 'Ä', 'ä', 'empty', 'missing', '', 'bad name'];
    const namespaces = [[null, 'data'], ['', 'data'], [null, 'DATA'], ['urn:first', 'key'], ['urn:second', 'key'],
      ['urn:first', 'p:key'], [null, 'empty'], ['urn:missing', 'key'], [null, 'missing']];
    const states = [observe(element, names, namespaces)];
    const replacement = document.createAttributeNS('urn:first', 'q:key'); replacement.value = 'replacement'; replacement.marker = 10;
    assert.equal(element.setAttributeNodeNS(replacement), attributes[2]);
    states.push(observe(element, names, namespaces));
    element.removeAttributeNode(replacement); other.setAttributeNodeNS(attributes[2]); attributes[2].value = 'detached-alias';
    states.push(observe(element, names, namespaces));
    assert.equal(element.getAttributeNode('p:key'), attributes[2]);
    assert.equal(element.getAttributeNS('urn:first', 'key'), null);
    states.push(observe(other, names, namespaces));
    return states;
  }));

  test(`should preserve empty NUL isolated surrogates and long attribute values in ${mode}/${realm}`, () => compare((window) => {
    const document = window.document;
    const element = document.createElementNS('urn:values', 'entry');
    const values = ['', '\0', '\ud800', '\udfff', '𠮷\0tail', 'x'.repeat(63), 'x'.repeat(64), 'x'.repeat(65),
      '\ud800'.repeat(4096), '𠮷\0'.repeat(2048)];
    const namespace = 'urn:values\0\ud800';
    const attribute = document.createAttributeNS(namespace, 'p:key'); element.setAttributeNodeNS(attribute);
    const observations = [];
    for (const value of values) {
      attribute.value = value;
      assert.equal(element.getAttribute('p:key'), value);
      assert.equal(element.getAttributeNS(namespace, 'key'), value);
      assert.equal(element.hasAttributeNS(namespace, 'key'), true);
      assert.equal(element.getAttributeNodeNS(namespace, 'key'), attribute);
      element.setAttribute('plain', value);
      assert.equal(element.getAttribute('plain'), value);
      observations.push([value.length, element.getAttribute('p:key'), element.getAttributeNS(null, 'plain'),
        element.getAttributeNS('', 'plain'), element.getAttribute('absent'), element.hasAttribute('absent')]);
    }
    for (const name of ['\0', '\ud800', '\udfff', 'bad name', 'x'.repeat(4096)]) {
      observations.push([name, element.getAttribute(name), element.hasAttribute(name),
        element.getAttributeNS(null, name), element.hasAttributeNS(null, name)]);
    }
    return observations;
  }));

  test(`should preserve WebIDL coercion order reentrancy and exceptions in ${mode}/${realm}`, () => compare((window) => {
    const element = window.document.createElementNS('urn:coercion', 'entry');
    element.setAttribute('value', 'initial'); element.setAttributeNS('urn:coercion', 'p:key', 'before');
    const trace = [];
    const key = { [Symbol.toPrimitive](hint) { trace.push(['qualified', hint]); element.setAttribute('value', 'during'); return 'value'; } };
    assert.equal(element.getAttribute(key), 'during'); assert.equal(element.hasAttribute(key), true);
    const namespace = { toString() { trace.push('namespace'); element.setAttributeNS('urn:coercion', 'p:key', 'during-namespace'); return 'urn:coercion'; } };
    const local = { toString() { trace.push('local'); return 'key'; } };
    assert.equal(element.getAttributeNS(namespace, local), 'during-namespace');
    assert.equal(element.hasAttributeNS(namespace, local), true);
    const marker = { marker: 'coercion-error' };
    for (const method of ['getAttribute', 'hasAttribute', 'getAttributeNS', 'hasAttributeNS']) {
      const args = method.endsWith('NS') ? [namespace, { toString() { trace.push('throw'); throw marker; } }]
        : [{ toString() { trace.push('throw'); throw marker; } }];
      assert.throws(() => element[method](...args), (error) => error === marker);
      for (const invalid of [Symbol('attribute')]) {
        try { element[method](...(method.endsWith('NS') ? [null, invalid] : [invalid])); assert.fail('symbol must reject'); }
        catch (error) { trace.push([method, error.name, error instanceof window.TypeError]); }
      }
      for (const argsCount of method.endsWith('NS') ? [0, 1] : [0]) {
        try { element[method](...Array(argsCount).fill(null)); assert.fail('required arguments must reject'); }
        catch (error) { trace.push([method, argsCount, error.name, error instanceof window.TypeError]); }
      }
      const converted = [null, undefined, true, 7, Object('value')].map((value) => element[method](...(method.endsWith('NS') ? [null, value] : [value])));
      trace.push([method, converted]);
    }
    return trace;
  }));

  test(`should reread document mode after adoption and preserve Attr identities in ${mode}/${realm}`, () => compare((window, runtime) => {
    const html = createOwner(runtime, 'html', realm); const xml = createOwner(runtime, 'xml', realm);
    try {
      const element = window.document.createElementNS(HTML_NAMESPACE, 'section');
      const upper = window.document.createAttributeNS(null, 'DATA'); upper.value = 'upper'; upper.marker = 'upper';
      const lower = window.document.createAttributeNS(null, 'data'); lower.value = 'lower'; lower.marker = 'lower';
      element.setAttributeNodeNS(upper); element.setAttributeNodeNS(lower);
      const collection = element.attributes;
      const states = [];
      for (const document of [window.document, xml.window.document, html.window.document, xml.window.document]) {
        document.adoptNode(element); document.documentElement.append(element);
        assert.equal(element.attributes, collection); assert.equal(upper.ownerElement, element); assert.equal(lower.ownerElement, element);
        states.push(observe(element, ['DATA', 'data', 'DaTa'], [[null, 'DATA'], ['', 'data']]));
      }
      return states;
    } finally { html.window.close(); xml.window.close(); }
  }));

  test(`should keep attribute reflection observers and overridden read methods observable in ${mode}/${realm}`, () => compare((window) => {
    const document = window.document;
    const element = document.createElementNS(HTML_NAMESPACE, 'input');
    document.documentElement.append(element);
    const observer = new window.MutationObserver(() => {}); observer.observe(element, { attributes: true, attributeOldValue: true });
    try {
      const states = [];
      for (const value of ['', 'first', '\ud800\0value']) {
        element.setAttribute('id', value); element.setAttribute('name', value); element.setAttribute('title', value); element.setAttribute('value', value);
        states.push([element.id, element.name, element.title, element.defaultValue, element.disabled]);
      }
      element.disabled = true; states.push([element.hasAttribute('disabled'), element.getAttribute('disabled'), element.disabled]);
      element.removeAttribute('name'); element.removeAttribute('title'); element.removeAttribute('value');
      states.push([element.name, element.title, element.defaultValue]);
      const implementation = element[Object.getOwnPropertySymbols(element).find((symbol) => symbol.description === 'impl')];
      const original = implementation.getAttributeNS; const reads = [];
      implementation.getAttributeNS = function (namespace, name) { reads.push([namespace, name]); return original.call(this, namespace, name); };
      element.remove(); document.documentElement.append(element);
      assert.ok(reads.some(([namespace, name]) => namespace === null && name === 'id'));
      implementation.getAttributeNS = original;
      states.push(reads);
      states.push(observer.takeRecords().map((record) => [record.attributeName, record.attributeNamespace, record.oldValue]));
      return states;
    } finally { observer.disconnect(); }
  }));
}
