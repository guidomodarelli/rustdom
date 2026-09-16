/** @file Records equivalent cold/warm loads without using assertions while host iteration is removed. */
'use strict';
const { parentPort, workerData } = require('node:worker_threads');
const { resolve } = require('node:path');
const key = Symbol.iterator;
const arrayPrototype = Array.prototype;
const iteratorPrototype = Object.getPrototypeOf(Object.getPrototypeOf(Object.getPrototypeOf((function* () {})())));
const arrayDescriptor = Object.getOwnPropertyDescriptor(arrayPrototype, key);
const iteratorDescriptor = Object.getOwnPropertyDescriptor(iteratorPrototype, key);
const loaderDescriptor = Object.getOwnPropertyDescriptor(process, 'getBuiltinModule');
const hookError = new Error('getBuiltinModule hook was observed');
const output = { node: process.version, target: workerData.target, mode: workerData.mode, hookReads: 0, phase: 'setup' };
let dom, native, operation;

/** @param {object} child - Actual or duck-typed text node. @returns {object} Own iterable without shared iterator prototypes. */
function children(child) {
  return { [key]() { let done = false; return { next() { if (done) return { done: true }; done = true; return { done: false, value: child }; } }; } };
}

/** @returns {void} Load the selected real entry point and prepare its actual operation. */
function load() {
  output.phase = 'load';
  const { target, runtimeDirectory } = workerData;
  if (target === 'serializer') {
    const serialize = require('w3c-xmlserializer');
    operation = () => serialize({ nodeType: 11, childNodes: children({ nodeType: 3, data: 'ready' }) }, false);
  } else if (target === 'native' || target === 'addon') {
    native = require(resolve(runtimeDirectory, target === 'native' ? 'native.cjs' : 'rustdom.node'));
    operation = () => native.serializeXml({ nodeType: 11, childNodes: children({ nodeType: 3, data: 'ready' }) }, false);
  } else {
    const runtime = require(target === 'jsdom' ? 'jsdom' : resolve(runtimeDirectory, 'index.cjs'));
    output.phase = 'construct';
    dom = new runtime.JSDOM('');
    const fragment = dom.window.document.createDocumentFragment();
    const child = dom.window.document.createTextNode('ready');
    Object.defineProperty(fragment, 'childNodes', { configurable: true, get() { return children(child); } });
    const serializer = new dom.window.XMLSerializer();
    operation = () => serializer.serializeToString(fragment);
  }
}

try {
  if (workerData.mode === 'warm') load();
  delete arrayPrototype[key]; delete iteratorPrototype[key];
  Object.defineProperty(process, 'getBuiltinModule', { configurable: true, get() { output.hookReads++; throw hookError; } });
  if (workerData.mode === 'cold') load();
  output.phase = 'serialize';
  output.value = operation();
  output.phase = 'complete';
  if (native) output.nativeCalls = native.xmlSerializationStatistics().created;
} catch (error) { output.error = { name: error?.name, message: error?.message, sameHookError: error === hookError }; }
finally {
  Object.defineProperty(arrayPrototype, key, arrayDescriptor);
  Object.defineProperty(iteratorPrototype, key, iteratorDescriptor);
  Object.defineProperty(process, 'getBuiltinModule', loaderDescriptor);
  dom?.window.close();
}
parentPort.postMessage(output);