/** @file Exercises prospective shared consumers with real jsdom/Rustdom, original warmup and teardown. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { createMutationFixture, createDeliveryFixture, captureRecords, MutationFixture } = require('./fixtures.cjs');
const fixtureHtml = require('./fixture-html.cjs');
const settings = require('./constants/qualification.json');
const { warmOwnership } = require('../../../../benchmarks/ownership-warmup.cjs');
const operations = require('../../../../benchmarks/ownership-operations.cjs');
const { collectGarbage, captureMemoryState, waitForMemoryQuiescence } = require('../../../../scripts/memory-endpoint.cjs');
const study = require('../current-ownership-experiment.cjs');
const plan = require('../../../../benchmarks/workload-plan.cjs').getBenchmarkPlan();
const rows = require('../constants/current-ownership.cjs').rows.map((key) => {
  const row = plan.find((entry) => `${entry.name}/${entry.size}` === key);
  assert.ok(row, `Shared fixture qualification: missing canonical workload ${key}`);
  return row;
});
const preparation = process.env.RUSTDOM_SHARED_FIXTURE_PREPARATION;
const evidenceFile = process.env.RUSTDOM_SHARED_FIXTURE_EVIDENCE;
assert.ok(preparation && evidenceFile, 'Provide the authenticated preparation and a new evidence JSON');
assert.equal(typeof global.gc, 'function', 'Run shared fixture contracts with --expose-gc');
assert.ok(!fs.existsSync(evidenceFile), 'Preserve the previous qualification evidence');
const preparationIdentity = study.inspectPreparation(preparation);
const runtimes = [{ name: 'jsdom', api: require(path.join(preparation, 'packages/J0')) },
  { name: 'rustdom', api: require(path.join(preparation, 'packages/B')) }];
const evidence = { node: process.version, functionalOnly: true, performanceAccepted: null,
  samplerExecuted: false, preparationIdentity, rows: rows.length, cases: [] };
const retainedDisposed = [];
const retainedPending = [];
const reference = require('../current-source-results/39921160254/original-verification.json').results
  .find((result) => result.node === process.version);
assert.ok(reference, 'Shared fixture qualification: missing independent jsdom reference for this Node');
function save() { fs.writeFileSync(evidenceFile, JSON.stringify(evidence, null, 2) + '\n'); }

/** Actual DOM operations and assertions; only weak targets and disposed scalar state escape. */
async function exercise(runtime, row) {
  let dom = new runtime.api.JSDOM(fixtureHtml(row.size));
  const references = { window: [new WeakRef(dom.window)], document: [new WeakRef(dom.window.document)] };
  const fixtures = [];
  try {
    const document = dom.window.document;
    const originalBody = [...document.body.childNodes];
    let measured;
    let range;
    let ranges;
    let texts;
    let expectedLifecycle;
    if (row.name === settings.mutationWorkload) measured = createMutationFixture(document, row.size);
    else if (row.name === settings.deliveryWorkload) measured = createDeliveryFixture(document, row.size, row.name);
    else {
      const nodes = [...document.querySelectorAll('tr')];
      if (row.name === settings.controlWorkload) {
        ranges = nodes.map((node) => { const entry = document.createRange(); entry.selectNodeContents(node); return entry; });
        range = ranges.at(-1);
      } else {
        texts = nodes.map((node) => node.firstChild.firstChild.firstChild);
        const units = Array.from({ length: settings.rangeIterations }, (unused, index) => texts[index % texts.length].length)
          .reduce((sum, length) => sum + length, 0);
        expectedLifecycle = units * 3 + settings.rangeIterations;
      }
    }
    if (measured) fixtures.push(measured);
    const beforeWarmup = [...document.body.childNodes];
    await warmOwnership({ name: row.name, window: dom.window, document, size: row.size,
      iterations: settings.rangeIterations, range, comparisonMode: dom.window.Range.START_TO_START, texts,
      expectedLifecycle, createMutationFixture, createDeliveryFixture, captureRecords });
    assert.deepEqual([...document.body.childNodes], beforeWarmup, 'Temporary warmup hosts must be removed');
    let output;
    if (row.name === settings.mutationWorkload) {
      assert.equal(measured.host.hasAttribute('data-state'), false);
      assert.equal(measured.text.data, 'initial');
      assert.deepEqual([...measured.host.childNodes], [measured.text]);
      assert.ok(measured.children.every((child) => child.parentNode === null));
      assert.equal(measured.observer.takeRecords().length, 0, 'Warmup must not queue records in the measured observer');
      const comparison = createMutationFixture(document, row.size);
      fixtures.push(comparison);
      assert.equal(measured.produce, comparison.produce); assert.equal(measured.validate, comparison.validate);
      comparison.dispose();
      const snapshots = captureRecords(measured.produce());
      measured.validate(snapshots);
      output = { records: snapshots.length, types: [...new Set(snapshots.map((record) => record.type))],
        firstOldValue: snapshots[0].oldValue, lastOldValue: snapshots.at(-2).oldValue };
    } else if (row.name === settings.deliveryWorkload) {
      assert.equal(measured.host.hasAttribute('data-delivery'), false);
      assert.equal(measured.observerCalls, 0);
      assert.equal(measured.received.length, 0);
      const comparison = createDeliveryFixture(document, row.size, row.name);
      fixtures.push(comparison);
      assert.equal(measured.receive, comparison.receive); assert.equal(measured.prepare, comparison.prepare);
      assert.equal(measured.validate, comparison.validate); comparison.dispose();
      measured.prepare(); await measured.completed; measured.validate();
      output = { observerCalls: measured.observerCalls, records: measured.received.reduce((count, records) => count + records.length, 0) };
    } else if (row.name === settings.controlWorkload) {
      output = { checksum: operations.control(range, dom.window.Range.START_TO_START, settings.rangeIterations) };
      assert.equal(output.checksum, settings.rangeIterations / 2);
    } else {
      assert.equal(row.name, settings.lifecycleWorkload);
      output = { checksum: operations.lifecycle(dom.window, document, texts, settings.rangeIterations) };
      assert.equal(output.checksum, expectedLifecycle);
    }
    output.publicOutputHash = createHash('sha256').update(dom.serialize()).digest('hex');
    const expected = reference.summaries.AA.find((entry) => entry.key === `${row.name}/${row.size}`);
    assert.equal(output.publicOutputHash, expected.outputHash, 'Shared consumers must preserve the independent original public output');
    for (const fixture of fixtures) { fixture.dispose(); fixture.dispose(); retainedDisposed.push(fixture); }
    if (measured) assert.deepEqual([...document.body.childNodes], originalBody);
    return { references, output };
  } finally {
    for (const fixture of fixtures) fixture.dispose();
    dom.window.close(); dom = null;
  }
}

test('the original warmup and all eight public rows preserve fresh measured fixtures, outputs and finite release', async () => {
  const outputs = new Map();
  for (const runtime of runtimes) for (const row of rows) for (let cycle = 0; cycle < settings.cyclesPerRow; cycle++) {
    await collectGarbage();
    const baseline = runtime.api.getNativeTreeStatistics?.();
    const result = await exercise(runtime, row);
    const endpoint = await waitForMemoryQuiescence({ label: `${runtime.name}/${row.name}/${row.size}/${cycle}`,
      sample: () => captureMemoryState(result.references, runtime.api), expectedNative: baseline });
    const key = `${row.name}/${row.size}`;
    const entry = { runtime: runtime.name, key, cycle, output: result.output, windows: 1, documents: 1,
      nativeBaseline: baseline ?? null, endpoint };
    evidence.cases.push(entry); save();
    assert.equal(endpoint.reached, true, JSON.stringify(endpoint));
    assert.deepEqual(endpoint.state.survivors, { window: 0, document: 0 });
    assert.ok(endpoint.trace.slice(-2).every((state) => state.clear));
    if (outputs.has(key)) assert.deepEqual(result.output, outputs.get(key)); else outputs.set(key, result.output);
  }
  assert.equal(evidence.cases.length, 32);
});

test('failed public-output validation still permits idempotent cleanup and releases disposed fixtures', async () => {
  for (const runtime of runtimes) {
    await collectGarbage();
    const baseline = runtime.api.getNativeTreeStatistics?.();
    const result = await (async () => {
      let dom = new runtime.api.JSDOM('<!doctype html><body>');
      const references = { window: [new WeakRef(dom.window)], document: [new WeakRef(dom.window.document)] };
      const fixture = new MutationFixture(dom.window.document, 1);
      try {
        const snapshots = captureRecords(fixture.produce()); snapshots[0].oldValue = 'invalid';
        assert.throws(() => fixture.validate(snapshots), { code: 'ERR_ASSERTION' });
      } finally { fixture.dispose(); fixture.dispose(); dom.window.close(); dom = null; }
      retainedDisposed.push(fixture);
      assert.throws(() => fixture.produce(), /fixture is disposed/);
      assert.throws(() => fixture.validate([]), /fixture is disposed/);
      return references;
    })();
    const endpoint = await waitForMemoryQuiescence({ label: `${runtime.name}/validation-error`,
      sample: () => captureMemoryState(result, runtime.api), expectedNative: baseline });
    evidence.cases.push({ runtime: runtime.name, key: 'validation-error', windows: 1, documents: 1,
      nativeBaseline: baseline ?? null, endpoint }); save();
    assert.equal(endpoint.reached, true, JSON.stringify(endpoint));
  }
});

test('unsupported delivery workloads fail before creating a host or observer and release both realm targets', async () => {
  for (const runtime of runtimes) {
    await collectGarbage();
    const baseline = runtime.api.getNativeTreeStatistics?.();
    const references = await (async () => {
      let dom = new runtime.api.JSDOM('<!doctype html><body>');
      const observed = { window: [new WeakRef(dom.window)], document: [new WeakRef(dom.window.document)] };
      try {
        const before = dom.window.document.body.childNodes.length;
        const nativeBefore = runtime.api.getNativeTreeStatistics?.();
        assert.throws(() => createDeliveryFixture(dom.window.document, 1, 'unsupported'), /unsupported ownership workload/);
        assert.equal(dom.window.document.body.childNodes.length, before);
        assert.deepEqual(runtime.api.getNativeTreeStatistics?.(), nativeBefore);
      } finally { dom.window.close(); dom = null; }
      return observed;
    })();
    const endpoint = await waitForMemoryQuiescence({ label: `${runtime.name}/unsupported-delivery`,
      sample: () => captureMemoryState(references, runtime.api), expectedNative: baseline });
    evidence.cases.push({ runtime: runtime.name, key: 'unsupported-delivery', windows: 1, documents: 1,
      nativeBaseline: baseline ?? null, endpoint }); save();
    assert.equal(endpoint.reached, true, JSON.stringify(endpoint));
  }
});

test('disposing queued delivery suppresses callbacks and retained pending promises do not retain the realm', async () => {
  for (const runtime of runtimes) {
    await collectGarbage();
    const baseline = runtime.api.getNativeTreeStatistics?.();
    const references = await (async () => {
      let dom = new runtime.api.JSDOM('<!doctype html><body>');
      const observed = { window: [new WeakRef(dom.window)], document: [new WeakRef(dom.window.document)] };
      const fixture = createDeliveryFixture(dom.window.document, 2, settings.deliveryWorkload);
      retainedPending.push(fixture.completed);
      try {
        fixture.prepare(); fixture.dispose();
        await new Promise((resolve) => setImmediate(resolve));
        assert.equal(fixture.observerCalls, 0);
        assert.equal(fixture.received.length, 0);
        assert.throws(() => fixture.prepare(), /fixture is disposed/);
        assert.throws(() => fixture.validate(), /fixture is disposed/);
      } finally { fixture.dispose(); dom.window.close(); dom = null; }
      retainedDisposed.push(fixture);
      return observed;
    })();
    const endpoint = await waitForMemoryQuiescence({ label: `${runtime.name}/cancelled-delivery`,
      sample: () => captureMemoryState(references, runtime.api), expectedNative: baseline });
    evidence.cases.push({ runtime: runtime.name, key: 'cancelled-delivery', windows: 1, documents: 1,
      nativeBaseline: baseline ?? null, endpoint }); save();
    assert.equal(endpoint.reached, true, JSON.stringify(endpoint));
  }
});
