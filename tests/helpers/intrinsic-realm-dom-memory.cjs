/** @file Initialize the actual addon through a clean realm before public DOM memory scenarios. */
'use strict';
const iteratorKey = Symbol.iterator;
const arrayPrototype = Array.prototype;
const iteratorPrototype = Object.getPrototypeOf(Object.getPrototypeOf(Object.getPrototypeOf((function* () {})())));
const arrayDescriptor = Object.getOwnPropertyDescriptor(arrayPrototype, iteratorKey);
const iteratorDescriptor = Object.getOwnPropertyDescriptor(iteratorPrototype, iteratorKey);
try {
  delete arrayPrototype[iteratorKey];
  delete iteratorPrototype[iteratorKey];
  require('../../dist/native.cjs');
} finally {
  Object.defineProperty(arrayPrototype, iteratorKey, arrayDescriptor);
  Object.defineProperty(iteratorPrototype, iteratorKey, iteratorDescriptor);
}
require('./xml-serialization-memory.cjs');