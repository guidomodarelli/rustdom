/** @file Exercises real worker termination while Rust owns an active XMLSerializer exception scope. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Worker } = require('node:worker_threads');
const { resolve } = require('node:path');
const runtime = require('../dist/index.cjs');
const { XML_SERIALIZER_WORKER_CYCLES, XML_SERIALIZER_WORKER_TIMEOUT_MS,
  XML_SERIALIZER_MEMORY_REALMS } = require('../scripts/constants/xml-serializer-controller-memory.cjs');

/** @param {Worker} worker - Real active worker. @param {number} cycle - Diagnostic cycle. @returns {Promise<unknown>} First message, with all listeners removed on completion or failure. */
function entered(worker, cycle) {
  return new Promise((resolveMessage, reject) => {
    const cleanup = () => { clearTimeout(timer); worker.off('message', onMessage); worker.off('error', onError); worker.off('exit', onExit); };
    const onMessage = (value) => { cleanup(); resolveMessage(value); };
    const onError = (error) => { cleanup(); reject(error); };
    const onExit = (code) => { cleanup(); reject(new Error(`XMLSerializer worker ${cycle} exited before its message getter, code=${code}`)); };
    const timer = setTimeout(() => { cleanup(); reject(new Error(`XMLSerializer worker ${cycle} did not reach its message getter`)); }, XML_SERIALIZER_WORKER_TIMEOUT_MS);
    worker.once('message', onMessage); worker.once('error', onError); worker.once('exit', onExit);
  });
}

test('should release every active native controller scope when its worker terminates during message lookup',
  { timeout: XML_SERIALIZER_WORKER_TIMEOUT_MS * XML_SERIALIZER_WORKER_CYCLES }, async () => {
    const baseline = runtime.getNativeTreeStatistics();
    for (let cycle = 0; cycle < XML_SERIALIZER_WORKER_CYCLES; cycle++) {
      const worker = new Worker(resolve(__dirname, 'helpers/xml-serializer-controller-worker.cjs'), {
        workerData: { realm: XML_SERIALIZER_MEMORY_REALMS[cycle % XML_SERIALIZER_MEMORY_REALMS.length] },
      });
      try {
        assert.equal(await entered(worker, cycle), 'inside-message-getter');
        assert.equal(runtime.getNativeTreeStatistics().xmlSerializerOperations.active, baseline.xmlSerializerOperations.active + 1);
      } finally { await worker.terminate(); }
      const released = runtime.getNativeTreeStatistics();
      assert.equal(released.xmlSerializerOperations.active, baseline.xmlSerializerOperations.active);
      assert.equal(released.xmlSerialization.references, baseline.xmlSerialization.references);
      assert.equal(released.xmlSerialization.cleanupErrors, baseline.xmlSerialization.cleanupErrors);
      assert.equal(released.napiClasses.live, baseline.napiClasses.live);
    }
  });
