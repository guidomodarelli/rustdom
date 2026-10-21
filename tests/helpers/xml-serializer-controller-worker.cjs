/** @file Blocks inside an actual message getter reached by the native XMLSerializer catch body. */
'use strict';
const { parentPort, workerData } = require('node:worker_threads');
const runtime = require('../../dist/index.cjs');
const dom = new runtime.JSDOM('<root/>', { contentType: 'text/xml', ...(workerData.realm === 'default' ? {} : { runScripts: workerData.realm }) });
const blocked = new Int32Array(new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT));
const failure = { node: dom.window.document.documentElement, get message() {
  parentPort.postMessage('inside-message-getter');
  Atomics.wait(blocked, 0, 0);
  return 'unreachable before termination';
} };
Object.defineProperty(dom.window.document.documentElement, 'nodeType', { get() { throw failure; } });
new dom.window.XMLSerializer().serializeToString(dom.window.document.documentElement);
