/** @file Exercises real native instances before a worker tears down its constructor-reference registry. */
'use strict';
const { parentPort, workerData } = require('node:worker_threads');
const { resolve } = require('node:path');
const { NativeTree, NativeBlobMetadata, classReferenceStatistics } = require('../../dist/native.cjs');
if (workerData?.reload) {
  const path = resolve(__dirname, '../../dist/rustdom.node'); delete require.cache[require.resolve(path)];
  const reloaded = require(path); const fresh = new reloaded.NativeBlobMetadata('IMAGE/PNG');
  if (fresh.mimeType !== 'image/png') throw new Error('Reloaded native constructor lost its metadata');
}
const tree = new NativeTree(); const element = tree.allocate(); tree.setHtmlElement(element, 'div', ['id', 'worker']);
const metadata = new NativeBlobMetadata('TEXT/PLAIN'); metadata.setFile('worker', 42);
parentPort.postMessage({ markup: tree.serializeHtml(element, true, false), type: metadata.mimeType, stats: classReferenceStatistics() });
tree.release(element);
