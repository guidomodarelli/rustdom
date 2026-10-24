/** @file Exercises the real integrated class-return path until its worker is terminated. */
'use strict';
const { parentPort, workerData } = require('node:worker_threads');
const native = require(workerData.nativeModule);
const { NATIVE_CLASS_WORKER_COPY_LIMIT } = require('../../scripts/constants/native-class-memory.cjs');
const source = new native.NativeRange();
parentPort.once('message', () => {
  globalThis.lastCopy = source.copy();
  parentPort.postMessage('enter');
  for (let iteration = 0; iteration < NATIVE_CLASS_WORKER_COPY_LIMIT; iteration++) globalThis.lastCopy = source.copy();
  parentPort.close();
});
parentPort.postMessage('ready');
