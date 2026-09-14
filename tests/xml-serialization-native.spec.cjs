/** @file Real native XML entrypoints, exception identity and temporary-root diagnostics. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const { serializeXml, serializeXmlForest, xmlSerializationStatistics } = require('../dist/native.cjs');

test('should serialize foreign DOM wrappers losslessly and release synchronous roots', () => {
  const { window } = new JSDOM('<r/>', { contentType: 'text/xml' });
  try {
    const root = window.document.documentElement; root.append(window.document.createTextNode('\0\ud800<&>\udfff'));
    const before = xmlSerializationStatistics();
    assert.equal(serializeXml(root, false), new window.XMLSerializer().serializeToString(root));
    assert.throws(() => serializeXml(root, true), /text node data is not well-formed/);
    const after = xmlSerializationStatistics();
    assert.equal(after.created, before.created + 2); assert.equal(after.live, before.live);
    assert.equal(after.references, before.references); assert.equal(after.cleanupErrors, 0);
  } finally { window.close(); }
});

test('should return dynamic root results and preserve primitive exception identity', () => {
  const { window } = new JSDOM('<r/>', { contentType: 'text/xml' });
  try {
    const text = window.document.createTextNode('value'); const replacement = { replace() { return this; } };
    Object.defineProperty(text, 'data', { configurable: true, get: () => replacement });
    assert.equal(serializeXml(text, false), replacement);
    for (const thrown of [null, undefined, 0, 'failure', Symbol('failure'), { message: 'plain' }]) {
      Object.defineProperty(text, 'data', { configurable: true, get() { throw thrown; } });
      let caught = false;
      try { serializeXml(text, false); } catch (error) { caught = true; assert.equal(error, thrown); }
      assert.equal(caught, true); assert.equal(xmlSerializationStatistics().references, 0);
    }
  } finally { window.close(); }
});

test('should run public XML serialization through the native entrypoint', () => {
  const runtime = require('../dist/index.cjs'); const { window } = new runtime.JSDOM('<r><child/></r>', { contentType: 'text/xml' });
  try {
    const before = xmlSerializationStatistics().created;
    assert.equal(new window.XMLSerializer().serializeToString(window.document.documentElement), '<r><child/></r>');
    assert.equal(xmlSerializationStatistics().created, before + 1);
  } finally { window.close(); }
});

test('should reset namespace prefixes for forest roots and stop with the original failure', () => {
  const { window } = new JSDOM('<r/>', { contentType: 'text/xml' });
  try {
    const first = window.document.createElement('first'); const second = window.document.createElement('second');
    first.setAttributeNS('urn:a', 'a:v', 'one'); second.setAttributeNS('urn:b', 'b:v', 'two');
    const serializer = new window.XMLSerializer();
    assert.equal(serializeXmlForest([first, second], false), serializer.serializeToString(first) + serializer.serializeToString(second));
    const failure = Symbol('forest failure');
    Object.defineProperty(first, 'nodeType', { get() { throw failure; } });
    Object.defineProperty(second, 'nodeType', { get() { assert.fail('later roots must not be read after failure'); } });
    let caught = false;
    try { serializeXmlForest([first, second], false); } catch (error) { caught = true; assert.equal(error, failure); }
    assert.equal(caught, true); assert.equal(xmlSerializationStatistics().references, 0);
  } finally { window.close(); }
});
