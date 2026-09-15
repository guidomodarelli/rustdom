/** @file Differential native decoding against the exact codec used by the pinned jsdom reference. */
'use strict';
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { dirname, join } = require('node:path');
const { mkdirSync, writeFileSync } = require('node:fs');
const { labelToName, legacyHookDecode } = require('@exodus/bytes/encoding.js');
const labels = require(join(dirname(require.resolve('@exodus/bytes/encoding.js')), 'fallback/encoding.labels.js')).default;
const { fileReaderString, fileReaderEncoding, ReaderStringFormat, NativeFileReaderState } = require('../dist/native.cjs');
const report = { capturedAt: new Date().toISOString(), cases: 0, labels: [], differences: [] };

/** @returns {Buffer[]} Reproducible single-byte, malformed Unicode, BOM and short multibyte inputs. */
function inputs() {
  const values = [Buffer.alloc(0), Buffer.from(Array.from({ length: 256 }, (_, index) => index))];
  for (let byte = 0; byte < 256; byte++) values.push(Buffer.from([byte]));
  for (const bytes of [[0, 0xd8, 255], [0xd8, 0, 255], [0xff, 0xfe, 0, 0xd8, 1], [0xfe, 0xff, 0xd8, 0, 1], [0xef, 0xbb, 0xbf, 0xff]]) values.push(Buffer.from(bytes));
  let seed = 0x12345678;
  for (let index = 0; index < 256; index++) {
    const bytes = [];
    for (let offset = 0; offset <= index % 8; offset++) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; bytes.push(seed >>> 24); }
    values.push(Buffer.from(bytes));
  }
  return values;
}
const corpus = inputs();

for (const [encoding, aliases] of Object.entries(labels)) {
  test(`should match reference decoding for ${encoding} and its aliases`, () => {
    for (const label of [encoding, ...aliases, ` \t${encoding.toUpperCase()}\r\n`]) {
      const selected = labelToName(label) || 'UTF-8'; report.labels.push(label);
      const cases = label === encoding ? corpus : [corpus[1], corpus.at(-1)];
      for (const bytes of cases) {
        const expected = legacyHookDecode(bytes, selected); const actual = fileReaderString(bytes, ReaderStringFormat.Text, fileReaderEncoding(label));
        report.cases++; if (actual !== expected) report.differences.push({ label, bytes: [...bytes], expected, actual });
        assert.equal(actual, expected, `${label}: ${bytes.toString('hex')}`);
      }
    }
  });
}

test('should preserve binary and base64 output and avoid borrowing shared backing', () => {
  assert.equal(fileReaderEncoding(), 'UTF-8'); assert.equal(fileReaderEncoding('unknown label'), 'UTF-8');
  assert.equal(fileReaderEncoding('\u00a0replacement'), 'UTF-8');
  const data = Buffer.from(Array.from({ length: 256 }, (_, index) => index));
  assert.equal(fileReaderString(data, ReaderStringFormat.BinaryString), data.toString('binary'));
  assert.equal(fileReaderString(data, ReaderStringFormat.DataUrl, undefined, 'text/plain'), `data:text/plain;base64,${data.toString('base64')}`);
  assert.equal(fileReaderString(Buffer.from(new SharedArrayBuffer(4)), ReaderStringFormat.Text, 'utf-8'), null);
});

test('should expose the reference shared-abort state transitions without owning JS results', () => {
  const state = new NativeFileReaderState(); assert.equal(state.readyState, 0); assert.equal(state.abort(), false);
  assert.equal(state.begin(), true); assert.equal(state.begin(), false); assert.equal(state.abort(), true);
  assert.equal(state.begin(), true); assert.equal(state.enterStage(), false); assert.equal(state.enterStage(), true);
  state.finish(); assert.equal(state.readyState, 2); assert.equal(state.abort(), false);
});

after(() => { mkdirSync('reports/compatibility', { recursive: true }); writeFileSync(`reports/compatibility/${report.capturedAt.replaceAll(':', '-')}-file-reader-codecs.json`, `${JSON.stringify(report, null, 2)}\n`); });
