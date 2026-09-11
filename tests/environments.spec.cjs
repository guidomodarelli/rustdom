/** @file Validates the public Vitest environment lifecycle using its actual global-population utility. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');

test('should restore global descriptors and stop window timers when teardown runs', async () => {
  const { default: environment } = await import('../src/environments/vitest.mjs');
  const originalWindow = { name: 'original-window' };
  const target = { setTimeout, clearTimeout, setInterval, clearInterval };
  Object.defineProperty(target, 'window', { value: originalWindow, enumerable: false, configurable: true, writable: true });
  const before = Object.getOwnPropertyDescriptors(target);
  const session = environment.setup(target, { jsdom: { runScripts: 'outside-only' } });
  let fired = false;
  target.jsdom.window.setTimeout(() => { fired = true; }, 20);
  target.document.body.innerHTML = '<p>native</p>';
  assert.equal(target.document.querySelector('p').textContent, 'native');
  session.teardown();
  session.teardown();
  await new Promise((resolve) => setTimeout(resolve, 40));
  assert.equal(fired, false);
  assert.deepEqual(Object.getOwnPropertyDescriptors(target), before);
});

for (const property of ['document', 'jsdom']) test(`should roll back partial globals when ${property} prevents environment setup`, async () => {
  const { default: environment } = await import('../src/environments/vitest.mjs');
  const target = { setTimeout, clearTimeout };
  Object.defineProperty(target, property, { configurable: false, value: 'host-property' });
  const before = Object.getOwnPropertyDescriptors(target);
  assert.throws(() => environment.setup(target, {}), TypeError);
  assert.deepEqual(Object.getOwnPropertyDescriptors(target), before);
});

test('should forward unhandled window exceptions and respect user handlers', () => {
  const child = spawnSync(process.execPath, ['tests/fixtures/error-forwarding.cjs'], { encoding: 'utf8' });
  assert.equal(child.status, 0, child.stderr);
  assert.deepEqual(JSON.parse(child.stdout), { unhandled: 1, handled: 1 });
});
