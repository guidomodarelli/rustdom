/** @file Initialize the actual addon with host iterator sources and loader hook blocked before DOM GC scenarios. */
'use strict';
const iteratorKey = Symbol.iterator;
const arrayPrototype = Array.prototype;
const iteratorPrototype = Object.getPrototypeOf(Object.getPrototypeOf(Object.getPrototypeOf((function* () {})())));
const arrayDescriptor = Object.getOwnPropertyDescriptor(arrayPrototype, iteratorKey);
const iteratorDescriptor = Object.getOwnPropertyDescriptor(iteratorPrototype, iteratorKey);
const builtinLoader = Object.getOwnPropertyDescriptor(process, 'getBuiltinModule');
try {
  delete arrayPrototype[iteratorKey];
  delete iteratorPrototype[iteratorKey];
  Object.defineProperty(process, 'getBuiltinModule', { configurable: true, get() { throw new Error('Builtin loader must not be read'); } });
  require('../../dist/native.cjs');
} finally {
  Object.defineProperty(process, 'getBuiltinModule', builtinLoader);
  Object.defineProperty(arrayPrototype, iteratorKey, arrayDescriptor);
  Object.defineProperty(iteratorPrototype, iteratorKey, iteratorDescriptor);
}
require('./xml-serialization-memory.cjs');