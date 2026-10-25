/** @file Real DOM contracts for sequential batches; timings are functional evidence and never performance acceptance. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { test, after } = require('node:test');
const { createBatchSampler } = require('./batches.cjs');
const policy = require('./constants/sampler.json');
const roots = JSON.parse(fs.readFileSync(process.env[policy.functionalRootsEnvironment], 'utf8'));
const repository = path.resolve(__dirname, '../../../..');
const operations = require(path.join(repository, 'benchmarks/ownership-operations.cjs'));
const { warmOwnership } = require(path.join(repository, 'benchmarks/ownership-warmup.cjs'));
const memory = require(path.join(repository, 'scripts/memory-endpoint.cjs'));
const fixtures = require('../shared-fixture-candidate/fixtures.cjs');
const { fixture: fixtureHTML, loadRuntime } = require('../paired-worker.cjs');
assert.equal(createHash('sha256').update(fs.readFileSync(roots.runtimeBinary)).digest('hex'), roots.runtimeBinarySha256);
const runtimes = { rustdom: loadRuntime(roots.runtime, 'rustdom'), jsdom: loadRuntime(roots.reference, 'jsdom') };
assert.notEqual(runtimes.rustdom.api.JSDOM, runtimes.jsdom.api.JSDOM);
assert.equal(typeof runtimes.jsdom.api.getNativeTreeStatistics, 'undefined');
const sampler = createBatchSampler({ fixtureHTML, fixtures, operations, warmOwnership,
  collectGarbage: memory.collectGarbage });
const historical = JSON.parse(fs.readFileSync(path.join(repository, roots.historicalDiagnostic), 'utf8'));
const expectedHashes = Object.fromEntries(policy.rows.map((key) => {
  const hashes = new Set(historical.processes.filter((record) => record.row === key).map((record) => record.outputHash));
  assert.equal(hashes.size, 1); return [key, [...hashes][0]];
}));
const evidence = { node: process.version, execArgv: process.execArgv,
  runtimeBinarySha256: roots.runtimeBinarySha256, functionalOnly: true,
  performanceStudyExecuted: false, DOMExecuted: true, performanceAccepted: null,
  gateReevaluated: false, blocks: [], rows: [], resourceProbes: [] };

/** Observe fixed distinct turns and every native family after the operation has returned. */
async function endpoint(runtime, owners, baseline, label) {
  const trace = [];
  for (let round = 0; round < policy.cleanupRounds; round++) {
    await memory.collectGarbage();
    const state = memory.captureMemoryState(owners, runtime.api);
    trace.push({ round, ...state, clear: memory.isReleased(state, baseline) });
  }
  evidence.resourceProbes.push({ label, baseline, trace });
  return trace;
}
/** Require both final endpoints, preserving earlier non-clear observations. */
function released(trace) {
  for (const state of trace.slice(-policy.requiredFinalClearStates)) {
    assert.equal(state.survivors.window, 0); assert.equal(state.survivors.document, 0);
    assert.equal(state.clear, true);
  }
}

for (const engine of policy.engines) for (const key of policy.rows) test(engine + ' preserves every original task output in ' + key, async () => {
  const runtime = runtimes[engine];
  await memory.collectGarbage(); const baseline = runtime.api.getNativeTreeStatistics?.();
  const owners = { window: [], document: [] };
  const record = await sampler.measureBlock({ runtime, engine, key, stage: policy.stages.measured, blockIndex: 0, owners });
  evidence.blocks.push({ engine, ...record });
  assert.equal(record.complete, true); assert.equal(record.functionalOnly, true);
  assert.equal(record.tasks.length, policy.logicalTasksPerBlock);
  assert.equal(record.withinRealmWarmupRounds, policy.withinRealmWarmupRounds);
  for (const task of record.tasks) {
    assert.equal(task.complete, true); assert.equal(task.outputHash, expectedHashes[key]);
    assert.ok(Number.isFinite(task.durationMs) && task.durationMs > 0);
  }
  assert.equal(owners.window.length, 1); assert.equal(owners.document.length, 1);
  released(await endpoint(runtime, owners, baseline, engine + '/' + key));
});

test('the complete row retains all 12 realms, measured intervals and warmup without pseudoreplication', async () => {
  const runtime = runtimes.rustdom;
  await memory.collectGarbage(); const baseline = runtime.api.getNativeTreeStatistics();
  const owners = { window: [], document: [] }; const key = policy.rows[policy.fullRowContractIndex];
  const record = await sampler.measureRow({ runtime, engine: 'rustdom', key, owners });
  evidence.rows.push(record);
  assert.equal(record.complete, true); assert.equal(record.functionalOnly, true);
  assert.equal(record.blocks.length, policy.warmupBlocksPerProcess + policy.measuredBlocksPerProcess);
  assert.equal(record.measuredSamplesMs.length, policy.measuredBlocksPerProcess * policy.logicalTasksPerBlock);
  assert.equal(record.warmupSamplesMs.length, policy.warmupBlocksPerProcess * policy.logicalTasksPerBlock);
  assert.equal(owners.window.length, record.blocks.length); assert.equal(owners.document.length, record.blocks.length);
  assert.equal(record.performanceAccepted, null); assert.equal(record.gateReevaluated, false);
  released(await endpoint(runtime, owners, baseline, 'complete-row'));
});

for (const [label, sentinel] of [['symbol', Symbol('original-progress-error')], ['undefined', undefined]]) {
  test('progress errors preserve the original ' + label + ' and release both owners', async () => {
    const runtime = runtimes.rustdom;
    await memory.collectGarbage(); const baseline = runtime.api.getNativeTreeStatistics();
    const owners = { window: [], document: [] }; let rejected = false;
    try {
      await sampler.measureBlock({ runtime, engine: 'rustdom', key: policy.rows[policy.fullRowContractIndex],
        stage: policy.stages.measured, blockIndex: 0, owners,
        onProgress(record) { evidence.blocks.push({ engine: 'rustdom', errorContract: label, record }); throw sentinel; } });
    } catch (error) { rejected = true; assert.equal(error, sentinel); }
    assert.equal(rejected, true); assert.equal(owners.window.length, 1); assert.equal(owners.document.length, 1);
    released(await endpoint(runtime, owners, baseline, 'progress-error/' + label));
  });
}

for (const retainedKind of ['window', 'document']) test('a retained ' + retainedKind + ' is observed independently and then released', async () => {
  const runtime = runtimes.rustdom;
  await memory.collectGarbage(); const baseline = runtime.api.getNativeTreeStatistics();
  let dom = new runtime.api.JSDOM(fixtureHTML(policy.retentionControlRows));
  let retained = retainedKind === 'window' ? dom.window : dom.window.document;
  const owners = { window: [new WeakRef(dom.window)], document: [new WeakRef(dom.window.document)] };
  dom.window.close(); dom = null;
  const held = await endpoint(runtime, owners, baseline, 'retained/' + retainedKind);
  assert.equal(held.at(-1).survivors[retainedKind], 1); assert.equal(held.at(-1).clear, false);
  assert.ok(retained); retained = null;
  released(await endpoint(runtime, owners, baseline, 'released/' + retainedKind));
});

test('capture is rejected before creating a realm while the development method is disabled', async () => {
  const owners = { window: [], document: [] };
  await assert.rejects(sampler.measureBlock({ runtime: runtimes.rustdom, engine: 'rustdom', key: policy.rows[0],
    stage: policy.stages.measured, blockIndex: 0, purpose: policy.purposes.capture, owners }));
  assert.equal(owners.window.length, 0); assert.equal(owners.document.length, 0);
});

after(() => {
  fs.writeFileSync(process.env[policy.functionalOutputEnvironment], JSON.stringify(evidence, null, 2) + '\n', { flag: 'wx' });
});
