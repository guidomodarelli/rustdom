/** @file Keeps native allocation ownership balanced when real worker termination interrupts class construction. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { Worker } = require('node:worker_threads');
const nativeModule = process.env.RUSTDOM_CLASS_CONSTRUCTION_NATIVE_MODULE || require.resolve('../dist/native.cjs');
const native = require(nativeModule);
const { NATIVE_CLASS_INTERRUPTED_WORKER_CYCLES, NATIVE_CLASS_WORKER_TIMEOUT_MS,
  NATIVE_CLASS_FAILED_CONSTRUCTION_ATTEMPTS, NATIVE_CLASS_XML_PAYLOAD_UNITS,
  NATIVE_CLASS_INITIALIZATION_ERROR_MESSAGE } = require('../scripts/constants/native-class-memory.cjs');

test('should release failed native constructors and copies interrupted by real worker termination', async () => {
  const original = new native.NativeRange();
  const input = `<r>${'x'.repeat(NATIVE_CLASS_XML_PAYLOAD_UNITS)}</r>`;
  const parser = new native.NativeXmlParser(input, false);
  for (let attempt = 0; attempt < NATIVE_CLASS_FAILED_CONSTRUCTION_ATTEMPTS; attempt++) {
    const rangeBefore = native.NativeRange.statistics();
    assert.throws(() => Reflect.apply(native.NativeRange, original, []),
      { name: 'Error', message: NATIVE_CLASS_INITIALIZATION_ERROR_MESSAGE });
    const rangeAfter = native.NativeRange.statistics();
    assert.equal(rangeAfter.live, rangeBefore.live, 'A rejected wrap must destroy the new Rust range');
    assert.equal(rangeAfter.created - rangeBefore.created, 1);
    assert.equal(rangeAfter.released - rangeBefore.released, 1);
    const xmlBefore = native.NativeXmlParser.statistics();
    assert.throws(() => Reflect.apply(native.NativeXmlParser, parser, [input, false]),
      { name: 'Error', message: NATIVE_CLASS_INITIALIZATION_ERROR_MESSAGE });
    const xmlAfter = native.NativeXmlParser.statistics();
    assert.equal(xmlAfter.live, xmlBefore.live);
    assert.equal(xmlAfter.inputUnits, xmlBefore.inputUnits, 'A rejected wrap must release owned UTF-16 input');
    assert.equal(xmlAfter.created - xmlBefore.created, 1);
    assert.equal(xmlAfter.released - xmlBefore.released, 1);
  }
  const baseline = native.NativeRange.statistics();
  for (let cycle = 0; cycle < NATIVE_CLASS_INTERRUPTED_WORKER_CYCLES; cycle++) {
    const worker = new Worker(require.resolve('./fixtures/native-class-construction-worker.cjs'), {
      execArgv: [], workerData: { nativeModule } });
    const exited = once(worker, 'exit');
    try {
      const signal = AbortSignal.timeout(NATIVE_CLASS_WORKER_TIMEOUT_MS);
      assert.deepEqual(await once(worker, 'message', { signal }), ['ready']);
      const entered = once(worker, 'message', { signal });
      worker.postMessage('copy');
      assert.deepEqual(await entered, ['enter']);
      await worker.terminate();
      const [exitCode] = await exited;
      assert.ok(exitCode === 0 || exitCode === 1);
      const released = native.NativeRange.statistics();
      assert.equal(released.live, baseline.live, `NativeRange worker cycle ${cycle} retained a Rust allocation`);
      assert.equal(released.created - baseline.created, released.released - baseline.released);
    } finally { await worker.terminate(); await exited; }
  }
  assert.ok(native.NativeRange.statistics().created - baseline.created >= NATIVE_CLASS_INTERRUPTED_WORKER_CYCLES * 2,
    'Every worker must allocate its source and exercise the real class-return path');
  assert.ok(original.copy() instanceof native.NativeRange, 'The original receiver remains usable after rejected wraps');
  assert.equal(parser.next().kind, 'opentag');
});
