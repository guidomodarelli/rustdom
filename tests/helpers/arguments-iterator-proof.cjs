/** @file Standalone language-level evidence for the intrinsic own iterator of strict arguments. */
'use strict';
const key = Symbol.iterator;
const ownKeys = Reflect.ownKeys;
const getDescriptor = Object.getOwnPropertyDescriptor;
const array = Array.prototype;
const generator = Object.getPrototypeOf(Object.getPrototypeOf((function* () {})()));
const iterator = Object.getPrototypeOf(generator);
const arrayKey = getDescriptor(array, key);
const iteratorKey = getDescriptor(iterator, key);
const values = getDescriptor(array, 'values');
const builtin = getDescriptor(process, 'getBuiltinModule');
const globals = { Symbol, Array, String, Function };
let output;
try {
  delete array[key]; delete iterator[key]; delete array.values;
  Object.setPrototypeOf(generator, null);
  Object.defineProperty(process, 'getBuiltinModule', { configurable: true, get() { throw new Error('hook must not be read'); } });
  globalThis.Symbol = undefined; globalThis.Array = undefined; globalThis.String = undefined; globalThis.Function = undefined;
  const created = (function () { 'use strict'; return arguments; })();
  const keys = ownKeys(created);
  let found = false;
  for (let index = 0; index < keys.length; index++) if (keys[index] === key) found = true;
  output = { node: process.version, found, ownIterator: getDescriptor(created, key) !== undefined,
    iteratorValueType: typeof getDescriptor(created, key)?.value };
} finally {
  Object.setPrototypeOf(generator, iterator);
  Object.defineProperty(array, key, arrayKey); Object.defineProperty(iterator, key, iteratorKey);
  Object.defineProperty(array, 'values', values);
  Object.defineProperty(process, 'getBuiltinModule', builtin);
  globalThis.Symbol = globals.Symbol; globalThis.Array = globals.Array; globalThis.String = globals.String; globalThis.Function = globals.Function;
}
process.stdout.write(JSON.stringify(output)+'\n');