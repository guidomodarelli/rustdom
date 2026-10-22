/** @file Exercises same-window warmup through real jsdom and official native runtime packages. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const { createBenchmarkRunner } = require('../../benchmarks/worker.cjs');
const { getBenchmarkPlan } = require('../../benchmarks/workload-plan.cjs');
const { warmOwnership } = require('../../benchmarks/ownership-warmup.cjs');
const { collectGarbage, captureMemoryState, waitForMemoryQuiescence } = require('../../scripts/memory-endpoint.cjs');
const policy = require('../../benchmarks/constants/ownership-warmup.cjs');
const settings = require('../../reports/benchmarks/native-class-ownership/constants/main-affinity.cjs');
const root = process.env.RUSTDOM_BENCHMARK_PACKAGE || path.resolve(__dirname, '../..');
const fromPackage = createRequire(path.join(root, 'package.json'));
const runtimes = [
  { label: 'jsdom', api: fromPackage('jsdom') },
  { label: 'rustdom', api: require(path.join(root, 'dist/index.cjs')) },
];
const oracle = require('../../reports/benchmarks/native-class-ownership/main-affinity/2026-10-21/node-22/index.json');

test('same-realm warmup preserves all eight public outputs and releases real Window, Document and native resources', async () => {
  const evidence = { node: process.version, cases: [] };
  const plan = getBenchmarkPlan().filter((workload) => policy.workloads.includes(workload.name));
  assert.equal(plan.length, settings.rows.length);
  for (const runtime of runtimes) {
    const runner = createBenchmarkRunner({ engine: runtime.label, runtime: runtime.api,
      trackRealms: true, warmupCurrentRealm: true });
    for (const workload of plan) {
      await collectGarbage();
      const baseline = runtime.api.getNativeTreeStatistics?.();
      const report = await runner.measureWorkload(workload.name, workload.size);
      const expected = oracle.summaries.AA.find((row) => row.key === `${report.name}/${report.rows}`);
      assert.equal(report.outputHash, expected.outputHash);
      assert.equal(report.withinRealmWarmupRounds, policy.rounds);
      assert.equal(report.samplesMs.length, settings.measuredSamples);
      assert.equal(report.memoryAfterCleanup.length, settings.measuredSamples);
      assert.ok(report.samplesMs.every((sample) => Number.isFinite(sample) && sample > 0));
      for (const references of Object.values(report.realmReferences)) {
        assert.equal(references.length, settings.warmupSamples + settings.measuredSamples);
      }
      const after = runtime.api.getNativeTreeStatistics?.();
      if (after) {
        const batches = settings.warmupSamples + settings.measuredSamples;
        assert.equal(runtime.api.getParserStatistics().fallback['document-scripts'] || 0, 0);
        if (workload.name.startsWith('range-')) {
          // NativeRange owns createRange/cloneRange/StaticRange; NativeRangeClone owns cloneContents instead.
          const perOperation = workload.name === 'range-control-1000' ? 1 : 3;
          const prepared = workload.name === 'range-control-1000' ? workload.size : 0;
          assert.equal(after.rangeStates.created - baseline.rangeStates.created,
            batches * ((policy.rounds + 1) * 1000 * perOperation + prepared));
        } else if (workload.name === 'mutation-records-collect') {
          assert.equal(after.mutationRecords.created - baseline.mutationRecords.created,
            batches * (policy.rounds + 1) * workload.size * 3);
        } else {
          assert.equal(after.mutationRecords.created - baseline.mutationRecords.created,
            batches * (policy.rounds + 1));
        }
      }
      const endpoint = await waitForMemoryQuiescence({ label: `${runtime.label}/${report.name}/${report.rows}`,
        sample: () => captureMemoryState(report.realmReferences, runtime.api), expectedNative: baseline });
      assert.equal(endpoint.reached, true, JSON.stringify(endpoint));
      assert.deepEqual(endpoint.state.survivors, { window: 0, document: 0 });
      assert.ok(endpoint.trace.slice(-2).every((observation) => observation.clear));
      const { realmReferences, ...measurement } = report;
      evidence.cases.push({ runtime: runtime.label, measurement, nativeBefore: baseline,
        nativeAfterOperations: after, endpoint });
    }
  }
  if (process.env.RUSTDOM_WARMUP_EVIDENCE) {
    fs.writeFileSync(process.env.RUSTDOM_WARMUP_EVIDENCE, `${JSON.stringify(evidence, null, 2)}\n`, { flag: 'wx' });
  }
});

test('invalid warmup options fail before allocating a native document', () => {
  const runtime = runtimes.find((runtime) => runtime.label === 'rustdom');
  const before = runtime.api.getParserStatistics().nativeDocument;
  assert.throws(() => createBenchmarkRunner({ engine: runtime.label, runtime: runtime.api,
    warmupCurrentRealm: 'true' }), /warmupCurrentRealm must be a boolean/);
  assert.equal(runtime.api.getParserStatistics().nativeDocument, before);
});

test('default runner keeps warmup opt-in and existing output contract', async () => {
  for (const runtime of runtimes) {
    const report = await createBenchmarkRunner({ engine: runtime.label, runtime: runtime.api })
      .measureWorkload('range-control-1000', 250);
    assert.equal(Object.hasOwn(report, 'withinRealmWarmupRounds'), false);
    assert.equal(report.outputHash,
      oracle.summaries.AA.find((row) => row.key === 'range-control-1000/250').outputHash);
  }
});

test('temporary real observer fixtures are disposed and removed on success and validation failure', async () => {
  for (const runtime of runtimes) for (const failValidation of [false, true]) {
    const dom = new runtime.api.JSDOM('<!doctype html><body><main>original</main></body>');
    const document = dom.window.document;
    const original = [...document.body.childNodes];
    let disposed = 0;
    /** Own fixture adapter uses the actual platform observer; no platform replacement or mocking. */
    function createMutationFixture() {
      const host = document.body.appendChild(document.createElement('section'));
      const observer = new dom.window.MutationObserver(() => {});
      observer.observe(host, { attributes: true });
      return {
        produce() { host.setAttribute('data-warmup', 'actual'); return observer.takeRecords(); },
        validate(records) {
          assert.equal(records.length, 1); assert.equal(records[0].target, host);
          assert.equal(records[0].attributeName, 'data-warmup');
          if (failValidation) throw new Error('WarmupFixture: deliberate validation failure');
        },
        dispose() { observer.disconnect(); disposed++; },
      };
    }
    try {
      const pending = warmOwnership({ name: 'mutation-records-collect', document, size: 1,
        createMutationFixture, captureRecords: (records) => [...records] });
      if (failValidation) await assert.rejects(pending, /deliberate validation failure/);
      else await pending;
      assert.equal(disposed, failValidation ? 1 : policy.rounds);
      assert.deepEqual([...document.body.childNodes], original);
      assert.equal(document.body.textContent, 'original');
    } finally { dom.window.close(); }
  }
});
