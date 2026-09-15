/** @file Verifies that completed workers release their actual N-API constructor references. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Worker } = require('node:worker_threads');
const { resolve } = require('node:path');
const { classReferenceStatistics } = require('../dist/native.cjs');

/** @param {boolean} reload - Repeat native registration in the same env. @returns {Promise<object>} Result after complete environment teardown. */
function runWorker(reload) {
  return new Promise((resolveResult, reject) => {
    const worker = new Worker(resolve(__dirname, 'helpers/napi-class-worker.cjs'), { workerData: { reload } }); let result;
    worker.once('message', (message) => { result = message; }); worker.once('error', reject);
    worker.once('exit', (code) => code === 0 ? resolveResult(result) : reject(new Error(`Native class worker exited with ${code}`)));
  });
}

test('should release constructor references after repeated real worker teardown', async () => {
  const baseline = classReferenceStatistics(); assert.ok(baseline.live > 0);
  for (let cycle = 0; cycle < 8; cycle++) {
    const result = await runWorker(cycle % 2 === 1); assert.equal(result.markup, '<div id="worker"></div>'); assert.equal(result.type, 'text/plain');
    assert.ok(result.stats.created > baseline.created);
    const after = classReferenceStatistics(); assert.equal(after.live, baseline.live); assert.equal(after.cleanupErrors, baseline.cleanupErrors);
    assert.ok(after.released > baseline.released);
  }
});
