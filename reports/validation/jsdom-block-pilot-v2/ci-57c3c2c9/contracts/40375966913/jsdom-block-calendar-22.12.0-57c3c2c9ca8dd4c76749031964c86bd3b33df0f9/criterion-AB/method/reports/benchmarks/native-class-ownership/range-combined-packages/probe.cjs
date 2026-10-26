/** @file Exercises the actual assembled CJS/ESM package and bounded mixed StaticRange/Range lifetimes. */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const policy = require('./constants/probe.json');
const root = process.argv[2];
if (!root || typeof global.gc !== 'function') throw new Error('Combined package probe requires --expose-gc and an authenticated assembly root');
const runtime = require(path.join(root, 'candidate'));
const native = require(path.join(root, 'candidate/dist/native.cjs'));
const reference = require(path.join(root, 'controls/packages/J0'));
const { captureMemoryState, collectGarbage, waitForMemoryQuiescence } =
  require(path.join(root, 'candidate-sources/scripts/memory-endpoint.cjs'));

/** @param {object} engine - Independently loaded actual package. @returns {object} Public observable Unicode range behavior. */
function observeConsumer(engine) {
  const dom = new engine.JSDOM(policy.html, { runScripts: 'outside-only' });
  try {
    const { window } = dom;
    const text = window.document.querySelector('b').firstChild;
    const fixed = new window.StaticRange({ startContainer: text, startOffset: 1, endContainer: text, endOffset: 4 });
    assert.ok(fixed instanceof window.AbstractRange);
    const range = window.document.createRange();
    range.setStart(text, 1); range.setEnd(text, 4);
    const selected = range.toString();
    range.collapse(false);
    text.insertData(0, 'x');
    return { selected, collapsed: range.collapsed, liveStart: range.startOffset,
      liveEnd: range.endOffset, sameNode: range.startContainer === text && range.endContainer === text,
      staticStart: fixed.startOffset, staticEnd: fixed.endOffset, staticCollapsed: fixed.collapsed,
      text: text.data };
  } finally { dom.window.close(); }
}

/** @param {number} cycle - Bounded cycle identifier. @returns {object} One retained control and separate weak DOM/range observations. */
function createCycle(cycle) {
  const dom = new runtime.JSDOM(policy.html);
  const { window } = dom;
  const text = window.document.querySelector('b').firstChild;
  const retained = new window.StaticRange({ startContainer: text, startOffset: 1, endContainer: text, endOffset: 4 });
  const references = { windows: [new WeakRef(window)], documents: [new WeakRef(window.document)], ranges: [new WeakRef(retained)] };
  const before = native.NativeRange.statistics();
  for (let index = 0; index < policy.transientStaticRangesPerCycle; index++) {
    const fixed = new window.StaticRange({ startContainer: text, startOffset: index, endContainer: window.document, endOffset: 0 });
    references.ranges.push(new WeakRef(fixed));
    assert.throws(() => new window.StaticRange({ startContainer: window.document.doctype, startOffset: 0,
      endContainer: text, endOffset: 1 }), { name: 'InvalidNodeTypeError' });
  }
  for (let index = 0; index < policy.transientLiveRangesPerCycle; index++) {
    const range = window.document.createRange();
    range.setStart(text, 1); range.setEnd(text, 4); range.collapse(index % 2 === 0);
    references.ranges.push(new WeakRef(range));
  }
  const after = native.NativeRange.statistics();
  assert.equal(after.created - before.created, policy.transientStaticRangesPerCycle + policy.transientLiveRangesPerCycle);
  window.close();
  return { cycle, retained, references };
}

const report = { node: process.version, pass: false, consumers: {}, cycles: [],
  runtimeHybrid: true, benchmarkExecuted: false, performanceAccepted: null, gateReevaluated: false,
  limitations: 'Finite retained-resource observations; snapshots do not measure peak memory or prove universal absence of leaks' };

/** @returns {Promise<void>} Record all bounded endpoint traces, including partial failure evidence. */
async function main() {
  try {
    const esm = await import(pathToFileURL(path.join(root, 'candidate', policy.runtimeEntry)).href);
    report.consumers.reference = observeConsumer(reference);
    report.consumers.commonjs = observeConsumer(runtime);
    report.consumers.esm = observeConsumer(esm);
    assert.deepEqual(report.consumers.commonjs, report.consumers.reference);
    assert.deepEqual(report.consumers.esm, report.consumers.reference);
    await collectGarbage();
    report.baseline = runtime.getNativeTreeStatistics();
    report.nativeRangesBefore = native.NativeRange.statistics();
    report.initialMemory = process.memoryUsage();
    for (let cycle = 0; cycle < policy.cycles; cycle++) {
      let { retained, references } = createCycle(cycle);
      const entry = { cycle }; report.cycles.push(entry);
      const sample = () => captureMemoryState(references, runtime);
      entry.held = await waitForMemoryQuiescence({ label: 'held-combined-' + cycle, sample,
        expectedNative: report.baseline, maxRounds: policy.retainedControlRounds });
      assert.equal(entry.held.reached, false);
      assert.deepEqual(entry.held.state.survivors, { windows: 1, documents: 1, ranges: 1 });
      assert.equal(retained.startOffset, 1);
      retained = null;
      entry.released = await waitForMemoryQuiescence({ label: 'released-combined-' + cycle, sample, expectedNative: report.baseline });
      assert.equal(entry.released.reached, true, JSON.stringify(entry.released.trace));
      assert.deepEqual(entry.released.state.survivors, { windows: 0, documents: 0, ranges: 0 });
    }
    report.nativeRangesAfter = native.NativeRange.statistics();
    report.finalNative = runtime.getNativeTreeStatistics();
    report.scope = { windows: policy.cycles, documents: policy.cycles,
      staticRanges: policy.cycles * (policy.transientStaticRangesPerCycle + 1),
      liveRanges: policy.cycles * policy.transientLiveRangesPerCycle,
      invalidNodeRejections: policy.cycles * policy.transientStaticRangesPerCycle };
    report.pass = true;
  } catch (error) {
    report.failure = { name: error.name, message: error.message, stack: error.stack };
    process.stderr.write(error.stack + '\n'); process.exitCode = 1;
  } finally {
    report.finalMemory = process.memoryUsage();
    process.stdout.write(JSON.stringify(report) + '\n');
  }
}
main();
