/** @file Loads the real addon without Array iteration and exercises caller-owned XML iterables. */
'use strict';
const { parentPort, workerData } = require('node:worker_threads');
const reference = require('w3c-xmlserializer');
const { resolve } = require('node:path');
const intrinsicSymbol = Symbol;
const iteratorKey = Symbol.iterator;
const arrayPrototype = Array.prototype;
const generatorPrototype = Object.getPrototypeOf(Object.getPrototypeOf((function* () {})()));
const iteratorPrototype = Object.getPrototypeOf(generatorPrototype);
const arrayDescriptor = Object.getOwnPropertyDescriptor(arrayPrototype, iteratorKey);
const iteratorDescriptor = Object.getOwnPropertyDescriptor(iteratorPrototype, iteratorKey);
const symbolConstructor = Object.getOwnPropertyDescriptor(Symbol.prototype, 'constructor');
const symbolToString = Object.getOwnPropertyDescriptor(Symbol.prototype, 'toString');
const globalSymbol = Object.getOwnPropertyDescriptor(globalThis, 'Symbol');
const globalString = Object.getOwnPropertyDescriptor(globalThis, 'String');
const globalArray = Object.getOwnPropertyDescriptor(globalThis, 'Array');
const globalFunction = Object.getOwnPropertyDescriptor(globalThis, 'Function');
const arrayValues = Object.getOwnPropertyDescriptor(arrayPrototype, 'values');
const builtinLoader = Object.getOwnPropertyDescriptor(process, 'getBuiltinModule');
const inheritedSymbol = Object.getOwnPropertyDescriptor(Object.prototype, 'Symbol');
const decoy = Symbol('Symbol.iterator');
const markerCause = {};
const marker = new Error('iterator body', { cause: markerCause });
const output = { reads: 0, cases: [] };

/** @param {Array} values - Fixture storage accessed by index only. @param {string[]} trace - Observed iterator calls. @returns {object} Own iterable independent of Array/Iterator prototypes. */
function collection(values, trace) {
  return { [iteratorKey]() {
    trace.push('iterator'); let index = 0;
    return { next() { trace.push('next'); return index < values.length ? { done: false, value: values[index++] } : { done: true }; },
      return() { trace.push('return'); throw new Error('secondary close'); } };
  } };
}

/** @returns {never} Detect accidental prototype/global observations during initialization or serialization. */
function forbiddenRead() { output.reads++; throw new Error('unexpected intrinsic property read'); }

/** @param {Function} serialize - Real engine entry point. @param {number} cycle - Addon reload index. @returns {void} Exercise actual iteration, diagnostics and exceptional closing. */
function exercise(serialize, cycle) {
  for (let scenario = 0; scenario < 4; scenario++) {
    const trace = [];
    const leaf = scenario === 2 ? { get nodeType() { throw marker; } } : { nodeType: 3, data: '<ready>' };
    let children = collection(scenario === 3 ? [] : [leaf], trace);
    if (scenario === 1) children = { [iteratorKey]() { trace.push('iterator'); return {
      next() { trace.push('next'); return iteratorKey; }, return() { trace.push('return'); return {}; },
    }; } };
    const root = scenario === 3 ? { nodeType: 1, localName: 'r', prefix: null, namespaceURI: null,
      attributes: collection([{ namespaceURI: null, prefix: null, localName: 'a', value: '1' }], trace), childNodes: children } :
      { nodeType: 11, childNodes: children };
    try { output.cases.push({ cycle, scenario, value: serialize(root, false), trace }); }
    catch (error) { output.cases.push({ cycle, scenario, name: error?.name, message: error?.message,
      hostTypeError: error instanceof TypeError, sameMarker: error === marker, sameCause: error?.cause === markerCause, trace }); }
  }
}

try {
  const mutation = workerData.mutation;
  const keepArray = ['iterator-deleted', 'generator-chain-null', 'builtin-loader-getter'].includes(mutation);
  const removeIterator = ['iterator-deleted', 'both-iterators-deleted', 'both-deleted-globals', 'both-deleted-poisoned-host-prototype', 'both-deleted-builtin-loader-getter', 'all-sources-removed'].includes(mutation);
  const severGenerator = ['generator-chain-null', 'array-deleted-generator-chain-null', 'chain-null-globals', 'chain-null-builtin-loader-getter', 'all-sources-removed'].includes(mutation);
  const removeGlobals = ['combined-globals', 'both-deleted-globals', 'chain-null-globals', 'both-deleted-poisoned-host-prototype', 'both-deleted-builtin-loader-getter', 'all-sources-removed'].includes(mutation);
  if (mutation === 'array-getter') Object.defineProperty(arrayPrototype, iteratorKey, { configurable: true, get: forbiddenRead });
  else if (!keepArray) delete arrayPrototype[iteratorKey];
  if (removeIterator) delete iteratorPrototype[iteratorKey];
  if (severGenerator) Object.setPrototypeOf(generatorPrototype, null);
  if (mutation === 'all-sources-removed') { delete arrayPrototype.values; globalThis.Function = undefined; }
  if (removeGlobals) {
    Object.defineProperty(intrinsicSymbol.prototype, 'constructor', { configurable: true, get: forbiddenRead });
    Object.defineProperty(intrinsicSymbol.prototype, 'toString', { configurable: true, get: forbiddenRead });
    globalThis.Symbol = undefined; globalThis.String = undefined; globalThis.Array = undefined;
  }
  if (mutation === 'both-deleted-poisoned-host-prototype') Object.defineProperty(Object.prototype, 'Symbol', { configurable: true, get: forbiddenRead });
  if (mutation === 'builtin-loader-getter' || mutation === 'array-deleted-builtin-loader-getter' || mutation === 'both-deleted-builtin-loader-getter' || mutation === 'chain-null-builtin-loader-getter' || mutation === 'all-sources-removed') {
    Object.defineProperty(process, 'getBuiltinModule', { configurable: true, get: forbiddenRead });
  }
  if (mutation === 'iterator-getter') Object.defineProperty(iteratorPrototype, iteratorKey, { configurable: true, get: forbiddenRead });
  if (mutation === 'iterator-decoy') {
    delete iteratorPrototype[iteratorKey];
    Object.defineProperty(iteratorPrototype, decoy, { configurable: true, get: forbiddenRead });
    Object.defineProperty(iteratorPrototype, iteratorKey, iteratorDescriptor);
  }
  for (let cycle = 0; cycle < 4; cycle++) {
    if (workerData.engine === 'rustdom') {
      delete require.cache[workerData.addonPath];
      const native = require(workerData.addonPath);
      exercise(native.serializeXml, cycle);
      const statistics = native.xmlSerializationStatistics();
      output.nativeCalls = statistics.created;
      output.nativeReleased = statistics.live === 0 && statistics.references === 0 && statistics.cleanupErrors === 0;
    } else exercise(reference, cycle);
  }
} catch (error) {
  output.loadError = { name: error?.name, message: error?.message };
} finally {
  Object.setPrototypeOf(generatorPrototype, iteratorPrototype);
  Object.defineProperty(arrayPrototype, iteratorKey, arrayDescriptor);
  Object.defineProperty(iteratorPrototype, iteratorKey, iteratorDescriptor);
  delete iteratorPrototype[decoy];
  Object.defineProperty(intrinsicSymbol.prototype, 'constructor', symbolConstructor);
  Object.defineProperty(intrinsicSymbol.prototype, 'toString', symbolToString);
  Object.defineProperty(globalThis, 'Symbol', globalSymbol);
  Object.defineProperty(globalThis, 'String', globalString);
  Object.defineProperty(globalThis, 'Array', globalArray);
  Object.defineProperty(globalThis, 'Function', globalFunction);
  Object.defineProperty(arrayPrototype, 'values', arrayValues);
  Object.defineProperty(process, 'getBuiltinModule', builtinLoader);
  if (inheritedSymbol) Object.defineProperty(Object.prototype, 'Symbol', inheritedSymbol);
  else delete Object.prototype.Symbol;
}
if (workerData.publicRuntime && !output.loadError) {
  let dom;
  try {
    const native = workerData.engine === 'rustdom' ? require(workerData.addonPath) : null;
    const before = native?.xmlSerializationStatistics().created;
    const runtime = require(workerData.engine === 'rustdom' ? resolve(workerData.runtimeDirectory, 'index.cjs') : 'jsdom');
    dom = new runtime.JSDOM('<root><value>ready</value></root>', { contentType: 'text/xml' });
    output.publicValue = new dom.window.XMLSerializer().serializeToString(dom.window.document.documentElement);
    if (native) output.publicNativeCalls = native.xmlSerializationStatistics().created - before;
  } catch (error) { output.publicError = { name: error?.name, message: error?.message }; }
  finally { dom?.window.close(); }
}
parentPort.postMessage(output);