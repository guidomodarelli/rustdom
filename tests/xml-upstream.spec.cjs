/** @file Differential XML event coverage over the versioned upstream conformance data. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, mkdirSync, writeFileSync } = require('node:fs');
const { dirname, resolve, relative, sep } = require('node:path');
const { createHash } = require('node:crypto');
const { SaxesParser } = require('saxes');
const { reference, native } = require('./helpers/xml-events.cjs');

test('should preserve saxes event/error behavior across every upstream XML fixture', () => {
  const root = resolve(dirname(require.resolve('@xml-conformance-suite/test-data/package.json')), 'build/dist');
  const metadata = readFileSync(resolve(root, 'cleaned/xmlconf-flattened.xml'), 'utf8');
  const tests = []; const catalog = new SaxesParser({ xmlns: false }); const bases = [resolve(root, 'xmlconf')];
  catalog.on('opentag', (tag) => {
    const base = resolve(bases.at(-1), tag.attributes['xml:base'] ?? ''); bases.push(base);
    if (tag.name === 'TEST') tests.push({ ...tag.attributes, path: resolve(base, tag.attributes.URI) });
  });
  catalog.on('closetag', () => bases.pop());
  catalog.write(metadata).close();
  assert.ok(tests.length > 1000);
  const results = []; const mismatches = [];
  for (const entry of tests) {
    const path = entry.path; assert.ok(path.startsWith(root + sep)); const bytes = readFileSync(path); const input = bytes.toString('utf8');
    const expected = reference(input, false); const actual = native(input, false);
    let pass = true;
    try { assert.deepEqual(actual, expected); } catch { pass = false; mismatches.push({ id: entry.ID, uri: entry.URI, input, expected, actual }); }
    results.push({ id: entry.ID, uri: relative(root, path).split(sep).join('/'), type: entry.TYPE, bytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'), pass, referenceError: expected.at(-1)?.[0] === 'error' });
  }
  const report = { capturedAt: new Date().toISOString(), corpus: '@xml-conformance-suite/test-data@3.0.0', reference: 'saxes@6.0.0',
    methodology: 'Every listed fixture is decoded as a UTF8 JavaScript string and parsed with XML1.0 forced and namespaces enabled. Compare ordered events and exact errors; this is parity evidence, not encoding/DTD/standards conformance certification.',
    total: tests.length, results, mismatches, pass: mismatches.length === 0 };
  mkdirSync('reports/compatibility', { recursive: true }); const path = `reports/compatibility/${report.capturedAt.replaceAll(':', '-')}-xml-upstream.json`;
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`);
  assert.equal(mismatches.length, 0, `${path}: ${JSON.stringify(mismatches.slice(0, 3))}`);
});
