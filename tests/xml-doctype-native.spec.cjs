/** @file Exercises native doctype plans and explicit, ordered application of the jsdom entity extension. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { NativeXmlParser } = require('../dist/native.cjs');

test('should interpret UTF16 doctype data without retaining a parser or fabricating missing names', () => {
  assert.deepEqual(NativeXmlParser.describeDoctype(' HTML'), { name: 'HTML', publicId: '', systemId: '' });
  assert.deepEqual(NativeXmlParser.describeDoctype(' r PUBLIC "public" "system"'), { name: 'r', publicId: 'public', systemId: 'system' });
  assert.deepEqual(NativeXmlParser.describeDoctype(' r [<!ENTITY e "<!doctype html>">]'), { name: 'html', publicId: '', systemId: '' });
  assert.deepEqual(NativeXmlParser.describeDoctype(' r SYSTEM "\ud800"'), { name: 'r', publicId: '', systemId: '\ud800' });
  assert.equal(NativeXmlParser.describeDoctype('   '), null);
});

test('should apply entity declarations explicitly with first-value and predefined-name protection', () => {
  const parser = new NativeXmlParser('<r>&e;&amp;&nested;</r>', false);
  try {
    parser.setEntity('e', 'existing');
    assert.equal(parser.applyDoctypeEntities(' r [<!ENTITY e "ignored"><!ENTITY amp "ignored"><!ENTITY nested "&e;literal"><!ENTITY nested "second"><!ENTITY empty "">]'), 1);
    assert.equal(parser.next().kind, 'opentag');
    const result = parser.next(); assert.equal(result.kind, 'text'); assert.equal(result.value, 'existing&&e;literal');
    assert.equal(parser.next().kind, 'closetag'); parser.close();
    assert.equal(result.value, 'existing&&e;literal'); assert.equal(parser.applyDoctypeEntities('<!ENTITY late "x">'), 0);
  } finally { parser.close(); }
  const raw = new NativeXmlParser('<!DOCTYPE r [<!ENTITY e "x">]><r>&e;</r>', false);
  try {
    assert.equal(raw.next().kind, 'doctype'); assert.equal(raw.next().kind, 'opentag');
    assert.equal(raw.next().kind, 'error'); // No implicit extension in the lexical API.
  } finally { raw.close(); }
});
