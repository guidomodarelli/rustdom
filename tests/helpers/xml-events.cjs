/** @file Captures real XML event streams from the native parser and independent saxes. */
'use strict';
const assert = require('node:assert/strict');
const { SaxesParser } = require('saxes');
const { NativeXmlParser } = require('../../dist/native.cjs');

/** @param {object} tag - Real parser tag. @returns {unknown[]} Comparable ordered tag metadata. */
function tagData(tag) {
  return [tag.name, tag.prefix, tag.local, tag.uri,
    Object.values(tag.attributes).map((attribute) => [attribute.name, attribute.prefix, attribute.local, attribute.uri, attribute.value])];
}
/** @param {string} prefix - Requested prefix. @returns {string|undefined} Stable fragment context. */
function resolvePrefix(prefix) { return prefix === 'p' ? 'urn:context' : prefix === '' ? 'urn:default' : undefined; }

/** @param {string} input - XML input. @param {boolean} fragment - Parse mode. @returns {unknown[]} Exact reference events before completion/error. */
function reference(input, fragment) {
  const events = []; const parser = new SaxesParser({ xmlns: true, fragment, defaultXMLVersion: '1.0', forceXMLVersion: true, resolvePrefix: fragment ? resolvePrefix : undefined });
  for (const name of ['text', 'comment', 'cdata', 'doctype']) parser.on(name, (value) => events.push([name, value]));
  parser.on('opentag', (tag) => events.push(['opentag', tagData(tag)]));
  parser.on('closetag', (tag) => events.push(['closetag', tag.name]));
  parser.on('processinginstruction', (value) => events.push(['processinginstruction', value.target, value.body]));
  try { parser.write(input).close(); events.push(['end']); }
  catch (error) { events.push(['error', error instanceof RangeError ? 'RangeError' : 'SyntaxError', error.message]); }
  return events;
}

/** @param {string} input - XML input. @param {boolean} fragment - Parse mode. @returns {unknown[]} Actual native events before completion/error. */
function native(input, fragment) {
  const events = []; const parser = new NativeXmlParser(input, fragment);
  try {
    for (let steps = 0; steps < input.length * 8 + 100; steps++) {
      const event = parser.next();
      if (event.kind === 'resolvePrefix') { parser.resolvePrefix(resolvePrefix(event.value)); continue; }
      if (event.kind === 'error') { events.push(['error', event.errorType, event.value]); return events; }
      if (event.kind === 'end') { events.push(['end']); return events; }
      if (event.kind === 'opentag') events.push(['opentag', tagData(event.tag)]);
      else if (event.kind === 'processinginstruction') events.push([event.kind, event.target, event.value]);
      else events.push([event.kind, event.value]);
    }
    assert.fail('native XML parser did not terminate within its input bound');
  } finally { parser.close(); }
}

module.exports = { reference, native };
