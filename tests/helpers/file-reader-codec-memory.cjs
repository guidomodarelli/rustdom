/** @file Exercises borrowed FileReader bytes and scalar ownership through the actual addon under GC/Memcheck. */
'use strict';
const assert = require('node:assert/strict');
const native = require('../../dist/native.cjs');
const mode = process.argv[2] ?? 'native';
const cycles = Number(process.argv[3] ?? 100);
assert.ok(mode === 'native' || mode === 'control');
assert.ok(Number.isSafeInteger(cycles) && cycles > 0);
assert.equal(typeof global.gc, 'function');

/** @param {number} cycle - Repeated creation/conversion cycle. @returns {void} Check contents and unsupported backing without retaining native state. */
function checkCycle(cycle) {
  const bytes = Buffer.alloc(4096, cycle % 256);
  const view = bytes.subarray(1, bytes.length - 1);
  const binary = mode === 'native' ? native.fileReaderString(view, native.ReaderStringFormat.BinaryString) : view.toString('latin1');
  const text = mode === 'native' ? native.fileReaderString(view, native.ReaderStringFormat.Text, 'utf-8') : view.toString('utf8');
  const dataUrl = mode === 'native' ? native.fileReaderString(view, native.ReaderStringFormat.DataUrl, undefined, 'text/plain') : `data:text/plain;base64,${view.toString('base64')}`;
  assert.equal(binary, view.toString('latin1')); assert.equal(text, view.toString('utf8'));
  assert.equal(dataUrl, `data:text/plain;base64,${view.toString('base64')}`);
  bytes.fill(255); assert.equal(binary.charCodeAt(0), cycle % 256);
  if (mode === 'native') {
    const state = new native.NativeFileReaderState(); assert.equal(state.begin(), true); assert.equal(state.abort(), true);
    assert.equal(state.enterStage(), false); assert.equal(state.enterStage(), true); state.finish();
    assert.equal(state.readyState, 2);
    assert.equal(native.fileReaderString(Buffer.alloc(0), native.ReaderStringFormat.Text), '');
    assert.equal(native.fileReaderString(Buffer.from(new SharedArrayBuffer(8)), native.ReaderStringFormat.Text), null);
    const backing = new ArrayBuffer(8); const detached = Buffer.from(backing);
    structuredClone(backing, { transfer: [backing] });
    assert.equal(native.fileReaderString(detached, native.ReaderStringFormat.Text), null);
  }
}

/** @returns {Promise<void>} Drain finalizers in separate turns and verify the native live count returns to baseline. */
async function main() {
  const baseline = native.NativeFileReaderState.statistics();
  for (let cycle = 0; cycle < cycles; cycle++) {
    checkCycle(cycle); global.gc(); await new Promise((resolve) => setImmediate(resolve));
  }
  for (let turn = 0; turn < 8; turn++) { global.gc(); await new Promise((resolve) => setImmediate(resolve)); }
  const after = native.NativeFileReaderState.statistics();
  assert.equal(after.live, baseline.live);
  assert.equal(after.created - baseline.created, mode === 'native' ? cycles : 0);
  assert.equal(after.released - baseline.released, mode === 'native' ? cycles : 0);
  assert.equal(native.classReferenceStatistics().cleanupErrors, 0);
  process.stdout.write(`${JSON.stringify({ mode, cycles, pass: true, baseline, after, references: native.classReferenceStatistics() })}\n`);
}
main().catch((error) => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
