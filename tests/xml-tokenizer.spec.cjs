/** @file Differential native XML event testing with deterministic malformed inputs. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdirSync, writeFileSync } = require('node:fs');

const { NativeXmlParser } = require('../dist/native.cjs');

const { reference, native } = require('./helpers/xml-events.cjs');

test('should preserve XML events and error positions across seeded edits and every truncation', () => {
  const bases = [
    '<r a="value">text&amp;tail<b/></r>', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><r/>',
    '<r><!--comment--><![CDATA[x]]><?pi body?></r>', '<!DOCTYPE r [<!ENTITY a "x"><!--d--><?p d?>]><r/>',
    '<r xmlns="urn:r" xmlns:p="urn:p"><p:a p:x="y"/></r>', 'before<a/>after', '<p:a a="x">\r\n😀\ud800</p:a>',
    '<r>]]&gt;&#13;&#x1f600;</r>',
  ];
  const mutations = ['<', '>', '/', '?', '=', "'", '"', '&', ';', ' ', '\n', '\r', '\0', ':', ']', '\ud800', '\udc00'];
  const inputs = new Set(['', '\ufeff', '\r', '\ud800']); let seed = 0x7319;
  const random = (limit) => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % limit; };
  for (const base of bases) {
    for (let index = 0; index <= base.length; index++) inputs.add(base.slice(0, index));
    for (let edit = 0; edit < 100; edit++) {
      const index = random(base.length + 1); const value = mutations[random(mutations.length)];
      inputs.add(base.slice(0, index) + value + base.slice(index));
      inputs.add(base.slice(0, index) + base.slice(index + 1));
    }
  }
  const mismatches = []; let compared = 0; const before = NativeXmlParser.statistics();
  for (const fragment of [false, true]) for (const input of inputs) {
    const expected = reference(input, fragment); const actual = native(input, fragment); compared++;
    try { assert.deepEqual(actual, expected); } catch { mismatches.push({ fragment, input, expected, actual }); }
  }
  assert.equal(NativeXmlParser.statistics().created, before.created + compared);
  assert.equal(NativeXmlParser.statistics().inputUnits, before.inputUnits);
  const report = { capturedAt: new Date().toISOString(), reference: require('saxes/package.json').version, seed: 0x7319, compared, mismatches, pass: mismatches.length === 0 };
  mkdirSync('reports/compatibility', { recursive: true }); const path = `reports/compatibility/${report.capturedAt.replaceAll(':', '-')}-xml-tokenizer.json`;
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`);
  assert.equal(mismatches.length, 0, `${path}: ${JSON.stringify(mismatches.slice(0, 5))}`);
});
