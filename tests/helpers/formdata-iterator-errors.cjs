/** @file Observes the real FormData iterator protocol, intrinsic errors and IteratorClose in isolated workers. */
'use strict';
const { parentPort, workerData } = require('node:worker_threads');
const { resolve } = require('node:path');
const IntrinsicTypeError = TypeError;
const IntrinsicString = String;
const iteratorKey = Symbol.iterator;
const runtimeDirectory = workerData.runtimeDirectory ?? resolve(__dirname, '../../dist');
const runtime = require(workerData.engine === 'jsdom' ? 'jsdom' : resolve(runtimeDirectory, 'index.cjs'));
const nativeBefore = workerData.engine === 'rustdom' ? require(resolve(runtimeDirectory, 'native.cjs')).formDataConstructionStatistics() : null;
const descriptorTypeError = Object.getOwnPropertyDescriptor(globalThis, 'TypeError');
const descriptorString = Object.getOwnPropertyDescriptor(globalThis, 'String');
const poison = { source: 'mutable global hook' };
const result = { cases: [], globalReads: 0, globalCalls: 0, stringReceivers: [], conversionReceivers: [] };
const windows = [];
/** Values cover the ECMAScript types without relying on user conversion hooks for the diagnostic. */
const primitives = [undefined, null, false, true, -0, NaN, Infinity, 42n, 'plain', '\0\ud800', Symbol(), Symbol('\0\ud800')];
const slots = [...primitives, {}, Object.create(null), new Proxy({}, { get() { throw new Error('non-callable slot must not be coerced'); } })];
const thrownValues = [undefined, null, false, 0, 'original failure', Symbol('original failure'), { source: 'original failure' }];
const cases = [];
for (const [index, value] of slots.entries()) {
  cases.push({ phase: 'iterator-slot', index, value }, { phase: 'next-slot', index, value });
}
for (const [index, value] of primitives.entries()) {
  cases.push({ phase: 'factory-result', index, value }, { phase: 'next-result', index, value });
}
for (const phase of ['iterator-get', 'factory-call', 'next-get', 'next-call', 'done-get', 'value-get']) {
  for (const [index, thrown] of thrownValues.entries()) cases.push({ phase, index, thrown });
}
for (const [index, value] of slots.entries()) cases.push({ phase: 'close-slot', index, value, thrown: thrownValues[index % thrownValues.length] });
for (const [index, value] of primitives.entries()) cases.push({ phase: 'close-result', index, value, thrown: thrownValues[index % thrownValues.length] });
for (const phase of ['close-get', 'close-call']) {
  for (const [index, value] of thrownValues.entries()) cases.push({ phase, index, value, thrown: thrownValues[(index + 1) % thrownValues.length] });
}
for (const [index, value] of [undefined, null, false, 0, 42n, Symbol('iterable'), {}, Object.create(null), ''].entries()) cases.push({ phase: 'iterable-value', index, value });
for (const phase of ['class-iterator', 'class-next', 'close-class']) cases.push({ phase, index: 0, thrown: Symbol('body failure') });
for (const phase of ['cached-next', 'done-without-value', 'success']) cases.push({ phase, index: 0 });

/** @param {object} wrapper - Genuine wrapper. @returns {object} Existing implementation used by the upstream construction driver. */
function implementation(wrapper) {
  return wrapper[Object.getOwnPropertySymbols(wrapper).find((symbol) => symbol.description === 'impl')];
}

/** @returns {void} Consumer mutations happen after both runtimes and realms are initialized. */
function mutateGlobals() {
  const [name, behavior] = workerData.mutation.split(':');
  if (name === 'none') return;
  if (behavior === 'getter') Object.defineProperty(globalThis, name, { configurable: true, get() { result.globalReads++; throw poison; } });
  else if (behavior === 'getter-function') Object.defineProperty(globalThis, name, { configurable: true, get() { result.globalReads++; return IntrinsicString; } });
  else if (behavior === 'null') globalThis[name] = null;
  else globalThis[name] = function () {
    result.globalCalls++;
    if (name === 'String') result.stringReceivers.push(this === undefined);
    if (behavior === 'ill-formed') return '\ud800';
    if (behavior === 'undefined-result') return undefined;
    if (behavior === 'null-result') return null;
    if (behavior === 'number-result') return 42;
    if (behavior === 'symbol-result') return Symbol('conversion result');
    if (behavior.startsWith('method-')) {
      const converted = { get toWellFormed() {
        result.globalReads++;
        if (behavior === 'method-getter') throw poison;
        if (behavior === 'method-null') return null;
        return function () { result.conversionReceivers.push(this === converted && arguments.length === 0); return 'converted'; };
      } };
      return converted;
    }
    throw poison;
  };
}

/** @param {object} spec - Protocol transition under test. @param {object} value - Real control/option. @param {string[]} trace - Scalar observations. @returns {object} Actual user-controlled iterable. */
function provider(spec, value, trace) {
  if (spec.phase === 'iterable-value') return spec.value;
  let calls = 0;
  const iterator = Object.create(null);
  const iterable = Object.create(null);
  Object.defineProperty(iterable, iteratorKey, { get() {
    trace.push('iterator.get');
    if (spec.phase === 'iterator-get') throw spec.thrown;
    if (spec.phase === 'iterator-slot') return spec.value;
    if (spec.phase === 'class-iterator') return spec.callable;
    return function () {
      trace.push(`iterator.call:${this === iterable}:${arguments.length}`);
      if (spec.phase === 'factory-call') throw spec.thrown;
      return spec.phase === 'factory-result' ? spec.value : iterator;
    };
  } });
  Object.defineProperty(iterator, 'next', { configurable: true, get() {
    trace.push('next.get');
    if (spec.phase === 'next-get') throw spec.thrown;
    if (spec.phase === 'next-slot') return spec.value;
    if (spec.phase === 'class-next') return spec.callable;
    return function () {
      trace.push(`next.call:${this === iterator}:${arguments.length}`);
      if (spec.phase === 'next-call') throw spec.thrown;
      if (spec.phase === 'next-result') return spec.value;
      if (spec.phase === 'cached-next') Object.defineProperty(iterator, 'next', { get() { trace.push('next.reloaded'); throw poison; } });
      const finished = calls++ > 0 || spec.phase === 'done-without-value';
      return { get done() {
        trace.push('done.get');
        if (spec.phase === 'done-get') throw spec.thrown;
        return finished;
      }, get value() {
        trace.push('value.get');
        if (spec.phase === 'value-get') throw spec.thrown;
        if (finished) throw poison;
        return value;
      } };
    };
  } });
  Object.defineProperty(iterator, 'return', { get() {
    trace.push('return.get');
    if (spec.phase === 'close-get') throw spec.value;
    if (spec.phase === 'close-slot') return spec.value;
    if (spec.phase === 'close-class') return spec.callable;
    return function () {
      trace.push(`return.call:${this === iterator}:${arguments.length}`);
      if (spec.phase === 'close-call') throw spec.value;
      return spec.phase === 'close-result' ? spec.value : {};
    };
  } });
  return iterable;
}

/** @param {object} fixture - Real form in default or VM realm. @param {string} location - Controls or nested options. @param {object} spec - Single transition. @returns {object} Observable result only, with no retained errors or DOM owners. */
function observe(fixture, location, spec) {
  const { window, form, formImpl, select, option, controls, windowTypeError } = fixture;
  const trace = [];
  const readsBefore = result.globalReads;
  const callsBefore = result.globalCalls;
  const target = location === 'controls' ? select : option;
  const bodyKey = location === 'controls' ? 'getAttributeNS' : '_getValue';
  const bodyDescriptor = Object.getOwnPropertyDescriptor(target, bodyKey);
  const optionsDescriptor = Object.getOwnPropertyDescriptor(select, 'options');
  const needsClose = spec.phase.startsWith('close-');
  let caught;
  let threw = false;
  let entries;
  try {
    const activeSpec = spec.phase.includes('class') ? { ...spec, callable: window.eval('(class ProtocolClass {})') } : spec;
    const inner = provider(activeSpec, target, trace);
    if (location === 'controls') formImpl._getSubmittableElementNodes = () => inner;
    else {
      const outerTrace = [];
      const outer = provider({ phase: 'success' }, select, outerTrace);
      formImpl._getSubmittableElementNodes = () => outer;
      Object.defineProperty(select, 'options', { configurable: true, get() { trace.push('options.get'); return inner; } });
      // Keep outer and inner observations ordered in one array without wrapping any platform module.
      outerTrace.push = (...items) => { for (const item of items) trace.push(`outer.${item}`); return 0; };
    }
    if (needsClose) Object.defineProperty(target, bodyKey, { configurable: true, get() { trace.push('body.get'); throw spec.thrown; } });
    try { entries = Array.from(new window.FormData(form)); }
    catch (error) { caught = error; threw = true; }
  } finally {
    formImpl._getSubmittableElementNodes = controls;
    if (bodyDescriptor) Object.defineProperty(target, bodyKey, bodyDescriptor); else delete target[bodyKey];
    if (optionsDescriptor) Object.defineProperty(select, 'options', optionsDescriptor); else delete select.options;
  }
  const expectedThrow = needsClose || ['iterator-get', 'factory-call', 'next-get', 'next-call', 'done-get', 'value-get'].includes(spec.phase);
  const preservedThrow = expectedThrow && threw && caught === spec.thrown;
  return { mode: fixture.mode, location, phase: spec.phase, index: spec.index, trace, threw, entries,
    globalReads: result.globalReads - readsBefore, globalCalls: result.globalCalls - callsBefore,
    preservedThrow, poisonIdentity: caught === poison,
    name: preservedThrow ? undefined : caught?.name, message: preservedThrow ? undefined : caught?.message,
    code: preservedThrow ? undefined : caught?.code,
    hostTypeError: caught instanceof IntrinsicTypeError, windowTypeError: caught instanceof windowTypeError };
}

try {
  const fixtures = ['default', 'vm'].map((mode) => {
    const dom = new runtime.JSDOM('<form><select name="field"><option selected>value</option></select></form>', mode === 'vm' ? { runScripts: 'outside-only' } : {});
    windows.push(dom.window);
    const form = dom.window.document.querySelector('form');
    const select = implementation(form.querySelector('select'));
    const formImpl = implementation(form);
    return { mode, window: dom.window, windowTypeError: dom.window.TypeError, form, formImpl, select,
      option: implementation(form.querySelector('option')), controls: formImpl._getSubmittableElementNodes };
  });
  mutateGlobals();
  for (const fixture of fixtures) for (const location of ['controls', 'options']) for (const spec of cases) result.cases.push(observe(fixture, location, spec));
  if (workerData.engine === 'rustdom') {
    const after = require(resolve(runtimeDirectory, 'native.cjs')).formDataConstructionStatistics();
    result.native = { active: after.active, builds: after.builds - nativeBefore.builds };
  }
} catch (error) {
  result.failure = { name: error?.name, message: error?.message, stack: error?.stack, poisonIdentity: error === poison };
} finally {
  Object.defineProperty(globalThis, 'TypeError', descriptorTypeError);
  Object.defineProperty(globalThis, 'String', descriptorString);
  for (const window of windows) window.close();
}
parentPort.postMessage(result);
