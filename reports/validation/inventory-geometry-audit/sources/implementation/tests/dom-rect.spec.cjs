/** @file Differential public geometry contracts, including IEEE-754 values and WebIDL realms. */
'use strict';
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { mkdirSync, writeFileSync } = require('node:fs');
const runtimes = { jsdom: require('jsdom'), rustdom: require('../dist/index.cjs') };
/** Preserve signed zeros and nonfinite values in the durable differential report. */
const report = { capturedAt: new Date().toISOString(), reference: require('jsdom/package.json').version, cases: [] };
const FIELDS = ['x', 'y', 'width', 'height', 'top', 'right', 'bottom', 'left'];
const NUMBERS = [0, -0, 1, -1, 0.25, -0.25, Number.MIN_VALUE, -Number.MIN_VALUE, Number.MAX_VALUE, -Number.MAX_VALUE, Infinity, -Infinity, NaN];

/** @param {DOMRectReadOnly} rect - Actual public rectangle. @returns {object} Scalar values, JSON ordering and descriptor behavior. */
function snapshot(rect) {
  const json = rect.toJSON();
  return { values: FIELDS.map((key) => rect[key]), json: FIELDS.map((key) => json[key]), keys: Object.keys(json), text: JSON.stringify(rect), tag: Object.prototype.toString.call(rect) };
}
/** @param {Function} action - Public operation. @param {Window} window - Calling realm. @returns {*} Result or observable exception. */
function capture(action, window) {
  try { return action(); }
  catch (error) { return { name: error.name, message: error.message, realm: error instanceof window.TypeError }; }
}
/** @param {string} title - Contract. @param {string} kind - Public constructor. @param {string} mode - Realm mode. @param {Function} scenario - Real operation. @returns {void} Register independent engine comparison. */
function compare(title, kind, mode, scenario) {
  test(`should ${title} for ${kind} in ${mode}`, () => {
    const results = {};
    for (const [engine, runtime] of Object.entries(runtimes)) {
      const { window } = new runtime.JSDOM('<!doctype html><body>', mode === 'vm' ? { runScripts: 'outside-only' } : {});
      try { results[engine] = scenario(window, window[kind]); }
      finally { window.close(); }
    }
    report.cases.push({ title, kind, mode, expected: results.jsdom, actual: results.rustdom });
    assert.deepEqual(results.rustdom, results.jsdom);
  });
}

for (const kind of ['DOMRectReadOnly', 'DOMRect']) for (const mode of ['default', 'vm']) {
  compare('preserve both axes for every pair of special numbers', kind, mode, (window, Constructor) => {
    return NUMBERS.flatMap((start) => NUMBERS.map((size) => snapshot(new Constructor(start, start, size, size))));
  });
  compare('apply constructor defaults and unrestricted double coercion', kind, mode, (window, Constructor) => {
    const trace = [];
    const input = [1, 2, 3, 4].map((value) => ({ valueOf() { trace.push(value); return value; } }));
    const converted = snapshot(new Constructor(...input));
    const values = [[], [undefined, -0], [null, false, true, '2.5'], [[], [1], '', undefined]];
    return { trace, converted, defaults: values.map((args) => snapshot(new Constructor(...args))),
      symbol: capture(() => new Constructor(Symbol('invalid')), window), bigint: capture(() => new Constructor(1n), window),
      noNew: capture(() => Constructor(), window) };
  });
  compare('convert fromRect members in order and create independent base instances', kind, mode, (window, Constructor) => {
    const trace = []; const source = {};
    for (const [index, key] of ['height', 'width', 'x', 'y'].entries()) Object.defineProperty(source, key, {
      get() { trace.push(`get:${key}`); return { valueOf() { trace.push(`convert:${key}`); return index - 2; } }; },
    });
    class Child extends Constructor {}
    const from = Child.fromRect(source); const direct = new Child(4, 3, 2, 1); const copy = Constructor.fromRect(direct);
    const failure = new Error('dictionary getter'); let sameError = false;
    try { Constructor.fromRect({ get height() { throw failure; }, get width() { throw new Error('must not read'); } }); }
    catch (error) { sameError = error === failure; }
    return { trace, from: snapshot(from), base: Object.getPrototypeOf(from) === Constructor.prototype, child: from instanceof Child,
      directChild: direct instanceof Child, copy: snapshot(copy), independent: copy !== direct, sameError,
      null: snapshot(Constructor.fromRect(null)), omitted: snapshot(Constructor.fromRect()),
      nonObject: capture(() => Constructor.fromRect(12), window), methodThis: snapshot(Constructor.fromRect.call(null, { x: 8 })) };
  });
  compare('keep writable and readonly fields and native values independent of expandos', kind, mode, (window, Constructor) => {
    const rect = new Constructor(2, 3, -4, -5); const writes = [];
    for (const key of FIELDS) writes.push([key, capture(() => Reflect.set(rect, key, -0), window), rect[key]]);
    const before = snapshot(rect); Object.defineProperty(rect, 'x', { get() { throw new Error('public override'); }, configurable: true });
    const json = rect.toJSON(); delete rect.x; rect.extra = 'expando';
    const descriptors = FIELDS.map((key) => { const descriptor = Object.getOwnPropertyDescriptor(Constructor.prototype, key); return [key, descriptor && [typeof descriptor.get, typeof descriptor.set, descriptor.enumerable, descriptor.configurable]]; });
    return { writes, before, json, after: snapshot(rect), extra: rect.extra, descriptors };
  });
  compare('preserve getter branding, cross-realm calls and toJSON object realm', kind, mode, (window, Constructor) => {
    const rect = new Constructor(1, 2, 3, 4); const getter = Object.getOwnPropertyDescriptor(window.DOMRectReadOnly.prototype, 'x').get;
    const json = rect.toJSON(); const next = rect.toJSON(); json.x = 999;
    const serialized = window.DOMRectReadOnly.prototype.toJSON.call(rect);
    return { getter: getter.call(rect), invalidGetter: capture(() => getter.call({}), window),
      invalidJson: capture(() => window.DOMRectReadOnly.prototype.toJSON.call({}), window),
      readOnly: rect instanceof window.DOMRectReadOnly, mutable: rect instanceof window.DOMRect,
      resultHost: Object.getPrototypeOf(json) === Object.prototype, resultWindow: Object.getPrototypeOf(json) === window.Object.prototype,
      independent: next !== json, unchanged: next.x, serialized, keys: Object.keys(next),
      descriptors: Object.values(Object.getOwnPropertyDescriptors(next)).map((descriptor) => [descriptor.writable, descriptor.configurable, descriptor.enumerable]) };
  });
  compare('propagate setter errors and reentrant conversion before updating state', kind, mode, (window, Constructor) => {
    const rect = new Constructor(1, 2, 3, 4); const trace = [];
    const reentrant = capture(() => Reflect.set(rect, 'x', { valueOf() { trace.push('convert'); Reflect.set(rect, 'width', -5); return -2; } }), window);
    const after = snapshot(rect); const errors = [Symbol('invalid'), 1n].map((value) => capture(() => Reflect.set(rect, 'y', value), window));
    const sequence = NUMBERS.map((value) => { const success = Reflect.set(rect, 'height', value); return [success, snapshot(rect)]; });
    return { trace, reentrant, after, errors, sequence };
  });
}

test('should define JSON data properties without invoking inherited setters', () => {
  for (const runtime of Object.values(runtimes)) {
    const { window } = new runtime.JSDOM('', { runScripts: 'outside-only' }); const rect = new window.DOMRect(1, 2, 3, 4);
    const original = FIELDS.map((key) => Object.getOwnPropertyDescriptor(Object.prototype, key));
    let calls = 0; let result;
    try {
      for (const key of FIELDS) Object.defineProperty(Object.prototype, key, { configurable: true, set() { calls++; throw new Error('inherited setter'); } });
      result = rect.toJSON();
    } finally {
      for (const [index, key] of FIELDS.entries()) {
        if (original[index]) Object.defineProperty(Object.prototype, key, original[index]); else delete Object.prototype[key];
      }
      window.close();
    }
    assert.equal(calls, 0); assert.deepEqual(result, { x: 1, y: 2, width: 3, height: 4, top: 2, right: 4, bottom: 6, left: 1 });
  }
});

test('should retain independent rectangle identities across window factories', () => {
  for (const runtime of Object.values(runtimes)) {
    const first = new runtime.JSDOM('', { runScripts: 'outside-only' }); const second = new runtime.JSDOM('', { runScripts: 'outside-only' });
    try {
      const rect = new first.window.DOMRect(1, 2, 3, 4); const copy = second.window.DOMRect.fromRect(rect);
      assert.ok(copy instanceof second.window.DOMRect); assert.equal(copy instanceof first.window.DOMRect, false);
      rect.width = -9; assert.equal(copy.width, 3); assert.equal(rect.left, -8);
      const zero = first.window.document.body.getBoundingClientRect();
      assert.equal(zero.x, 0); assert.equal(zero.width, 0);
    } finally { first.window.close(); second.window.close(); }
  }
});

after(() => {
  mkdirSync('reports/compatibility', { recursive: true });
  const json = JSON.stringify(report, (key, value) => typeof value === 'number' && (!Number.isFinite(value) || Object.is(value, -0)) ? { number: Object.is(value, -0) ? '-0' : String(value) } : value, 2);
  writeFileSync(`reports/compatibility/${report.capturedAt.replaceAll(':', '-')}-dom-rect.json`, `${json}\n`);
});
