/** @file Differential iterator contracts against the real pinned XML serializer and native addon. */
'use strict';
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { mkdirSync, writeFileSync } = require('node:fs');
const { Worker } = require('node:worker_threads');
const { spawnSync } = require('node:child_process');
const { runInNewContext } = require('node:vm');
const reference = require('w3c-xmlserializer');
const { serializeXml, xmlSerializationStatistics } = require('../dist/native.cjs');
const observations = [];
const capturedAt = new Date().toISOString();
const primitives = [undefined, null, false, 1, 'x', Symbol('x'), 42n, '\0\ud800'];

/** @param {string} location - Iteration site. @param {object} iterable - Observable iterator provider. @returns {object} Public serializer input. */
function rootAt(location, iterable) {
  return location === 'children' ? { nodeType: 11, childNodes: iterable } : {
    nodeType: 1, namespaceURI: null, prefix: null, localName: 'r', attributes: iterable, childNodes: [],
  };
}

/** @param {Function} serialize - Actual serializer. @param {Function} fixture - Independent input and trace. @returns {object} Observable result and error realm. */
function capture(serialize, fixture) {
  const { root, trace } = fixture();
  try { return { value: serialize(root, false), trace }; }
  catch (error) { if (error?.code === 'ERR_ASSERTION') throw error; return { name: error?.name, message: error?.message, hostTypeError: error instanceof TypeError, trace }; }
}

/** @param {string} name - Behavioral contract. @param {Function} fixture - Fresh observable input. @returns {void} Compare real engines and temporary reference release. */
function compare(name, fixture) {
  test(`should ${name}`, () => {
    const expected = capture(reference, fixture);
    const actual = capture(serializeXml, fixture);
    observations.push({ name, expected, actual });
    assert.deepEqual(actual, expected);
    const statistics = xmlSerializationStatistics();
    assert.equal(statistics.live, 0); assert.equal(statistics.references, 0); assert.equal(statistics.cleanupErrors, 0);
  });
}

for (const location of ['children', 'attributes']) {
  for (const phase of ['method', 'iterator', 'next', 'result']) {
    for (const [index, value] of primitives.entries()) {
      compare(`preserve ${location} ${phase} primitive ${index} rejection and ordering`, () => {
        const trace = [];
        const iterator = {
          next() { trace.push('next'); return value; },
          return() { trace.push('return'); return {}; },
        };
        const iterable = { [Symbol.iterator]() { trace.push('iterator'); return phase === 'iterator' ? value : iterator; } };
        if (phase === 'method') iterable[Symbol.iterator] = value;
        if (phase === 'next') iterator.next = value;
        return { root: rootAt(location, iterable), trace };
      });
    }
  }
  compare(`reject a non-callable ${location} next without object coercion`, () => {
    const trace = [];
    const next = { get toString() { assert.fail('non-callable diagnostics must not inspect conversion hooks'); } };
    const iterator = { next, return() { trace.push('return'); return {}; } };
    return { root: rootAt(location, { [Symbol.iterator]() { return iterator; } }), trace };
  });
  compare(`accept callable objects as ${location} iterator and iteration result`, () => {
    const trace = [];
    function result() {}
    result.done = true;
    function iterator() {}
    iterator.next = function () { trace.push('next'); assert.equal(this, iterator); return result; };
    return { root: rootAt(location, { [Symbol.iterator]() { return iterator; } }), trace };
  });
  compare(`cache ${location} next once and skip value when done`, () => {
    const trace = [];
    let steps = 0;
    const entry = location === 'children' ? { nodeType: 3, data: 'value' } : { namespaceURI: null, prefix: null, localName: 'a', value: 'value' };
    const iterator = { get next() { trace.push('get next'); return function () {
      assert.equal(this, iterator); trace.push('next'); steps++;
      return {
        get done() { trace.push('done'); return steps > 1; },
        get value() {
          assert.equal(steps, 1, 'done must skip value');
          Object.defineProperty(iterator, 'next', { get() { assert.fail('next must stay cached'); } });
          return entry;
        },
      };
    }; }, return() { assert.fail('normal completion must not close'); } };
    return { root: rootAt(location, { [Symbol.iterator]() { return iterator; } }), trace };
  });
  for (const phase of ['iterator getter', 'iterator call', 'next getter', 'next call', 'done', 'value', 'body']) {
    for (const thrown of [undefined, null, Symbol('thrown'), 42n, runInNewContext('new TypeError("foreign error")')]) {
      test(`should preserve ${location} ${phase} thrown identity ${typeof thrown}`, () => {
        for (const serialize of [reference, serializeXml]) {
          let closed = 0;
          const fail = () => { throw thrown; };
          const entry = location === 'children' ? { get nodeType() { return fail(); } } : { get namespaceURI() { return fail(); } };
          const step = { done: false, value: entry };
          if (phase === 'done' || phase === 'value') Object.defineProperty(step, phase, { get: fail });
          const iterator = { next() { return phase === 'next call' ? fail() : step; }, return() { closed++; throw Symbol('close error'); } };
          if (phase === 'next getter') Object.defineProperty(iterator, 'next', { get: fail });
          const iterable = { [Symbol.iterator]() { return phase === 'iterator call' ? fail() : iterator; } };
          if (phase === 'iterator getter') Object.defineProperty(iterable, Symbol.iterator, { get: fail });
          let caught = false;
          try { serialize(rootAt(location, iterable), false); } catch (error) { caught = true; assert.equal(error, thrown); }
          assert.equal(caught, true); assert.equal(closed, phase === 'body' ? 1 : 0);
          assert.equal(xmlSerializationStatistics().references, 0);
        }
      });
    }
  }
  for (const returnValue of [...primitives, {}]) {
    test(`should preserve ${location} body failure over return value ${typeof returnValue}`, () => {
      for (const serialize of [reference, serializeXml]) {
        const original = Symbol('body failure');
        const entry = location === 'children' ? { get nodeType() { throw original; } } : { get namespaceURI() { throw original; } };
        for (const returnMethod of [returnValue, () => returnValue]) {
          const iterator = { next() { return { done: false, value: entry }; }, return: returnMethod };
          let caught = false;
          try { serialize(rootAt(location, { [Symbol.iterator]() { return iterator; } }), false); }
          catch (error) { caught = true; assert.equal(error, original); }
          assert.equal(caught, true); assert.equal(xmlSerializationStatistics().references, 0);
        }
      }
    });
  }
}

for (const replacement of [undefined, null, { iterator: Symbol('wrong iterator') }]) {
  test(`should preserve the intrinsic iteration key when global Symbol is ${typeof replacement}`, () => {
    const root = rootAt('children', []);
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'Symbol');
    let reads = 0;
    let expected, actual;
    try {
      Object.defineProperty(globalThis, 'Symbol', { configurable: true, get() { reads++; return replacement; } });
      expected = capture(reference, () => ({ root, trace: [] }));
      actual = capture(serializeXml, () => ({ root, trace: [] }));
    } finally { Object.defineProperty(globalThis, 'Symbol', descriptor); }
    assert.deepEqual(actual, expected); assert.equal(reads, 0);
  });
}

test('should format Symbol iteration failures without invoking mutable conversion hooks', () => {
  const value = Symbol('diagnostic');
  const root = rootAt('children', { [Symbol.iterator]() { return { next() { return value; } }; } });
  const originalString = globalThis.String;
  const originalToString = Symbol.prototype.toString;
  let expected, actual;
  try {
    globalThis.String = () => { assert.fail('diagnostic must not invoke global String'); };
    Symbol.prototype.toString = () => { assert.fail('diagnostic must not invoke replaced Symbol#toString'); };
    expected = capture(reference, () => ({ root, trace: [] }));
    actual = capture(serializeXml, () => ({ root, trace: [] }));
  } finally { globalThis.String = originalString; Symbol.prototype.toString = originalToString; }
  assert.deepEqual(actual, expected);
});

test('should preserve the originating error realm when called from a foreign VM context', () => {
  const root = rootAt('children', { [Symbol.iterator]() { return { next() { return false; } }; } });
  const source = 'try { serialize(root, false); } catch (error) { ({ name: error.name, message: error.message, callerRealm: error instanceof TypeError }); }';
  const expected = runInNewContext(source, { serialize: reference, root });
  const actual = runInNewContext(source, { serialize: serializeXml, root });
  assert.deepEqual({ ...actual }, { ...expected });
});

for (const scenario of ['null', 'undefined', 'wrong-iterator', 'throwing-getter', 'decoy-first']) {
  test(`should load and serialize a public DOM when Symbol's constructor is ${scenario} before import`, () => {
    const fixturePath = require.resolve('./integration/xml-intrinsics-init.cjs');
    const outputs = ['jsdom', 'rustdom'].map((engine) => {
      const result = spawnSync(process.execPath, [fixturePath, engine, scenario], { encoding: 'utf8' });
      assert.equal(result.status, 0, `${engine} ${scenario}: ${result.stderr}`);
      return JSON.parse(result.stdout);
    });
    assert.deepEqual(outputs[1], outputs[0]);
    observations.push({ name: `initialization ${scenario}`, expected: outputs[0], actual: outputs[1] });
  });
}

test('should preserve native iterator contracts across independent worker environments and reloads', async () => {
  const nativePath = require.resolve('../dist/native.cjs');
  const addonPath = require.resolve('../dist/rustdom.node');
  const source = `
    const { parentPort, workerData } = require('node:worker_threads');
    const assert = require('node:assert/strict');
    const root = { nodeType: 11, childNodes: [] };
    const invalidValue = Symbol('worker');
    const invalid = { nodeType: 11, childNodes: { [Symbol.iterator]() { return { next() { return invalidValue; } }; } } };
    const IntrinsicTypeError = TypeError;
    const originalSymbol = Symbol;
    const originalConstructor = Object.getOwnPropertyDescriptor(Symbol.prototype, 'constructor');
    const originalTypeError = TypeError;
    let failure, statistics;
    try {
      Object.defineProperty(originalSymbol.prototype, 'constructor', { configurable: true, get() { assert.fail('must not read Symbol constructor'); } });
      globalThis.Symbol = undefined;
      globalThis.TypeError = function () { assert.fail('must use intrinsic error realm'); };
      const native = require(workerData.nativePath);
      delete require.cache[workerData.addonPath];
      const reloaded = require(workerData.addonPath);
      for (let iteration = 0; iteration < 100; iteration++) {
        assert.equal(native.serializeXml(root, false), '');
        assert.equal(reloaded.serializeXml(root, false), '');
        try { native.serializeXml(invalid, false); } catch (error) { failure = error; }
      }
      statistics = native.xmlSerializationStatistics();
    } finally {
      globalThis.Symbol = originalSymbol; globalThis.TypeError = originalTypeError;
      Object.defineProperty(originalSymbol.prototype, 'constructor', originalConstructor);
    }
    assert.ok(failure instanceof IntrinsicTypeError);
    assert.equal(failure.message, 'Iterator result Symbol(worker) is not an object');
    parentPort.postMessage(statistics);
  `;
  for (let cycle = 0; cycle < 8; cycle++) {
    const statistics = await new Promise((resolve, reject) => {
      const worker = new Worker(source, { eval: true, workerData: { nativePath, addonPath } });
      let message;
      worker.once('message', (value) => { message = value; });
      worker.once('error', reject);
      worker.once('exit', (code) => code === 0 ? resolve(message) : reject(new Error(`XML iterator worker exited with ${code}`)));
    });
    assert.equal(statistics.live, 0); assert.equal(statistics.references, 0); assert.equal(statistics.cleanupErrors, 0);
    assert.equal(xmlSerializationStatistics().cleanupErrors, 0);
  }
});

after(() => {
  mkdirSync('reports/compatibility', { recursive: true });
  writeFileSync(`reports/compatibility/${capturedAt.replaceAll(':', '-')}-xml-iterator.json`, `${JSON.stringify({
    capturedAt, node: process.version, reference: require('w3c-xmlserializer/package.json').version, cases: observations,
  }, null, 2)}\n`);
});
