/** @file Proves native XML use, event independence and resource release through real public parsing. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const runtime = require('../dist/index.cjs');
const { NativeXmlParser, NativeTree } = require('../dist/native.cjs');

test('should use native XML for documents, fragments and DOMParser and close buffers after success or error', () => {
  const before = NativeXmlParser.statistics(); const dom = new runtime.JSDOM('<r xmlns:p="urn:p"><a/></r>', { contentType: 'application/xml' });
  try {
    dom.window.document.documentElement.innerHTML = '<p:b/>';
    assert.equal(dom.window.document.documentElement.firstChild.namespaceURI, 'urn:p');
    assert.throws(() => { dom.window.document.documentElement.innerHTML = '<bad>'; }, { name: 'SyntaxError' });
    const parsed = new dom.window.DOMParser().parseFromString('<x><![CDATA[y]]></x>', 'text/xml');
    assert.equal(parsed.documentElement.firstChild.nodeType, 4);
    assert.ok(NativeXmlParser.statistics().created >= before.created + 4);
    assert.equal(NativeXmlParser.statistics().inputUnits, before.inputUnits);
  } finally { dom.window.close(); }
});

test('should expose context requests, terminal errors and independent UTF16 events without accepting foreign receivers', () => {
  const parser = new NativeXmlParser('<p:r a="x"/>', true);
  assert.equal(parser.next().kind, 'resolvePrefix'); parser.resolvePrefix('urn:p');
  const open = parser.next(); assert.equal(open.tag.uri, 'urn:p'); assert.equal(open.tag.attributes[0].value, 'x');
  assert.equal(parser.next().kind, 'closetag'); assert.equal(parser.next().kind, 'end'); parser.close();
  assert.equal(open.tag.name, 'p:r'); assert.equal(parser.next().kind, 'end');
  for (const receiver of [{}, new NativeTree(), Object.create(NativeXmlParser.prototype)]) {
    assert.throws(() => Reflect.apply(parser.next, receiver, []), { name: 'TypeError' });
  }
  const invalid = new NativeXmlParser('<p:r/>', false, 'input.xml');
  const error = invalid.next(); assert.equal(error.kind, 'error'); assert.equal(error.errorType, 'SyntaxError');
  assert.equal(error.value, 'input.xml:1:6: unbound namespace prefix: "p".');
  assert.equal(invalid.next().kind, 'end'); invalid.close();
});

test('should release native parser buffers and XML document owners over repeated success and failure cycles', () => {
  const child = spawnSync(process.execPath, ['--expose-gc', 'tests/helpers/xml-memory.cjs'], { encoding: 'utf8', timeout: 90_000, maxBuffer: 4 * 1024 * 1024 });
  assert.ifError(child.error); assert.equal(child.status, 0, child.stderr || child.stdout);
  const report = JSON.parse(child.stdout); assert.equal(report.pass, true); assert.equal(report.cycles, 5);
});
