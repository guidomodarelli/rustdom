/** @file Exercises real XMLSerializer control flow, arbitrary exceptions, realm order and native activity. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const runtimes = { jsdom: require('jsdom'), rustdom: require('../dist/index.cjs') };

/** @param {unknown} value - Observed result. @param {unknown[]} identities - Scenario-owned values. @returns {object} Scalar comparison without coercing user values. */
function describe(value, identities = []) {
  const identity = identities.findIndex((candidate) => Object.is(candidate, value));
  if (identity >= 0) return { identity };
  if (typeof value === 'symbol') return { type: 'symbol', description: value.description };
  if (typeof value === 'bigint') return { type: 'bigint', value: String(value) };
  return { type: typeof value, value };
}

/** @param {Function} operation - Actual public call. @param {Window} window - Original realm. @param {unknown[]} [identities] - Original exceptions/results. @returns {object} Observable value or exception contract. */
function capture(operation, window, identities = []) {
  try { return { result: describe(operation(), identities) }; }
  catch (error) {
    const identity = identities.findIndex((candidate) => Object.is(candidate, error));
    if (identity >= 0) return { thrownIdentity: identity };
    return { error: typeof error, name: error?.name, message: describe(error?.message, identities),
      domException: error instanceof window.DOMException, realmTypeError: error instanceof window.TypeError,
      hostTypeError: error instanceof TypeError };
  }
}

/** @param {XMLSerializer} serializer - Actual generated wrapper. @returns {object} Its real implementation, without replacing any library. */
function implementation(serializer) {
  return Object.getOwnPropertySymbols(serializer).map((symbol) => Object.getOwnPropertyDescriptor(serializer, symbol).value)
    .find((value) => value && typeof value.serializeToString === 'function' && '_globalObject' in value);
}

/** @param {string} name - Contract. @param {string} mode - Real scripting/realm profile. @param {Function} scenario - Public DOM operations. @returns {void} Registers independent-reference parity. */
function compare(name, mode, scenario) {
  test(`should preserve ${name} in ${mode}`, () => {
    const results = {};
    for (const [engine, runtime] of Object.entries(runtimes)) {
      const dom = new runtime.JSDOM('<root/>', { contentType: 'text/xml', ...(mode === 'default' ? {} : { runScripts: mode }) });
      try { results[engine] = scenario(dom, runtime); }
      finally { dom.window.close(); }
    }
    assert.deepEqual(results.rustdom, results.jsdom);
  });
}

for (const mode of ['default', 'outside-only', 'dangerously']) {
  for (const kind of ['error', 'null', 'undefined', 'boolean', 'number', 'bigint', 'symbol', 'message-getter', 'message-null', 'message-symbol', 'message-throw']) {
    compare(`error conversion from ${kind}`, mode, (dom) => {
      const trace = [], secondary = new Error('message lookup failed'), symbol = Symbol('original');
      let thrown = new Error('serialization failed');
      if (kind === 'null') thrown = null;
      if (kind === 'undefined') thrown = undefined;
      if (kind === 'boolean') thrown = false;
      if (kind === 'number') thrown = 17;
      if (kind === 'bigint') thrown = 17n;
      if (kind === 'symbol') thrown = symbol;
      if (kind.startsWith('message-')) thrown = { get message() {
        trace.push('message');
        if (kind === 'message-throw') throw secondary;
        return kind === 'message-null' ? null : kind === 'message-symbol' ? symbol : 'observed message';
      } };
      const serializer = new dom.window.XMLSerializer(), owner = implementation(serializer);
      const globalObject = owner._globalObject;
      Object.defineProperty(owner, '_globalObject', { get() { trace.push('realm'); return globalObject; } });
      Object.defineProperty(dom.window.document.documentElement, 'nodeType', { get() { trace.push('nodeType'); throw thrown; } });
      return { output: capture(() => serializer.serializeToString(dom.window.document.documentElement), dom.window, [thrown, secondary, symbol]), trace };
    });
  }

  compare('no realm read on successful serialization', mode, (dom) => {
    const serializer = new dom.window.XMLSerializer(), failure = new Error('realm must remain unread');
    Object.defineProperty(implementation(serializer), '_globalObject', { get() { throw failure; } });
    return capture(() => serializer.serializeToString(dom.window.document), dom.window, [failure]);
  });

  compare('realm lookup failure before reading the caught message', mode, (dom) => {
    const trace = [], failure = new Error('realm lookup failed'), serializer = new dom.window.XMLSerializer();
    const original = { get message() { trace.push('message'); return 'primary'; } };
    Object.defineProperty(implementation(serializer), '_globalObject', { get() { trace.push('realm'); throw failure; } });
    Object.defineProperty(dom.window.document.documentElement, 'nodeType', { get() { throw original; } });
    return { output: capture(() => serializer.serializeToString(dom.window.document.documentElement), dom.window, [failure]), trace };
  });

  compare('reentrant serialization during message lookup', mode, (dom) => {
    const serializer = new dom.window.XMLSerializer(), trace = [], inner = dom.window.document.createElement('inner');
    const original = { get message() { trace.push(serializer.serializeToString(inner)); return 'outer message'; } };
    Object.defineProperty(dom.window.document.documentElement, 'nodeType', { get() { throw original; } });
    return { output: capture(() => serializer.serializeToString(dom.window.document.documentElement), dom.window), trace };
  });

  for (const index of [0, 1]) {
    for (const inheritedKind of ['setter', 'non-writable']) {
      compare(`own exception argument ${index} with an inherited ${inheritedKind}`, mode, (dom) => {
        const serializer = new dom.window.XMLSerializer();
        const previous = Object.getOwnPropertyDescriptor(Array.prototype, index);
        const inheritedFailure = new Error('Inherited array index must not receive an assignment');
        let setterCalls = 0, observedError;
        const original = { get message() {
          Object.defineProperty(Array.prototype, index, inheritedKind === 'setter'
            ? { configurable: true, set() { setterCalls++; throw inheritedFailure; } }
            : { configurable: true, writable: false, value: 'inherited index' });
          return 'original serialization failure';
        } };
        Object.defineProperty(dom.window.document.documentElement, 'nodeType', { get() { throw original; } });
        try { serializer.serializeToString(dom.window.document.documentElement); }
        catch (error) { observedError = error; }
        finally {
          if (previous) Object.defineProperty(Array.prototype, index, previous);
          else delete Array.prototype[index];
        }
        assert.ok(observedError, 'The original serialization failure must be converted');
        return { setterCalls, output: capture(() => { throw observedError; }, dom.window, [inheritedFailure]) };
      });
    }
  }

  compare('dynamic root identity and UTF-16 values', mode, (dom) => {
    const serializer = new dom.window.XMLSerializer(), text = dom.window.document.createTextNode('original');
    const replacement = { replace() { return this; } };
    Object.defineProperty(text, 'data', { get() { return replacement; } });
    const dynamic = serializer.serializeToString(text);
    return { same: dynamic === replacement,
      xml: serializer.serializeToString(dom.window.document.createTextNode('a\0\ud800🦀<&>')) };
  });

  compare('the serializer realm for errors from a different document realm', mode, (dom, runtime) => {
    const other = new runtime.JSDOM('<other/>', { contentType: 'text/xml', runScripts: 'outside-only' });
    try {
      Object.defineProperty(other.window.document.documentElement, 'nodeType', { get() { throw new Error('foreign node getter'); } });
      try { new dom.window.XMLSerializer().serializeToString(other.window.document.documentElement); assert.fail('Expected serialization failure'); }
      catch (error) { return { name: error.name, message: error.message,
        serializerRealm: error instanceof dom.window.DOMException, documentRealm: error instanceof other.window.DOMException }; }
    } finally { other.window.close(); }
  });

  for (const receiver of ['undefined', 'null', 'object', 'prototype']) {
    compare(`WebIDL receiver rejection for ${receiver}`, mode, (dom, runtime) => {
      const target = receiver === 'undefined' ? undefined : receiver === 'null' ? null : receiver === 'object' ? {} : dom.window.XMLSerializer.prototype;
      const before = runtime.getNativeTreeStatistics?.().xmlSerializerOperations?.calls;
      const output = capture(() => dom.window.XMLSerializer.prototype.serializeToString.call(target, dom.window.document), dom.window);
      if (before !== undefined) assert.equal(runtime.getNativeTreeStatistics().xmlSerializerOperations.calls, before);
      return output;
    });
  }

  for (const root of ['missing', 'undefined', 'null', 'number', 'object', 'symbol']) {
    compare(`WebIDL rejection for ${root}`, mode, (dom, runtime) => {
      const serializer = new dom.window.XMLSerializer();
      const args = root === 'missing' ? [] : [root === 'undefined' ? undefined : root === 'null' ? null
        : root === 'number' ? 42 : root === 'symbol' ? Symbol('root') : {}];
      const before = runtime.getNativeTreeStatistics?.().xmlSerializerOperations?.calls;
      const output = capture(() => serializer.serializeToString(...args), dom.window);
      const after = runtime.getNativeTreeStatistics?.().xmlSerializerOperations?.calls;
      if (before !== undefined) assert.equal(after, before, 'WebIDL rejects before entering the native controller');
      return output;
    });
  }
}

test('should route real successful and exceptional calls through the native controller and leave no active operation', () => {
  const runtime = runtimes.rustdom, dom = new runtime.JSDOM('<root/>', { contentType: 'text/xml' });
  try {
    const before = runtime.getNativeTreeStatistics().xmlSerializerOperations;
    assert.ok(before, 'The actual public runtime must expose its native operation counters');
    const serializer = new dom.window.XMLSerializer();
    assert.equal(serializer.serializeToString(dom.window.document), '<root/>');
    Object.defineProperty(dom.window.document.documentElement, 'nodeType', { get() { throw new Error('actual getter'); } });
    assert.throws(() => serializer.serializeToString(dom.window.document.documentElement), (error) => error instanceof dom.window.DOMException);
    const after = runtime.getNativeTreeStatistics().xmlSerializerOperations;
    assert.equal(after.calls - before.calls, 2); assert.equal(after.errorConversions - before.errorConversions, 1);
    assert.equal(after.active, 0);
  } finally { dom.window.close(); }
});
