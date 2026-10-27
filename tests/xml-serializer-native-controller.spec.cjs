/** @file Exercises the public native controller's callback and direct-property contracts with the real addon. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { xmlSerializerOperation, xmlSerializerOperationWithNativeProperties, xmlSerializerStatistics } = require('../dist/native.cjs');

test('should serialize a real DOM node and convert getter errors through the ESM native API', async () => {
  const { xmlSerializerOperationWithNativeProperties: operation } = await import('../dist/native.mjs');
  const { JSDOM } = require('../dist/index.cjs');
  const dom = new JSDOM('<root/>', { contentType: 'text/xml', runScripts: 'outside-only' });
  try {
    const owner = { _globalObject: dom.window }, text = dom.window.document.createTextNode('🦀<&>');
    const namespace = { create(globalObject, args) {
      assert.equal(this, namespace); assert.equal(globalObject, dom.window); return new globalObject.DOMException(...args);
    } };
    const helpers = { exceptionNamespace: namespace, wrapper(node) { return node; } };
    assert.equal(operation(owner, text, helpers), '🦀&lt;&amp;&gt;');
    Object.defineProperty(text, 'data', { get() { throw new Error('real text getter'); } });
    assert.throws(() => operation(owner, text, helpers), (error) => error instanceof dom.window.DOMException
      && error.name === 'InvalidStateError' && error.message === 'real text getter');
    assert.equal(xmlSerializerStatistics().active, 0);
  } finally { dom.window.close(); }
});

test('should preserve custom property callbacks and ignored extra arguments in the existing native API', () => {
  const trace = [], namespace = {}, owner = {}, original = {}, globalObject = {}, converted = {};
  const helpers = {
    exceptionNamespace: namespace,
    wrapper(root) { assert.equal(this, helpers); assert.equal(root, owner); throw original; },
    property(receiver, name) {
      assert.equal(this, helpers); assert.equal(arguments.length, 2); trace.push(name);
      if (name === 'create') { assert.equal(receiver, namespace); return factory; }
      if (name === '_globalObject') { assert.equal(receiver, owner); return globalObject; }
      assert.equal(name, 'message'); assert.equal(receiver, original); return 'callback message';
    },
  };
  function factory(global, args) {
    assert.equal(this, namespace); assert.equal(global, globalObject);
    assert.deepEqual(args, ['callback message', 'InvalidStateError']); return converted;
  }
  assert.throws(() => xmlSerializerOperation(owner, owner, helpers, true), (error) => error === converted);
  assert.deepEqual(trace, ['create', '_globalObject', 'message']);
  assert.equal(xmlSerializerStatistics().active, 0);
});

for (const receiverKind of ['object', 'function']) {
  test(`should read native ${receiverKind} properties with the original proxy receiver and evaluation order`, () => {
    const trace = [], globalObject = {}, converted = {};
    /** @param {object} target - Original value. @param {string} name - Expected property. @param {unknown} value - Getter result. @returns {object} Observable receiver. */
    function observe(target, name, value) {
      const proxy = new Proxy(target, { get(targetObject, property, receiver) {
        assert.equal(receiver, proxy); assert.equal(property, name); trace.push(name); return value;
      } });
      return proxy;
    }
    const original = observe(receiverKind === 'function' ? function failure() {} : {}, 'message', 'native message');
    const owner = observe({}, '_globalObject', globalObject);
    const namespace = observe({}, 'create', function create(global, args) {
      assert.equal(this, namespace); assert.equal(global, globalObject);
      assert.deepEqual(args, ['native message', 'InvalidStateError']); trace.push('factory'); return converted;
    });
    const helpers = { exceptionNamespace: namespace, wrapper() { throw original; },
      property() { assert.fail('Object property reads must execute in Rust'); } };
    assert.throws(() => xmlSerializerOperationWithNativeProperties(owner, null, helpers), (error) => error === converted);
    assert.deepEqual(trace, ['create', '_globalObject', 'message', 'factory']);
    assert.equal(xmlSerializerStatistics().active, 0);
  });
}

for (const original of [null, undefined, false, 17, 17n, Symbol('original')]) {
  test(`should retain the scoped primitive property callback for ${String(original)}`, () => {
    const trace = [], converted = {}, owner = { _globalObject: {} };
    const namespace = { create(global, args) {
      assert.equal(this, namespace); assert.equal(global, owner._globalObject);
      assert.deepEqual(args, ['primitive message', 'InvalidStateError']); return converted;
    } };
    const helpers = { exceptionNamespace: namespace, wrapper() { throw original; },
      property(receiver, name) {
        assert.equal(this, helpers); assert.equal(receiver, original); assert.equal(name, 'message');
        trace.push(name); return 'primitive message';
      } };
    assert.throws(() => xmlSerializerOperationWithNativeProperties(owner, null, helpers), (error) => error === converted);
    assert.deepEqual(trace, ['message']); assert.equal(xmlSerializerStatistics().active, 0);
  });
}

for (const property of ['create', '_globalObject', 'message']) {
  for (const failure of [null, undefined, 17, Symbol('getter failure'), {}]) {
    test(`should preserve ${String(failure)} thrown by the native ${property} getter without later reads`, () => {
      const trace = [], original = {}, owner = {}, namespace = {};
      for (const [receiver, name, value] of [[namespace, 'create', () => assert.fail('Factory must remain uncalled')],
        [owner, '_globalObject', {}], [original, 'message', 'message']]) {
        Object.defineProperty(receiver, name, { get() { trace.push(name); if (name === property) throw failure; return value; } });
      }
      const helpers = { exceptionNamespace: namespace, wrapper() { throw original; },
        property() { assert.fail('Object property reads must execute in Rust'); } };
      let caught = false;
      try { xmlSerializerOperationWithNativeProperties(owner, null, helpers); }
      catch (error) { caught = true; assert.equal(error, failure); }
      assert.equal(caught, true); assert.deepEqual(trace, ['create', '_globalObject', 'message'].slice(0, trace.length));
      assert.equal(trace.at(-1), property); assert.equal(xmlSerializerStatistics().active, 0);
    });
  }
}

test('should preserve the invalid factory callback after evaluating all native properties', () => {
  const trace = [], globalObject = {}, original = { get message() { trace.push('message'); return 'original'; } }, converted = {};
  const namespace = { get create() { trace.push('create'); return null; } };
  const owner = { get _globalObject() { trace.push('realm'); return globalObject; } };
  const helpers = { exceptionNamespace: namespace, wrapper() { throw original; },
    property() { assert.fail('Object property reads must execute in Rust'); },
    invalidFactory(factory, global, args) {
      assert.equal(this, helpers); assert.equal(factory, null); assert.equal(global, globalObject);
      assert.deepEqual(args, ['original', 'InvalidStateError']); trace.push('invalid'); throw converted;
    } };
  assert.throws(() => xmlSerializerOperationWithNativeProperties(owner, null, helpers), (error) => error === converted);
  assert.deepEqual(trace, ['create', 'realm', 'message', 'invalid']); assert.equal(xmlSerializerStatistics().active, 0);
});
