/** @file Validates native listener contracts, lazy allocation and retained-registry ownership. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const runtime = require('../dist/index.cjs');
const { NativeListenerRegistry, ListenerInvocation, NativeTree } = require('../dist/native.cjs');

test('should expose independent ordered snapshots, native once decisions and atomic input rejection', () => {
  const registry = new NativeListenerRegistry(); const type = 'raw\0\ud800';
  const first = registry.add(type, 1, false, true, true); const second = registry.add(type, 1, true, false, false);
  assert.equal(registry.add(type, 1, false, false, false), 0);
  const snapshot = registry.snapshot(type); assert.deepEqual(snapshot, [first, second]);
  const selection = registry.snapshotSelection(type, false);
  assert.deepEqual(selection, { ids: [first, second], selected: [0] });
  assert.equal(registry.prepareInvocation(first, true), ListenerInvocation.OtherPhase);
  assert.equal(registry.prepareInvocation(first, false), ListenerInvocation.Invoke | ListenerInvocation.Once | ListenerInvocation.Passive);
  assert.equal(registry.hasCallback(1), true); assert.deepEqual(snapshot, [first, second]);
  assert.deepEqual(registry.snapshot(type), [second]); assert.equal(registry.remove(type, 1, true), second);
  assert.deepEqual(selection, { ids: [first, second], selected: [0] });
  assert.equal(registry.hasCallback(1), false); assert.equal(registry.hasEventTypes, true);
  assert.equal(registry.prepareInvocation(first, false), ListenerInvocation.Missing);
  const before = registry.storageStatistics();
  for (const invalid of [0, -1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => registry.add('invalid', invalid, false, false, false), { code: 'InvalidArg' });
    assert.throws(() => registry.remove('invalid', invalid, false), { code: 'InvalidArg' });
    assert.throws(() => registry.prepareInvocation(invalid, false), { code: 'InvalidArg' });
    assert.throws(() => registry.hasCallback(invalid), { code: 'InvalidArg' });
  }
  assert.deepEqual(registry.storageStatistics(), before);
  for (const foreign of [{}, new NativeTree(), Object.create(NativeListenerRegistry.prototype)]) {
    assert.throws(() => Reflect.apply(registry.snapshot, foreign, [type]), { name: 'TypeError' });
  }
});

test('should avoid native registry allocation for nodes without listeners and release callback identities on removal', () => {
  const dom = new runtime.JSDOM('<body></body>');
  try {
    const before = NativeListenerRegistry.statistics();
    const nodes = Array.from({ length: 100 }, () => dom.window.document.createElement('section'));
    assert.equal(NativeListenerRegistry.statistics().created, before.created);
    const callback = () => {};
    nodes[0].addEventListener('one', callback); nodes[0].addEventListener('two', callback);
    assert.equal(NativeListenerRegistry.statistics().created, before.created + 1);
    const storage = require('../dist/vendor-jsdom/lib/jsdom/living/generated/utils').implForWrapper(nodes[0])._eventListeners;
    assert.equal(storage.native.storageStatistics().callbacks, 1);
    nodes[0].removeEventListener('one', callback); assert.equal(storage.native.storageStatistics().callbacks, 1);
    nodes[0].removeEventListener('two', callback);
    assert.equal(storage.native.storageStatistics().callbacks, 0); assert.equal(storage.native.storageStatistics().eventTypes, 0);
    assert.equal(storage.hasEventTypes, true);
  } finally { dom.window.close(); }
});

test('should release callback bursts and DOM owners while native registries remain independently retained', () => {
  const child = spawnSync(process.execPath, ['--expose-gc', 'tests/helpers/event-listener-memory.cjs'], {
    encoding: 'utf8', timeout: 90_000, maxBuffer: 4 * 1024 * 1024,
  });
  assert.ifError(child.error); assert.equal(child.status, 0, child.stderr || child.stdout);
  const report = JSON.parse(child.stdout); assert.equal(report.pass, true); assert.equal(report.cycles, 5);
});
