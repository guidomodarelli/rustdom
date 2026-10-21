/** Read-only isolated probe of real snapshot construction interrupted by worker termination. */
'use strict';
const { Worker } = require('node:worker_threads');
const nativeModule = process.argv[2] || '/home/guido/rustdom-attribute-copy-zCfwmZ/dist/native.cjs';
const units = Number(process.argv[3] || 16777216);
const native = require(nativeModule);
const descriptor = Object.getOwnPropertyDescriptor(native.NativeAttributeCopy, 'prototype');
console.log(JSON.stringify({ stage: 'baseline', node: process.version, units,
  prototypeDescriptor: { writable: descriptor.writable, configurable: descriptor.configurable,
    enumerable: descriptor.enumerable }, snapshots: native.attributeCopyStatistics() }));
const script = `
  'use strict';
  const { parentPort, workerData } = require('node:worker_threads');
  const native = require(workerData.nativeModule);
  const source = new native.NativeTree();
  const handle = source.allocate();
  source.initializePlainAttribute(handle, 'id', 'L'.repeat(workerData.units));
  parentPort.once('message', () => {
    parentPort.postMessage({ stage: 'enter', snapshots: native.attributeCopyStatistics() });
    try {
      globalThis.snapshot = source.prepareAttributeCopy(handle);
      parentPort.postMessage({ stage: 'completed', snapshots: native.attributeCopyStatistics() });
    } catch (error) {
      parentPort.postMessage({ stage: 'failed', name: error?.name, message: error?.message,
        snapshots: native.attributeCopyStatistics() });
    }
    parentPort.close();
  });
  parentPort.postMessage({ stage: 'ready' });
`;
const worker = new Worker(script, { eval: true, workerData: { nativeModule, units },
  resourceLimits: { maxOldGenerationSizeMb: 128 } });
const events = [];
let terminationRequested = false;
const timeout = setTimeout(() => {
  events.push({ stage: 'timeout' });
  void worker.terminate();
}, 10000);
worker.on('message', (event) => {
  events.push(event);
  if (event.stage === 'ready') worker.postMessage('copy');
  if (event.stage === 'enter') {
    terminationRequested = true;
    void worker.terminate();
  }
});
worker.on('error', (error) => events.push({ stage: 'worker-error', name: error.name, message: error.message }));
worker.on('exit', async (code) => {
  clearTimeout(timeout);
  if (typeof global.gc === 'function') for (let index = 0; index < 4; index += 1) {
    await global.gc({ execution: 'async', type: 'major' });
    await new Promise(setImmediate);
  }
  setImmediate(() => {
    console.log(JSON.stringify({ stage: 'exited', exitCode: code, terminationRequested, events,
      snapshots: native.attributeCopyStatistics() }));
  });
});
