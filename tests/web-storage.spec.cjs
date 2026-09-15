/** @file Differential Storage contracts: UTF16, quotas, named properties, shared frames and events. */
'use strict';
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { mkdirSync, writeFileSync } = require('node:fs');
const runtimes = { jsdom: require('jsdom'), rustdom: require('../dist/index.cjs') };
const report = { capturedAt: new Date().toISOString(), reference: require('jsdom/package.json').version, cases: [] };
const STORAGE_TYPES = ['localStorage', 'sessionStorage'];

/** @param {Window} window - Realm. @param {Storage} storage - Actual receiver. @param {string} method - Public operation. @param {...*} args - Public inputs. @returns {*} Operation result. */
function call(window, storage, method, ...args) { return Reflect.apply(window.Storage.prototype[method], storage, args); }
/** @param {Function} action - Public operation. @param {Window} window - Realm. @returns {*} Result or observable exception. */
function capture(action, window) {
  try { const value = action(); return value === undefined ? { undefined: true } : value; }
  catch (error) { return { name: error.name, message: error.message, code: error.code ?? null, realm: error instanceof window.DOMException || error instanceof window.TypeError }; }
}
/** @param {Window} window - Realm. @param {Storage} storage - Public storage. @returns {object} Keys, values and observable property ordering. */
function snapshot(window, storage) {
  const length = Object.getOwnPropertyDescriptor(window.Storage.prototype, 'length').get.call(storage);
  const keys = Array.from({ length }, (_, index) => call(window, storage, 'key', index));
  return { length, keys, entries: keys.map((key) => [key, call(window, storage, 'getItem', key)]), enumerable: Object.keys(storage) };
}
/** @returns {Promise<void>} Drain two real timer turns, including one round of reentrant delivery. */
async function flushEvents() { for (let turn = 0; turn < 2; turn++) await new Promise((resolve) => setTimeout(resolve, 0)); }
/** @param {string} title - Contract. @param {string} type - Storage family. @param {string} mode - Realm mode. @param {Function} scenario - Real interactions. @param {object} [options] - JSDOM options. @returns {void} Register a paired execution. */
function compare(title, type, mode, scenario, options = {}) {
  test(`should ${title} for ${type} in ${mode}`, async () => {
    const results = {};
    for (const [engine, runtime] of Object.entries(runtimes)) {
      const dom = new runtime.JSDOM('<!doctype html><body>', { url: 'https://storage.example.test/original', ...(mode === 'vm' ? { runScripts: 'outside-only' } : {}), ...options });
      try { results[engine] = await scenario(dom.window, dom.window[type], dom, runtime); await flushEvents(); }
      finally { dom.window.close(); }
    }
    report.cases.push({ title, type, mode, expected: results.jsdom, actual: results.rustdom }); assert.deepEqual(results.rustdom, results.jsdom);
  });
}

for (const type of STORAGE_TYPES) for (const mode of ['default', 'vm']) {
  compare('preserve insertion order, overwrites and exact UTF16 keys and values', type, mode, (window, storage) => {
    const keys = ['', 'a', '02', '1', '__proto__', 'constructor', 'length', 'getItem', 'toString', '\0', '\ud800', '🦀', 'é'];
    for (const key of keys) call(window, storage, 'setItem', key, `value:${key}\0\udfff`);
    const before = snapshot(window, storage); call(window, storage, 'setItem', 'a', 'updated');
    call(window, storage, 'removeItem', '02'); call(window, storage, 'setItem', '02', 'reinserted');
    const after = snapshot(window, storage); call(window, storage, 'clear');
    return { before, after, final: snapshot(window, storage), missing: call(window, storage, 'getItem', 'missing') };
  });
  compare('preserve WebIDL conversion, branding and key index coercion', type, mode, (window, storage) => {
    const trace = [];
    call(window, storage, 'setItem', { toString() { trace.push('key'); return 'first'; } }, { toString() { trace.push('value'); return 'converted'; } });
    call(window, storage, 'setItem', null, undefined); call(window, storage, 'setItem', true, 42);
    return { trace, snapshot: snapshot(window, storage), indices: [-1, 0, 1, 1.9, 2 ** 32, NaN, Infinity, '2', null].map((index) => call(window, storage, 'key', index)),
      errors: [() => new window.Storage(), () => window.Storage.prototype.key.call({}), () => call(window, storage, 'key'),
        () => call(window, storage, 'setItem', 'one'), () => call(window, storage, 'setItem', Symbol('bad'), 'value'),
        () => call(window, storage, 'setItem', 'key', Symbol('bad')), () => call(window, storage, 'key', 1n)].map((action) => capture(action, window)) };
  });
  compare('preserve named-property descriptors and reserved names', type, mode, (window, storage) => {
    storage.visible = 12; const descriptor = Object.getOwnPropertyDescriptor(storage, 'visible');
    const symbol = Symbol('own'); storage[symbol] = 'symbol';
    const defined = capture(() => Reflect.defineProperty(storage, 'defined', { value: 'value' }), window);
    const accessor = capture(() => Reflect.defineProperty(storage, 'accessor', { get() { return 'getter'; } }), window);
    call(window, storage, 'setItem', 'length', 'stored'); call(window, storage, 'setItem', 'getItem', 'stored-method');
    const state = snapshot(window, storage); const deleted = Reflect.deleteProperty(storage, 'visible');
    return { descriptor, defined, accessor, state, deleted, symbol: storage[symbol], methods: typeof storage.getItem,
      lengthValue: call(window, storage, 'getItem', 'length'), sealed: capture(() => Object.preventExtensions(storage), window) };
  });
  compare('preserve reentrant conversions and event-triggered writes', type, mode, async (window, storage) => {
    const trace = []; const failure = new Error('conversion'); let sameError = false;
    try { storage.setItem({ toString() { storage.setItem('nested', 'kept'); trace.push('key'); return 'outer'; } }, { toString() { trace.push('value'); throw failure; } }); }
    catch (error) { sameError = error === failure; }
    await flushEvents(); const frame = window.document.createElement('iframe'); window.document.body.append(frame); const peer = frame.contentWindow;
    const sourceEvents = []; const peerEvents = [];
    window.addEventListener('storage', (event) => sourceEvents.push([event.key, event.newValue]));
    peer.addEventListener('storage', (event) => { peerEvents.push([event.key, event.newValue]); if (event.key === 'request') peer[type].setItem('reply', 'received'); });
    storage.setItem('request', 'sent'); await flushEvents();
    return { trace, sameError, sourceEvents, peerEvents, final: snapshot(window, storage) };
  });
  compare('observe live additions and removals while enumerating named properties', type, mode, (window, storage) => {
    call(window, storage, 'setItem', 'a', '1'); call(window, storage, 'setItem', 'b', '2');
    const original = Object.getPrototypeOf(storage); let changed = false;
    Object.setPrototypeOf(storage, new Proxy(original, { has(target, key) {
      if (key === 'a' && !changed) { changed = true; call(window, storage, 'removeItem', 'b'); call(window, storage, 'setItem', 'c', '3'); }
      return Reflect.has(target, key);
    } }));
    const keys = Reflect.ownKeys(storage).filter((key) => typeof key === 'string'); Object.setPrototypeOf(storage, original);
    return { keys, final: snapshot(window, storage) };
  });
  compare('share areas with same-origin frames and preserve asynchronous payloads', type, mode, async (window, storage, dom) => {
    const frame = window.document.createElement('iframe'); window.document.body.append(frame); const peer = frame.contentWindow;
    const events = []; let ownEvents = 0; window.addEventListener('storage', () => ownEvents++);
    peer.addEventListener('storage', (event) => events.push([event.key, event.oldValue, event.newValue, event.url, event.storageArea === peer[type], event.bubbles, event.cancelable]));
    storage.setItem('key', 'one'); storage.setItem('key', 'one'); storage.setItem('empty', ''); storage.setItem('empty', '');
    storage.removeItem('empty'); storage.removeItem('missing'); const immediate = events.length;
    dom.reconfigure({ url: 'https://storage.example.test/new' }); storage.setItem('key', 'two'); storage.clear(); storage.clear();
    await flushEvents(); return { immediate, ownEvents, events, peer: snapshot(peer, peer[type]), distinct: peer[type] !== storage };
  });
  compare('isolate storage types, independent windows and other origins', type, mode, async (window, storage, dom, runtime) => {
    storage.setItem('kept', 'one'); const otherType = type === 'localStorage' ? 'sessionStorage' : 'localStorage';
    const otherDom = new runtime.JSDOM('', { url: window.location.href });
    const frame = window.document.createElement('iframe'); frame.src = 'https://other.example.test/'; window.document.body.append(frame);
    try { return { otherType: window[otherType].getItem('kept'), independent: otherDom.window[type].getItem('kept'), otherOrigin: frame.contentWindow[type].getItem('kept') }; }
    finally { otherDom.window.close(); }
  });
  compare('preserve quota decisions for UTF16 length and shared frames', type, mode, async (window, storage) => {
    const writes = [];
    for (const [key, value] of [['a', '🦀'], ['b', 'x'], ['a', ''], ['b', '\ud800'], ['b', 'long']]) {
      writes.push({ result: capture(() => storage.setItem(key, value), window), state: snapshot(window, storage) });
    }
    const frame = window.document.createElement('iframe'); window.document.body.append(frame); const peer = frame.contentWindow;
    const peerWrite = capture(() => peer[type].setItem('oversized', 'value'), peer);
    const unchanged = capture(() => storage.setItem('oversized', 'value'), window); const changed = capture(() => storage.setItem('oversized', 'changed'), window);
    await flushEvents(); return { writes, peerWrite, unchanged, changed, final: snapshot(window, storage) };
  }, { storageQuota: 3 });
}

for (const type of STORAGE_TYPES) for (const quota of [0, -1, 1.5, NaN, Infinity, -Infinity]) {
  compare(`preserve numeric quota ${String(quota)}`, type, 'default', (window, storage) => {
    return ['', 'a', 'ab', ''].map((value) => ({ result: capture(() => storage.setItem('', value), window), state: snapshot(window, storage) }));
  }, { storageQuota: quota });
}

for (const type of STORAGE_TYPES) {
  test(`should avoid inherited oldValue setters during ${type} updates`, async () => {
    for (const runtime of Object.values(runtimes)) {
      const { window } = new runtime.JSDOM('', { url: 'https://storage.example.test' }); const storage = window[type];
      storage.setItem('key', 'before'); await flushEvents();
      const descriptor = Object.getOwnPropertyDescriptor(Object.prototype, 'oldValue'); let calls = 0;
      try {
        Object.defineProperty(Object.prototype, 'oldValue', { configurable: true, set() { calls++; throw new Error('inherited setter'); } });
        storage.setItem('key', 'after');
      } finally { if (descriptor) Object.defineProperty(Object.prototype, 'oldValue', descriptor); else delete Object.prototype.oldValue; }
      try { assert.equal(calls, 0); assert.equal(storage.getItem('key'), 'after'); await flushEvents(); }
      finally { window.close(); }
    }
  });

  test(`should reject ${type} access for opaque origins`, () => {
    for (const runtime of Object.values(runtimes)) {
      const { window } = new runtime.JSDOM();
      try { assert.throws(() => window[type], { name: 'SecurityError' }); } finally { window.close(); }
    }
  });
}

after(() => { mkdirSync('reports/compatibility', { recursive: true }); writeFileSync(`reports/compatibility/${report.capturedAt.replaceAll(':', '-')}-web-storage.json`, `${JSON.stringify(report, null, 2)}\n`); });
