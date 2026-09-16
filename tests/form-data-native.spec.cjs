/** @file Native FormData list contracts and activation through actual public constructors. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { NativeFormDataEntries, formDataConstructionStatistics } = require('../dist/native.cjs');
const { JSDOM } = require('../dist/index.cjs');

test('should preserve native duplicate order, file identities and replacement positions', () => {
  const entries = new NativeFormDataEntries();
  const first = entries.append('a', 'first'); const middle = entries.append('b', 'middle'); const file = entries.append('a', null);
  assert.deepEqual(entries.getAll('a'), ['first', file]); assert.equal(entries.length, 3);
  const copiedIds = entries.ids('a'); assert.ok(copiedIds instanceof Float64Array); assert.deepEqual([...copiedIds], [first, file]);
  copiedIds[0] = 0; assert.equal(entries.firstId('a'), first);
  assert.deepEqual([...entries.allIds()], [first, middle, file]);
  assert.deepEqual(entries.set('a', 'changed'), { id: first, index: 0, existed: true, removed: [file] });
  assert.deepEqual(entries.snapshot(), [{ id: first, name: 'a', value: 'changed' }, { id: middle, name: 'b', value: 'middle' }]);
  assert.deepEqual(entries.delete('a'), [first]); assert.equal(entries.get('a'), null); assert.equal(entries.has('a'), false);
  assert.deepEqual(entries.entryAt(0), { id: middle, name: 'b', value: 'middle' });
});

test('should preserve raw UTF16 names and reject invalid indices without changing the list', () => {
  const entries = new NativeFormDataEntries(); const id = entries.append('\ud800\0', '🦀\udfff');
  assert.equal(entries.get('\ud800\0'), '🦀\udfff'); assert.equal(entries.has('\ufffd\0'), false);
  for (const index of [-1, NaN, Infinity, 0.5, 1]) assert.equal(entries.entryAt(index), null);
  assert.equal(entries.length, 1); assert.deepEqual(entries.entryAt(-0), { id, name: '\ud800\0', value: '🦀\udfff' });
});

test('should execute public FormData operations against the real native list', () => {
  const before = NativeFormDataEntries.statistics(); const dom = new JSDOM('');
  try {
    const data = new dom.window.FormData(); const file = new dom.window.File(['abc'], 'name', { lastModified: 42 });
    data.append('name', 'first'); data.append('file', file); data.append('name', 'second');
    assert.equal(data.get('file'), file); assert.deepEqual(data.getAll('name'), ['first', 'second']);
    data.set('name', 'final'); data.delete('file');
    assert.deepEqual([...data], [['name', 'final']]);
    const after = NativeFormDataEntries.statistics(); assert.equal(after.created - before.created, 1);
    const { implForWrapper } = require('../dist/vendor-jsdom/lib/jsdom/living/generated/utils.js');
    const nativeList = implForWrapper(data)._nativeEntries;
    assert.ok(nativeList instanceof NativeFormDataEntries); assert.equal(nativeList.length, 1);
    assert.equal(nativeList.get('name'), 'final');
  } finally { dom.window.close(); }
});

test('should execute form construction and File preparation through native drivers', () => {
  const dom = new JSDOM('<form><input name="text" value="value"><input type="file" name="file"></form>');
  try {
    const before = formDataConstructionStatistics();
    const data = new dom.window.FormData(dom.window.document.querySelector('form'));
    assert.equal(data.get('text'), 'value'); assert.equal(data.get('file').name, '');
    data.append('blob', new dom.window.Blob(['data'])); assert.equal(data.get('blob').name, 'blob');
    const after = formDataConstructionStatistics(); assert.equal(after.builds - before.builds, 1);
    assert.ok(after.preparations - before.preparations >= 3); assert.equal(after.active, 0);
  } finally { dom.window.close(); }
});
