/** @file A real environment can be terminated while Rust prepares owned Attr data. */
'use strict';
const { workerData, parentPort } = require('node:worker_threads');
const native = require(workerData.nativeModule);
const { ATTRIBUTE_COPY_INTERRUPTED_VALUE_UNITS } = require('../../scripts/constants/attribute-copy-memory.cjs');
const source = new native.NativeTree(), handle = source.allocate();
source.initializePlainAttribute(handle, 'id', 'L'.repeat(ATTRIBUTE_COPY_INTERRUPTED_VALUE_UNITS));
parentPort.once('message', () => {
  parentPort.postMessage('enter');
  globalThis.heldAttributeCopy = native.NativeAttributeCopy.prepare(source, handle);
  parentPort.close();
});
parentPort.postMessage('ready');
