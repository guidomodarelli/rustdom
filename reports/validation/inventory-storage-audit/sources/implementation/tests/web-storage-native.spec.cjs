/** @file Native quota decisions, insertion order, live cursor state and public activation. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { NativeStorageArea, StorageSetStatus } = require('../dist/native.cjs');

test('should plan quotas without mutation and commit against the current shared area', () => {
  const area = new NativeStorageArea(); area.set('a', 'before');
  const plan = area.planSet('a', 'after', 10); assert.equal(plan.status, StorageSetStatus.Write); assert.equal(plan.oldValue, 'before');
  assert.equal(area.get('a'), 'before'); area.set('b', 'reentrant'); area.set('a', 'after');
  assert.equal(area.units, 'aafterbreentrant'.length); assert.equal(area.key(0), 'a'); assert.equal(area.key(1), 'b');
  assert.equal(area.planSet('a', 'after', 0).status, StorageSetStatus.Unchanged);
  assert.equal(area.planSet('a', 'longer', 0).status, StorageSetStatus.QuotaExceeded); assert.equal(area.get('a'), 'after');
});

test('should preserve exact UTF16 and jsdom empty-string oldValue behavior', () => {
  const area = new NativeStorageArea(); area.set('\ud800\0', '🦀'); assert.equal(area.units, 4);
  assert.equal(area.get('\ud800\0'), '🦀'); assert.equal(area.key(0), '\ud800\0');
  assert.equal(area.planSet('a', 'b', 5).status, StorageSetStatus.QuotaExceeded);
  area.set('', ''); assert.deepEqual(area.planSet('', '', NaN), { status: StorageSetStatus.Write, oldValue: null });
  assert.equal(area.get(''), ''); assert.equal(area.delete(''), true); assert.equal(area.delete(''), false);
  area.clear(); assert.equal(area.units, 0); assert.equal(area.capacity, 0);
});

test('should preserve live cursor behavior through mutation and latch exhaustion', () => {
  const area = new NativeStorageArea(); const cursor = area.keyCursor();
  area.set('a', '1'); area.set('b', '2'); assert.equal(cursor.next(), 'a');
  area.delete('b'); area.set('c', '3'); assert.equal(cursor.next(), 'c');
  area.clear(); area.set('a', 'again'); assert.equal(cursor.next(), 'a'); assert.equal(cursor.next(), null);
  area.set('late', 'value'); assert.equal(cursor.next(), null);
  const fresh = area.keyCursor(); assert.equal(fresh.next(), 'a'); assert.equal(fresh.next(), 'late'); assert.equal(fresh.next(), null);
});

test('should share native areas between real frame storages and keep storage types independent', () => {
  const runtime = require('../dist/index.cjs'); const before = NativeStorageArea.statistics();
  const { window } = new runtime.JSDOM('<iframe></iframe>', { url: 'https://storage.example.test' });
  try {
    const peer = window.document.querySelector('iframe').contentWindow; window.localStorage.setItem('key', 'value');
    assert.equal(peer.localStorage.getItem('key'), 'value'); assert.equal(peer.sessionStorage.getItem('key'), null);
    const after = NativeStorageArea.statistics(); assert.equal(after.created - before.created, 2); assert.equal(after.entries - before.entries, 1);
    peer.localStorage.clear(); assert.equal(window.localStorage.length, 0);
  } finally { window.close(); }
});
