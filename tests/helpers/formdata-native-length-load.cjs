/** @file Compares actual runtime initialization after equivalent dependency preload and host constructor mutation. */
'use strict';
const { resolve } = require('node:path');
const [engine, preparation, mutation, mode = 'default', runtimeDirectory = 'dist'] = process.argv.slice(2);
const before = Object.getOwnPropertyDescriptor(globalThis, 'Float64Array');
const marker = new Error('Float64Array prototype hook');
const observed = { engine, preparation, mutation, mode, globalReads: 0, prototypeReads: 0, constructorCalls: 0 };
let dom;
if (preparation === 'preloaded') require('webidl-conversions');
try {
  if (mutation === 'undefined') globalThis.Float64Array = undefined;
  else if (mutation === 'null') globalThis.Float64Array = null;
  else if (mutation === 'replacement') globalThis.Float64Array = function replacement() { observed.constructorCalls++; throw marker; };
  else if (mutation === 'prototype-hook') globalThis.Float64Array = new Proxy(function replacement() {}, {
    get(target, key, receiver) { if (key === 'prototype') { observed.prototypeReads++; throw marker; } return Reflect.get(target, key, receiver); },
  });
  else if (mutation === 'global-getter') Object.defineProperty(globalThis, 'Float64Array', { configurable: true, get() { observed.globalReads++; throw marker; } });
  const runtime = require(engine === 'jsdom' ? 'jsdom' : resolve(runtimeDirectory, 'index.cjs'));
  dom = new runtime.JSDOM('<form><input name="key" value="first"><input name="key" value="second"></form>', mode === 'vm' ? { runScripts: 'outside-only' } : {});
  const data = new dom.window.FormData(dom.window.document.querySelector('form'));
  observed.initial = data.getAll('key');
  const impl = data[Object.getOwnPropertySymbols(data).find((key) => key.description === 'impl')];
  observed.view = impl._entries.map((entry) => [entry.name, entry.value]);
  data.set('key', 'changed'); data.append('tail', 'value'); data.delete('key');
  observed.entries = Array.from(data);
  observed.pass = true;
} catch (error) {
  observed.pass = false; observed.error = { name: error.name, message: error.message, marker: error === marker };
  observed.errorStack = error.stack;
} finally { Object.defineProperty(globalThis, 'Float64Array', before); dom?.window.close(); }
process.stdout.write(JSON.stringify(observed) + '\n');
