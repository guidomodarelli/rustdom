/** @file Proves active-name ownership and release of cached host names, values, views and foreign realms. */
'use strict';
const assert = require('node:assert/strict');
const { writeFileSync, mkdirSync } = require('node:fs');
const runtime = require('../../dist/index.cjs');
const native = require('../../dist/native.cjs');
const { collectGarbage, captureMemoryState, waitForMemoryQuiescence } = require('../../scripts/memory-endpoint.cjs');
const NAMES_PER_CYCLE = 500, CYCLES = 6;
/** @param {object} wrapper - Real wrapper. @returns {object} Existing serializer projection owner. */
function implementation(wrapper) { return wrapper[Object.getOwnPropertySymbols(wrapper).find((key) => key.description === 'impl')]; }

/** @param {Window} parent - Retained form's realm. @param {FormData} data - Actual public form. @param {number} cycle - Realm mode. @returns {object} Weak owners and an intentionally retained serializer view. */
function fill(parent, data, cycle) {
  const foreign = new runtime.JSDOM('<p>foreign owner</p>', cycle % 2 ? { runScripts: 'outside-only' } : {});
  const window = foreign.window, document = window.document;
  const owners = { windows: [new WeakRef(window)], documents: [new WeakRef(document)], names: [], values: [] };
  const descriptor = Object.getOwnPropertyDescriptor(parent, 'String');
  let name, value;
  try {
    parent.String = (input) => ({ toWellFormed() { return input === 'key' ? name : value; } });
    for (let index = 0; index < NAMES_PER_CYCLE; index++) {
      name = index % 2 ? function namedOwner() { return window; } : { window };
      value = index % 2 ? { document } : function valueOwner() { return document; };
      data.append('key', 'value');
      owners.names.push(new WeakRef(name)); owners.values.push(new WeakRef(value));
    }
  } finally { Object.defineProperty(parent, 'String', descriptor); foreign.window.close(); }
  return { owners, view: implementation(data)._entries };
}

/** @param {Window} parent - Actual WebIDL conversion realm. @param {FormData} data - Retained form. @param {object} observed - Weak active names. @returns {void} Release each name through the public API without keeping a final local owner. */
function remove(parent, data, observed) {
  const descriptor = Object.getOwnPropertyDescriptor(parent, 'String');
  let selected;
  try {
    parent.String = () => ({ toWellFormed: () => selected });
    for (const reference of observed.names) {
      selected = reference.deref(); assert.notEqual(selected, undefined);
      data.delete('key');
    }
  } finally { Object.defineProperty(parent, 'String', descriptor); }
}

/** @returns {Promise<void>} Observe separate weak Window/Document targets and native/host capacity after repeated churn. */
async function main() {
  const report = { capturedAt: new Date().toISOString(), node: process.version, namesPerCycle: NAMES_PER_CYCLE, cycles: [], pass: false };
  let parent; let data;
  try {
    await collectGarbage(); const initial = native.NativeFormDataEntries.statistics();
    parent = new runtime.JSDOM('<p>retained parent</p>');
    data = new parent.window.FormData(); data.append('keep', 'kept');
    const baseline = native.NativeFormDataEntries.statistics();
    for (let cycle = -1; cycle < CYCLES; cycle++) {
      const sample = fill(parent.window, data, cycle + 1);
      await collectGarbage();
      assert.deepEqual(captureMemoryState(sample.owners, null).survivors, { windows: 1, documents: 1, names: NAMES_PER_CYCLE, values: NAMES_PER_CYCLE });
      remove(parent.window, data, sample.owners);
      assert.equal(data.get('keep'), 'kept');
      await collectGarbage();
      // An externally retained serializer view legitimately owns removed entries until released.
      assert.equal(sample.owners.windows[0].deref() !== undefined, true);
      sample.view = null;
      const endpoint = await waitForMemoryQuiescence({ label: cycle < 0 ? 'warmup' : `host-values-${cycle}`, sample: () => captureMemoryState(sample.owners, null) });
      assert.equal(endpoint.reached, true, JSON.stringify(endpoint.state));
      const entries = native.NativeFormDataEntries.statistics();
      assert.equal(entries.live, baseline.live); assert.equal(entries.entries, baseline.entries);
      assert.equal(entries.textUnits, baseline.textUnits); assert.equal(entries.nameCapacity, baseline.nameCapacity);
      assert.ok(entries.capacity <= 32);
      assert.equal(implementation(data)._hostNames, null);
      if (cycle < 0) report.warmup = endpoint; else report.cycles.push({ ...endpoint, entries });
    }
    const closed = { windows: [new WeakRef(parent.window)], documents: [new WeakRef(parent.window.document)], forms: [new WeakRef(data)] };
    data = null; parent.window.close(); parent = null;
    const teardown = await waitForMemoryQuiescence({ label: 'complete-teardown', sample: () => captureMemoryState(closed, null) });
    assert.equal(teardown.reached, true); report.teardown = teardown;
    const final = native.NativeFormDataEntries.statistics();
    for (const key of ['live', 'entries', 'textUnits', 'capacity', 'nameCapacity']) assert.equal(final[key], initial[key], key);
    report.pass = true;
  } catch (error) { report.error = error.stack; process.exitCode = 1; }
  finally { parent?.window.close(); }
  mkdirSync('reports/memory/formdata-host-values', { recursive: true });
  const path = `reports/memory/formdata-host-values/${report.capturedAt.replaceAll(':', '-')}-${process.version}.json`;
  writeFileSync(path, JSON.stringify(report, null, 2) + '\n');
  process.stdout.write(JSON.stringify({ path, pass: report.pass, cycles: report.cycles.length, error: report.error }) + '\n');
}
main().catch((error) => { process.stderr.write(error.stack + '\n'); process.exitCode = 1; });
