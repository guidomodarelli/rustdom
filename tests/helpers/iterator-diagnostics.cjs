/** @file Exercises real iterator diagnostics after mutating conversion hooks in a fresh Worker. */
'use strict';
const { parentPort, workerData } = require('node:worker_threads');
const { resolve } = require('node:path');
const runtimeDirectory = workerData.runtimeDirectory ?? resolve(__dirname, '../../dist');
const nativePath = resolve(runtimeDirectory, 'native.cjs');
const runtimePath = resolve(runtimeDirectory, 'index.cjs');
const IntrinsicTypeError = TypeError;
const intrinsicSymbol = Symbol;
const symbolDescriptor = Object.getOwnPropertyDescriptor(Symbol.prototype, 'toString');
const stringDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'String');
const typeErrorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'TypeError');
const poison = new Error('conversion hook must not run', { cause: Symbol('poison cause') });
const values = [undefined, null, false, true, -0, NaN, Infinity, 42n, 'plain', '\0\ud800', Symbol(), Symbol('\0\ud800')];
const observed = { reads: 0, calls: 0, cases: [] };
const windows = [];

/** @returns {void} Replace only the hook under test and record accidental observations. */
function installMutation() {
  const { mutation } = workerData;
  if (mutation === 'symbol-method') Symbol.prototype.toString = function () { observed.calls++; return 'spoofed symbol'; };
  if (mutation === 'symbol-getter') Object.defineProperty(Symbol.prototype, 'toString', {
    configurable: true, get() { observed.reads++; return function () { observed.calls++; throw poison; }; },
  });
  if (mutation === 'symbol-throw') Symbol.prototype.toString = function () { observed.calls++; throw poison; };
  if (mutation === 'string-function') globalThis.String = function () { observed.calls++; return 'spoofed primitive'; };
  if (mutation === 'string-null') globalThis.String = null;
  if (mutation === 'string-getter') Object.defineProperty(globalThis, 'String', {
    configurable: true, get() { observed.reads++; throw poison; },
  });
  if (mutation === 'type-error-getter') Object.defineProperty(globalThis, 'TypeError', {
    configurable: true, get() { observed.reads++; throw poison; },
  });
}

/** @returns {void} Restore before closing windows or communicating with the parent. */
function restoreMutation() {
  Object.defineProperty(intrinsicSymbol.prototype, 'toString', symbolDescriptor);
  Object.defineProperty(globalThis, 'String', stringDescriptor);
  Object.defineProperty(globalThis, 'TypeError', typeErrorDescriptor);
}

/** @param {unknown} error - Actual thrown value. @param {Window} [window] - Optional public DOM realm. @returns {object} Observable error contract. */
function describe(error, window) {
  return { name: error?.name, message: error?.message, hostTypeError: error instanceof IntrinsicTypeError,
    windowTypeError: window ? error instanceof window.TypeError : undefined, poisonIdentity: error === poison,
    poisonCauseIdentity: error?.cause === poison.cause };
}

/** @param {Function} operation - Real operation. @param {Window} [window] - Its DOM realm. @returns {object} Error details without replacing exceptions. */
function capture(operation, window) {
  try { operation(); return { completed: true }; }
  catch (error) { return describe(error, window); }
}

/** @param {unknown} value - Primitive next result. @param {string[]} trace - Actual iteration observations. @returns {object} Iterator provider. */
function iterable(value, trace) {
  return { [intrinsicSymbol.iterator]() {
    trace.push('iterator');
    return { next() { trace.push('next'); return value; }, get return() { trace.push('return'); throw poison; } };
  } };
}

/** @param {object} wrapper - Actual DOM wrapper. @returns {object} Its runtime implementation for reentrant behavioral fixtures. */
function implementation(wrapper) {
  return wrapper[Object.getOwnPropertySymbols(wrapper).find((symbol) => symbol.description === 'impl')];
}

try {
  const beforeLoad = workerData.mutation.startsWith('symbol-');
  if (beforeLoad) installMutation();
  if (workerData.surface === 'xml') {
    const serialize = workerData.engine === 'jsdom' ? require('w3c-xmlserializer') : require(nativePath).serializeXml;
    if (!beforeLoad) installMutation();
    for (const location of ['children', 'attributes']) {
      for (const [index, value] of values.entries()) {
        const trace = [];
        const root = location === 'children' ? { nodeType: 11, childNodes: iterable(value, trace) } : {
          nodeType: 1, namespaceURI: null, prefix: null, localName: 'root', attributes: iterable(value, trace), childNodes: [],
        };
        observed.cases.push({ location, index, ...capture(() => serialize(root, false)), trace });
      }
    }
    if (workerData.engine === 'rustdom') {
      const { live, references, cleanupErrors, created } = require(nativePath).xmlSerializationStatistics();
      observed.nativeCalls = created;
      observed.nativeReleased = live === 0 && references === 0 && cleanupErrors === 0;
    }
  } else {
    const runtime = require(workerData.engine === 'jsdom' ? 'jsdom' : runtimePath);
    const fixtures = ['default', 'vm'].map((mode) => {
      const dom = new runtime.JSDOM('<form><select name="field"><option selected>value</option></select></form>',
        mode === 'vm' ? { runScripts: 'outside-only' } : {});
      windows.push(dom.window);
      const form = dom.window.document.querySelector('form');
      const formImpl = implementation(form);
      const select = implementation(form.querySelector('select'));
      return { mode, window: dom.window, form, formImpl, select, controls: formImpl._getSubmittableElementNodes };
    });
    if (!beforeLoad) installMutation();
    for (const { mode, window, form, formImpl, select, controls } of fixtures) {
      for (const location of ['controls', 'options']) {
        formImpl._getSubmittableElementNodes = controls;
        for (const [index, value] of values.entries()) {
          const trace = [];
          const invalid = iterable(value, trace);
          if (location === 'controls') formImpl._getSubmittableElementNodes = () => invalid;
          else Object.defineProperty(select, 'options', { configurable: true, get() { return invalid; } });
          observed.cases.push({ mode, location, index, ...capture(() => new window.FormData(form), window), trace });
        }
      }
    }
    if (workerData.engine === 'rustdom') {
      const { active, builds } = require(nativePath).formDataConstructionStatistics();
      observed.nativeReleased = active === 0; observed.nativeCalls = builds;
    }
  }
} catch (error) {
  observed.loadError = describe(error);
} finally {
  restoreMutation();
  for (const window of windows) window.close();
}
parentPort.postMessage(observed);