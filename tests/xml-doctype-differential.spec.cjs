/** @file Compares native interpretation with the exact pinned driver's independent RegExp contract. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdirSync, writeFileSync } = require('node:fs');
const { NativeXmlParser } = require('../dist/native.cjs');

/** @param {string} body - Raw doctype event. @returns {object|null} Values produced by the pinned driver matching rules. */
function reference(body) {
  const source = `<!doctype ${body}>`;
  if (/<!doctype html>/i.test(source)) return { name: 'html', publicId: '', systemId: '' };
  const publicMatch = /<!doctype\s+([^\s]+)\s+public\s+"([^"]+)"\s+"([^"]+)"/i.exec(source);
  if (publicMatch) return { name: publicMatch[1], publicId: publicMatch[2], systemId: publicMatch[3] };
  const systemMatch = /<!doctype\s+([^\s]+)\s+system\s+"([^"]+)"/i.exec(source);
  if (systemMatch) return { name: systemMatch[1], publicId: '', systemId: systemMatch[2] };
  const nameMatch = /<!doctype\s+([^\s>]+)/i.exec(source);
  return nameMatch ? { name: nameMatch[1] || 'html', publicId: '', systemId: '' } : null;
}

test('should preserve all matching rules across seeded edits, embedded declarations and UTF16 data', () => {
  const bases = [' r PUBLIC "public" "system"', ' r SYSTEM "system"', ' HTML', '', ' r [<!ENTITY e "<!doctype html>">]',
    ' r [<!ENTITY e "<!doctype inner PUBLIC \'p\' \'s\'>">]', ' r > <!doctype inner PUBLIC "p" "s"', '\u0085r\ufeffSYSTEM\u2003"s"'];
  const edits = [' ', '\t', '\n', '\r', '\u00a0', '\u0085', '\ufeff', '>', '<', '"', "'", 'PUBLIC', 'SYSTEM', '\ud800', '\udc00', 'x'];
  const inputs = new Set(bases); let seed = 0x9137;
  const random = (limit) => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % limit; };
  for (const base of bases) {
    for (let index = 0; index <= base.length; index++) inputs.add(base.slice(0, index));
    for (let index = 0; index < 300; index++) {
      const at = random(base.length + 1); inputs.add(base.slice(0, at) + edits[random(edits.length)] + base.slice(at));
    }
  }
  const mismatches = [];
  for (const body of inputs) {
    const expected = reference(body); const actual = NativeXmlParser.describeDoctype(body);
    try { assert.deepEqual(actual, expected); } catch { mismatches.push({ body, expected, actual }); }
  }
  const report = { capturedAt: new Date().toISOString(), seed: 0x9137, compared: inputs.size, mismatches, pass: mismatches.length === 0 };
  mkdirSync('reports/compatibility', { recursive: true }); const path = `reports/compatibility/${report.capturedAt.replaceAll(':', '-')}-xml-doctype-differential.json`;
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`);
  assert.equal(mismatches.length, 0, `${path}: ${JSON.stringify(mismatches.slice(0, 5))}`);
});
