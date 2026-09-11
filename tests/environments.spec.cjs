/** @file Validates the public Vitest environment lifecycle using its actual global-population utility. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { runInContext } = require('node:vm');
const { JSDOM } = require('../dist/index.cjs');

test('should preserve Blob bytes and multipart filenames when using native Request', async () => {
  const { default: environment } = await import('../src/environments/vitest.mjs');
  const target = { setTimeout, clearTimeout };
  const session = environment.setup(target, { jsdom: { url: 'http://localhost:3000' } });
  try {
    const blob = new target.Blob([new Uint8Array([0, 128, 255])], { type: 'application/octet-stream' });
    const binary = new target.Request('http://localhost/upload', { method: 'POST', body: blob });
    assert.deepEqual([...new Uint8Array(await binary.arrayBuffer())], [0, 128, 255]);
    const form = new target.FormData();
    form.append('tag', 'first');
    form.append('tag', 'second');
    form.append('file', blob, 'binary.dat');
    const request = new target.Request('http://localhost/upload', { method: 'POST', body: form });
    const received = await request.formData();
    assert.deepEqual(received.getAll('tag'), ['first', 'second']);
    assert.equal(received.get('file').name, 'binary.dat');
    assert.deepEqual([...new Uint8Array(await received.get('file').arrayBuffer())], [0, 128, 255]);
  } finally { session.teardown(); }
});

test('should propagate pre-aborted and future Node signals to DOM listeners', async () => {
  const { default: environment } = await import('../src/environments/vitest.mjs');
  const target = { setTimeout, clearTimeout };
  const session = environment.setup(target, {});
  try {
    const button = target.document.createElement('button');
    let calls = 0;
    const controller = new AbortController();
    button.addEventListener('click', () => calls++, { signal: controller.signal });
    button.click();
    controller.abort('finished');
    button.click();
    const stopped = new AbortController();
    stopped.abort();
    button.addEventListener('click', () => calls++, { signal: stopped.signal });
    button.click();
    assert.equal(calls, 1);
  } finally { session.teardown(); }
});

test('should propagate a private DOM signal to a native Request', async () => {
  const { default: environment } = await import('../src/environments/vitest.mjs');
  const other = new JSDOM('');
  const target = { setTimeout, clearTimeout };
  const session = environment.setup(target, {});
  try {
    const controller = new other.window.AbortController();
    const request = new target.Request('http://localhost', { signal: controller.signal });
    controller.abort('cancelled');
    assert.equal(request.signal.aborted, true);
    assert.equal(request.signal.reason, 'cancelled');
  } finally { session.teardown(); other.window.close(); }
});

test('should revoke outstanding object URLs when an environment closes', async () => {
  const { default: environment } = await import('../src/environments/vitest.mjs');
  const target = { setTimeout, clearTimeout };
  const session = environment.setup(target, {});
  const url = target.URL.createObjectURL(new target.Blob(['body'], { type: 'text/plain' }));
  assert.equal(await (await fetch(url)).text(), 'body');
  session.teardown();
  await assert.rejects(fetch(url), TypeError);
});

test('should expose a real VM realm and release its owner when setupVM is used', async () => {
  const { default: environment } = await import('../src/environments/vitest.mjs');
  const session = environment.setupVM({ jsdom: { html: '<p id="message">Hello</p>', runScripts: 'outside-only' } });
  const context = session.getVmContext();
  assert.equal(runInContext('document.getElementById("message").textContent', context), 'Hello');
  assert.equal(runInContext('window === globalThis && document.defaultView === window', context), true);
  assert.equal(runInContext('typeof fetch + ":" + typeof TextEncoder', context), 'function:function');
  session.teardown();
  session.teardown();
  assert.equal(session.getVmContext(), undefined);
});

test('should close VM timers when reserved globals prevent initialization', async () => {
  const { default: environment } = await import('../src/environments/vitest.mjs');
  let fired = false;
  assert.throws(() => environment.setupVM({ jsdom: { beforeParse(window) {
    Object.defineProperty(window, 'jsdom', { value: 'reserved', configurable: false });
    window.setTimeout(() => { fired = true; }, 20);
  } } }), TypeError);
  await new Promise((resolve) => setTimeout(resolve, 40));
  assert.equal(fired, false);
});

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
  assert.deepEqual(JSON.parse(child.stdout), { unhandled: 4, handled: 2 });
});
