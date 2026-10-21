/** @file Observes actual benchmark Window/Document collection and native finalization after complete batches. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const { pathToFileURL } = require('node:url');
const { createBenchmarkRunner } = require('../../benchmarks/worker.cjs');
const { getBenchmarkPlan } = require('../../benchmarks/workload-plan.cjs');
const { collectGarbage, captureMemoryState, waitForMemoryQuiescence } = require('../../scripts/memory-endpoint.cjs');
const settings = require('../../reports/benchmarks/native-class-ownership/constants/main-affinity.cjs');
const root = process.env.RUSTDOM_BENCHMARK_PACKAGE || path.resolve(__dirname, '../..');
const fromPackage = createRequire(path.join(root, 'package.json'));
const runtimes = [
  { label: 'jsdom', engine: 'jsdom', api: fromPackage('jsdom') },
  { label: 'rustdom', engine: 'rustdom', api: require(path.join(root, 'dist/index.cjs')), root },
];
if (process.env.RUSTDOM_WORKER_BASELINE) {
  const baseline = path.resolve(process.env.RUSTDOM_WORKER_BASELINE);
  runtimes.push({ label: 'baseline', engine: 'rustdom', api: require(path.join(baseline, 'dist/index.cjs')), root: baseline });
}

/** Bind real packages; observer allocation occurs outside the existing timed operation. */
function runnerFor(runtime, trackRealms) {
  return createBenchmarkRunner({ engine: runtime.engine, runtime: runtime.api, trackRealms,
    environmentEntry: runtime.root ? pathToFileURL(path.join(runtime.root, 'src/environments/vitest.mjs')).href : undefined });
}

/** Require all warmup and measured realms to disappear, with native resources back at their starting counts. */
async function assertReleased(report, runtime, expectedNative) {
  for (const references of Object.values(report.realmReferences)) {
    assert.equal(references.length, settings.warmupSamples + settings.measuredSamples);
    assert.ok(references.every((reference) => reference instanceof WeakRef));
  }
  const endpoint = await waitForMemoryQuiescence({ label: `${runtime.label}/${report.name}/${report.rows}`,
    sample: () => captureMemoryState(report.realmReferences, runtime.api), expectedNative, maxRounds: 3 });
  assert.equal(endpoint.reached, true, JSON.stringify(endpoint));
  assert.deepEqual(endpoint.state.survivors, { window: 0, document: 0 });
  assert.ok(endpoint.trace.slice(-2).every((observation) => observation.clear));
  if (process.env.RUSTDOM_REALM_EVIDENCE_DIR) {
    const filename = path.join(process.env.RUSTDOM_REALM_EVIDENCE_DIR, `${runtime.label}-${report.name}-${report.rows}.json`);
    fs.writeFileSync(filename, `${JSON.stringify({ node: process.version, runtime: runtime.label,
      workload: report.name, size: report.rows, outputHash: report.outputHash,
      observationsPerTarget: settings.warmupSamples + settings.measuredSamples, endpoint }, null, 2)}\n`, { flag: 'wx' });
  }
}

test('all eight public workloads release warmup and measured Window/Document objects in real runtimes', async () => {
  assert.equal(typeof global.gc, 'function', 'Run realm collection tests with --expose-gc');
  const workloads = getBenchmarkPlan().filter((workload) => settings.workloads.includes(workload.name));
  assert.equal(workloads.length, settings.rows.length);
  for (const runtime of runtimes) {
    const runner = runnerFor(runtime, true);
    for (const workload of workloads) {
      await collectGarbage();
      const baseline = runtime.api.getNativeTreeStatistics?.();
      const report = await runner.measureWorkload(workload.name, workload.size);
      assert.equal(report.samplesMs.length, settings.measuredSamples);
      await assertReleased(report, runtime, baseline);
    }
  }
});

test('actual Vitest and VM setup batches expose weak observations and release both realm targets', async () => {
  for (const runtime of runtimes.filter((runtime) => runtime.label !== 'baseline')) {
    for (const name of ['environment-setup', 'environment-vm-setup']) {
      await collectGarbage();
      const baseline = runtime.api.getNativeTreeStatistics?.();
      const report = await runnerFor(runtime, true).measureWorkload(name, 25);
      await assertReleased(report, runtime, baseline);
    }
  }
});

test('default measurements retain the existing serializable result and identical public output', async () => {
  for (const runtime of runtimes.filter((runtime) => runtime.label !== 'baseline')) {
    const ordinary = await runnerFor(runtime, false).measureWorkload('range-control-1000', 250);
    const tracked = await runnerFor(runtime, true).measureWorkload('range-control-1000', 250);
    assert.equal(Object.hasOwn(ordinary, 'realmReferences'), false);
    assert.equal(ordinary.outputHash, tracked.outputHash);
    assert.equal(JSON.parse(JSON.stringify(ordinary)).samplesMs.length, settings.measuredSamples);
  }
});

test('invalid observation options fail before allocating a native document', () => {
  const runtime = runtimes.find((runtime) => runtime.label === 'rustdom');
  const before = runtime.api.getParserStatistics().nativeDocument;
  assert.throws(() => runnerFor(runtime, 'true'), /trackRealms must be a boolean/);
  assert.equal(runtime.api.getParserStatistics().nativeDocument, before);
});
