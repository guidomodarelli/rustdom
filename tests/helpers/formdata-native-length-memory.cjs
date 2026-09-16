/** @file Observes ID buffers and temporary views after repeated native length calls. */
'use strict';
const assert = require('node:assert/strict');
const { writeFileSync, mkdirSync } = require('node:fs');
const { NativeFormDataEntries } = require('../../dist/native.cjs');
const { captureMemoryState, waitForMemoryQuiescence } = require('../../scripts/memory-endpoint.cjs');

/** @param {NativeFormDataEntries} list - Real native ID producer. @returns {object} Only weak observations leave the completed synchronous frame. */
function batch(list) {
  const arrays = [], buffers = [];
  for (let index = 0; index < 500; index++) {
    const ids = list.allIds(); const buffer = ids.buffer;
    assert.equal(NativeFormDataEntries.idArrayLength(ids), 20);
    arrays.push(new WeakRef(ids)); buffers.push(new WeakRef(buffer));
  }
  return { arrays, buffers };
}
(async () => {
  const list = new NativeFormDataEntries();
  for (let index = 0; index < 20; index++) list.append('key', 'value');
  const report = { capturedAt: new Date().toISOString(), node: process.version, cycles: [], pass: false };
  try {
    for (let cycle = -1; cycle < 6; cycle++) {
      const observed = batch(list);
      const endpoint = await waitForMemoryQuiescence({ label: cycle < 0 ? 'warmup' : `native-length-${cycle}`, sample: () => captureMemoryState(observed, null) });
      assert.equal(endpoint.reached, true, JSON.stringify(endpoint.state));
      if (cycle < 0) report.warmup = endpoint; else report.cycles.push(endpoint);
    }
    report.pass = true;
  } catch (error) { report.error = error.stack; process.exitCode = 1; }
  mkdirSync('reports/memory/formdata-native-length', { recursive: true });
  const path = `reports/memory/formdata-native-length/${report.capturedAt.replaceAll(':', '-')}-${process.version}.json`;
  writeFileSync(path, JSON.stringify(report, null, 2) + '\n');
  process.stdout.write(JSON.stringify({ path, pass: report.pass, cycles: report.cycles.length, error: report.error }) + '\n');
})().catch((error) => { process.stderr.write(error.stack + '\n'); process.exitCode = 1; });
