/** @file Held Rust-only snapshots must release source Windows, Documents and standalone native forests. */
'use strict';
const assert = require('node:assert/strict');
const { mkdirSync, writeFileSync, readFileSync } = require('node:fs');
const { createHash } = require('node:crypto');
const runtime = require('../dist/index.cjs');
const native = require('../dist/native.cjs');
const { domSymbolTree } = require('../dist/vendor-jsdom/lib/jsdom/living/helpers/internal-constants.js');
const { implForWrapper } = require('../dist/vendor-jsdom/lib/jsdom/living/generated/utils.js');
const { captureSourceIdentity } = require('../benchmarks/sources.cjs');
const { collectGarbage, captureMemoryState, waitForMemoryQuiescence } = require('./memory-endpoint.cjs');
const { WINDOWS_PER_BATCH, MEASURED_CYCLES } = require('./constants/collection-query-memory.cjs');
const { ATTRIBUTE_COPY_NAMESPACE, ATTRIBUTE_COPY_VALUE, ATTRIBUTE_COPY_STANDALONE_VALUE, ATTRIBUTE_COPY_LARGE_VALUE_UNITS } = require('./constants/attribute-copy-memory.cjs');

/** @returns {object} Only weak references escape fixture ownership. */
function groups() { return { windows: [], documents: [], elements: [], attributes: [], implementations: [], nativeTrees: [], snapshots: [] }; }
/** @param {string} realm - Real realm mode. @returns {object} Held snapshots and independent weak owners. */
function batch(realm) {
  const observed = groups(), held = [];
  for (let index = 0; index < WINDOWS_PER_BATCH; index += 1) {
    const { window } = new runtime.JSDOM('<!doctype html><body>', realm === 'vm' ? { runScripts: 'outside-only' } : {});
    try {
      const document = window.document, element = document.createElement('section');
      const attribute = document.createAttributeNS(ATTRIBUTE_COPY_NAMESPACE, 'p:key');
      attribute.value = ATTRIBUTE_COPY_VALUE; element.setAttributeNodeNS(attribute); document.body.append(element);
      const implementation = implForWrapper(attribute);
      const snapshot = native.NativeAttributeCopy.prepare(domSymbolTree._arena, domSymbolTree._identify(implementation));
      held.push(snapshot);
      observed.windows.push(new WeakRef(window)); observed.documents.push(new WeakRef(document));
      observed.elements.push(new WeakRef(element)); observed.attributes.push(new WeakRef(attribute));
      observed.implementations.push(new WeakRef(implementation)); observed.snapshots.push(new WeakRef(snapshot));
      attribute.value = 'source mutated after snapshot';
      const standalone = new native.NativeTree(), destination = new native.NativeTree();
      const source = standalone.allocate();
      standalone.initializeAttribute(source, JSON.stringify({ kind: 2, name: 'id', value: Array.from(
        { length: ATTRIBUTE_COPY_STANDALONE_VALUE.length }, (unusedValue, position) => ATTRIBUTE_COPY_STANDALONE_VALUE.charCodeAt(position)) }));
      const other = native.NativeAttributeCopy.prepare(standalone, source); held.push(other); observed.snapshots.push(new WeakRef(other));
      const largeSource = standalone.allocate();
      standalone.initializePlainAttribute(largeSource, 'large', 'L'.repeat(ATTRIBUTE_COPY_LARGE_VALUE_UNITS));
      const large = native.NativeAttributeCopy.prepare(standalone, largeSource); held.push(large); observed.snapshots.push(new WeakRef(large));
      const target = destination.allocate(); snapshot.initialize(destination, target);
      assert.equal(destination.attributeField(target, native.AttributeField.Value), ATTRIBUTE_COPY_VALUE);
      assert.throws(() => other.initialize(standalone, source));
      observed.nativeTrees.push(new WeakRef(standalone), new WeakRef(destination));
    } finally { window.close(); }
  }
  return { held, observed };
}
/** @param {object[]} snapshots - Held data-only objects. @returns {void} Do not keep a dereferenced snapshot across await. */
function checkHeld(snapshots) {
  for (let index = 0; index < snapshots.length; index += 3) {
    assert.deepEqual([snapshots[index].localName, snapshots[index].namespace, snapshots[index].prefix, snapshots[index].value],
      ['key', ATTRIBUTE_COPY_NAMESPACE, 'p', ATTRIBUTE_COPY_VALUE]);
    assert.deepEqual([snapshots[index + 1].localName, snapshots[index + 1].namespace, snapshots[index + 1].prefix, snapshots[index + 1].value],
      ['id', null, null, ATTRIBUTE_COPY_STANDALONE_VALUE]);
    assert.equal(snapshots[index + 2].localName, 'large');
    assert.equal(snapshots[index + 2].value, 'L'.repeat(ATTRIBUTE_COPY_LARGE_VALUE_UNITS));
  }
}
/** @returns {Promise<void>} Save held/released endpoints and exact native snapshot liveness. */
async function main() {
  assert.equal(typeof global.gc, 'function', 'Attribute snapshot memory analysis requires --expose-gc');
  const report = { capturedAt: new Date().toISOString(), node: process.version,
    sourceIdentity: captureSourceIdentity(), nativeBinarySha256: createHash('sha256').update(readFileSync('dist/rustdom.node')).digest('hex'),
    methodology: { windowsPerBatch: WINDOWS_PER_BATCH, measuredCycles: MEASURED_CYCLES, warmupCycles: 1, snapshotsPerOwner: 3,
      largeValueUnits: ATTRIBUTE_COPY_LARGE_VALUE_UNITS,
      endpoint: 'Two clear samples after asynchronous major GC. Keep all three immutable snapshots per owner alive while requiring independent Window/Document/Element/Attr/implementation and standalone native forest collection, then release snapshots and require their native counters to return to baseline.' },
    limitations: 'Finite lifetime endpoints, including warmup and deliberate retention; not independent samples, peak memory or proof of absolute absence of leaks.',
    cases: [], pass: false };
  mkdirSync('reports/memory', { recursive: true });
  const file = `reports/memory/${report.capturedAt.replaceAll(':', '-')}-attribute-copy.json`;
  const save = () => writeFileSync(file, JSON.stringify(report, null, 2) + '\n');
  try {
    for (const realm of ['default', 'vm']) for (let cycle = 0; cycle <= MEASURED_CYCLES; cycle += 1) {
      await collectGarbage();
      const baselineTree = runtime.getNativeTreeStatistics(), baselineCopies = native.attributeCopyStatistics();
      const sample = batch(realm), heldCount = sample.held.length;
      const { snapshots, ...owners } = sample.observed;
      const held = await waitForMemoryQuiescence({ label: `${realm}/cycle-${cycle}/snapshot-held`,
        sample: () => captureMemoryState(owners, runtime), expectedNative: baselineTree });
      report.cases.push({ realm, cycle, stage: 'held', snapshots: native.attributeCopyStatistics(), endpoint: held }); save();
      assert.equal(held.reached, true, `${realm}/cycle-${cycle}: source owners must collect while snapshots are held`);
      checkHeld(sample.held);
      assert.equal(native.attributeCopyStatistics().live, baselineCopies.live + heldCount);
      assert.ok(native.attributeCopyStatistics().liveBytes > baselineCopies.liveBytes);
      assert.equal(native.attributeCopyStatistics().accountedBytes, native.attributeCopyStatistics().liveBytes);
      assert.equal(native.attributeCopyStatistics().accountingErrors, baselineCopies.accountingErrors);
      assert.equal(snapshots.filter((reference) => reference.deref() !== undefined).length, heldCount);
      sample.held = [];
      const released = await waitForMemoryQuiescence({ label: `${realm}/cycle-${cycle}/snapshot-released`,
        sample: () => captureMemoryState(sample.observed, runtime), expectedNative: baselineTree });
      report.cases.push({ realm, cycle, stage: 'released', snapshots: native.attributeCopyStatistics(), endpoint: released }); save();
      assert.equal(released.reached, true, `${realm}/cycle-${cycle}: released snapshots and owners must collect`);
      assert.equal(native.attributeCopyStatistics().live, baselineCopies.live);
      const copies = native.attributeCopyStatistics();
      assert.equal(copies.liveBytes, baselineCopies.liveBytes);
      assert.equal(copies.accountedBytes, baselineCopies.accountedBytes);
      assert.equal(copies.accountingErrors, baselineCopies.accountingErrors);
      assert.equal(copies.created - baselineCopies.created, copies.released - baselineCopies.released);
    }
    report.pass = true; save(); console.log(`Guardado: ${file}`);
  } catch (error) { report.failure = { name: error.name, message: error.message }; save(); throw error; }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
