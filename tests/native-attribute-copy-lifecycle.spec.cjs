/** @file External-memory hints and snapshot storage must balance when actual Node workers exit. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { Worker } = require('node:worker_threads');
const native = require('../dist/native.cjs');
const { ATTRIBUTE_COPY_WORKER_SNAPSHOTS, ATTRIBUTE_COPY_LARGE_VALUE_UNITS,
  ATTRIBUTE_COPY_INTERRUPTED_WORKER_CYCLES } = require('../scripts/constants/attribute-copy-memory.cjs');
test('should finalize live snapshots and their external memory on repeated real worker shutdown', async () => {
  const baseline = native.attributeCopyStatistics();
  for (let index = 0; index < 4; index += 1) {
    const worker = new Worker(require.resolve('./fixtures/attribute-copy-worker.cjs'), {
      execArgv: [], workerData: { nativeModule: require.resolve('../dist/native.cjs') } });
    const [[held], [exitCode]] = await Promise.all([once(worker, 'message'), once(worker, 'exit')]);
    assert.equal(exitCode, 0);
    assert.ok(held.live >= ATTRIBUTE_COPY_WORKER_SNAPSHOTS);
    assert.ok(held.accountedBytes >= ATTRIBUTE_COPY_WORKER_SNAPSHOTS * ATTRIBUTE_COPY_LARGE_VALUE_UNITS);
    assert.equal(held.liveBytes, held.accountedBytes);
    assert.equal(held.accountingErrors, baseline.accountingErrors);
    const released = native.attributeCopyStatistics();
    assert.equal(released.live, baseline.live);
    assert.equal(released.liveBytes, baseline.liveBytes);
    assert.equal(released.accountedBytes, baseline.accountedBytes);
    assert.equal(released.accountingErrors, baseline.accountingErrors);
  }
});

test('should release prepared native payloads when workers terminate during class construction', async () => {
  const baseline = native.attributeCopyStatistics();
  for (let cycle = 0; cycle < ATTRIBUTE_COPY_INTERRUPTED_WORKER_CYCLES; cycle += 1) {
    const worker = new Worker(require.resolve('./fixtures/attribute-copy-interrupted-worker.cjs'), {
      execArgv: [], workerData: { nativeModule: require.resolve('../dist/native.cjs') } });
    const exited = once(worker, 'exit');
    try {
      const [ready] = await once(worker, 'message');
      assert.equal(ready, 'ready');
      const entered = once(worker, 'message');
      worker.postMessage('copy');
      assert.deepEqual(await entered, ['enter']);
      await worker.terminate();
      const [exitCode] = await exited;
      assert.ok(exitCode === 0 || exitCode === 1);
      const released = native.attributeCopyStatistics();
      assert.equal(released.live, baseline.live, `Worker cycle ${cycle} retained a native snapshot`);
      assert.equal(released.liveBytes, baseline.liveBytes);
      assert.equal(released.accountedBytes, baseline.accountedBytes);
      assert.equal(released.accountingErrors, baseline.accountingErrors);
      assert.equal(released.created - baseline.created, released.released - baseline.released);
    } finally {
      await worker.terminate();
      await exited;
    }
  }
  assert.ok(native.attributeCopyStatistics().created > baseline.created,
    'The interrupted workers must exercise actual Rust snapshot allocation');
});
