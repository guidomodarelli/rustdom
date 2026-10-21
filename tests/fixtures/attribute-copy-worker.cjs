/** @file Real worker teardown finalizes snapshots that remain strongly reachable at environment shutdown. */
'use strict';
const { workerData, parentPort } = require('node:worker_threads');
const native = require(workerData.nativeModule);
const { ATTRIBUTE_COPY_LARGE_VALUE_UNITS, ATTRIBUTE_COPY_WORKER_SNAPSHOTS } = require('../../scripts/constants/attribute-copy-memory.cjs');
globalThis.attributeCopySource = new native.NativeTree();
const source = globalThis.attributeCopySource.allocate();
globalThis.attributeCopySource.initializePlainAttribute(source, 'id', 'L'.repeat(ATTRIBUTE_COPY_LARGE_VALUE_UNITS));
globalThis.attributeCopies = Array.from({ length: ATTRIBUTE_COPY_WORKER_SNAPSHOTS }, () =>
  native.NativeAttributeCopy.prepare(globalThis.attributeCopySource, source));
parentPort.postMessage(native.attributeCopyStatistics());
parentPort.close();
