/** @module confirmation-real-replay-contracts Checks actual addon/jsdom qualification and adversarial scalar copies; never imports a captured runtime. */
'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { replayEnvelope } = require('./envelope.cjs');
const { validateWorker } = require('./raw-reader.cjs');

const fixtureDirectory = process.env.RUSTDOM_CONFIRMATION_FUNCTIONAL_FIXTURE;

/** @returns {object} Original completed qualification plus current decoded data; no source or runtime is executed from the fixture. */
function fixture() {
  assert.ok(fixtureDirectory, 'Confirmation replay contracts: provide the real completed functional qualifier directory');
  const root = fs.realpathSync(fixtureDirectory);
  const index = JSON.parse(fs.readFileSync(path.join(root, 'index.json'), 'utf8'));
  assert.equal(index.complete, true); assert.equal(index.functionalOnly, true);
  assert.equal(index.processes.length, 64); assert.equal(index.scientificCaptureExecuted, false);
  const producer = { parentPid: index.parentPid, workerSourceSha256: index.ownSourceFiles['worker.cjs'],
    workerEngineSourceSha256: index.ownSourceFiles['worker-engine.cjs'] };
  const records = index.processes.map((entry) => {
    const output = path.join(root, entry.directory, 'report.json');
    return { report: JSON.parse(fs.readFileSync(output, 'utf8')), context: JSON.parse(fs.readFileSync(output + '.context.json', 'utf8')),
      input: entry.input, invocation: { mode: 'functional', node: index.node, pid: entry.invocation.command.pid,
        hostId: 'functional-parent-' + index.parentPid, startMonotonicMs: entry.invocation.startMonotonicMs,
        endMonotonicMs: entry.invocation.endMonotonicMs } };
  });
  return { index, producer, records };
}

/** @param {object} source - Real fixture. @param {object} record - Original or scalar-copy record. @returns {object} Current reader's functional view. */
function replay(source, record) {
  return replayEnvelope(record.report, record.context, source.index.manifest, record.input, record.invocation, source.producer);
}

test('all 64 real AA/AB Rust/jsdom workers retain full tasks, separate owners, native baselines and no acceptance', () => {
  const source = fixture();
  const totals = { measured: 0, warmup: 0, windows: 0, documents: 0, nativeWorkers: 0 };
  for (const record of source.records) {
    const result = replay(source, record);
    totals.measured += result.replay.samplesMs.length; totals.warmup += result.replay.warmupSamplesMs.length;
    totals.windows += result.trackedOwners.window; totals.documents += result.trackedOwners.document;
    assert.equal(result.cleanupTrace.length, 3); assert.ok(result.cleanupTrace.slice(-2).every((state) => state.clear));
    assert.equal(result.analysisObservation, null); assert.equal(result.performanceAccepted, null); assert.equal(result.gateReevaluated, false);
    if (record.input.engine === 'rustdom') { assert.ok(record.report.nativeBaseline); totals.nativeWorkers += 1; }
    else assert.equal(record.report.nativeBaseline, null);
  }
  assert.deepEqual(totals, { measured: 9216, warmup: 3072, windows: 768, documents: 768, nativeWorkers: 32 });
});

test('real envelope rejects mode promotion, swapped factors, source hashes, parent/PID/SDK and invalid clocks', () => {
  const source = fixture();
  const record = source.records.find((entry) => entry.input.engine === 'rustdom' && entry.input.phase === 'AB' && entry.input.label === 'B');
  const mutations = [
    (value) => { value.invocation.mode = 'capture'; }, (value) => { value.context.methodRevision = 'foreign-method'; },
    (value) => { value.input.ordinal += 1; }, (value) => { value.context.workerSourceSha256 = '0'.repeat(64); },
    (value) => { value.context.workerEngineSourceSha256 = '0'.repeat(64); }, (value) => { value.context.pid += 1; },
    (value) => { value.context.parentPid += 1; }, (value) => { value.context.node = 'v0.0.0'; },
    (value) => { value.invocation.endMonotonicMs = value.invocation.startMonotonicMs; },
    (value) => { value.context.analysisObservation = {}; }, (value) => { value.context.complete = false; }
  ];
  for (const mutate of mutations) {
    const changed = structuredClone(record); mutate(changed);
    assert.throws(() => replay(source, changed));
  }
});

test('real raw native data rejects lost baseline families, missing warmup, output divergence and retained final Window or Document', () => {
  const source = fixture();
  const record = source.records.find((entry) => entry.input.engine === 'rustdom' && entry.input.phase === 'AB' && entry.input.label === 'B');
  const mutations = [
    (value) => { value.report.nativeBaseline = null; },
    (value) => { delete value.report.nativeBaseline[Object.keys(value.report.nativeBaseline)[0]]; },
    (value) => { value.report.blocks[0].tasks.pop(); },
    (value) => { value.report.blocks[0].tasks[0].outputHash = '0'.repeat(64); },
    (value) => { value.report.blocks[0].tasks[0].durationMs = NaN; },
    (value) => { value.report.cleanupTrace[2].survivors.window = 1; },
    (value) => { value.report.cleanupTrace[2].survivors.document = 1; },
    (value) => { value.report.trackedOwners.window -= 1; },
    (value) => { value.report.cleanupTrace.pop(); },
    (value) => { value.report.distributionsAfter.B.sha256 = '0'.repeat(64); }
  ];
  for (const mutate of mutations) {
    const changed = structuredClone(record); mutate(changed);
    assert.throws(() => replay(source, changed));
  }
});

test('reader preserves a constructed first nonclear state and still requires two final clear states', () => {
  const source = fixture();
  const record = structuredClone(source.records.find((entry) => entry.input.engine === 'rustdom' && entry.input.phase === 'AB' && entry.input.label === 'B'));
  record.report.cleanupTrace[0].survivors.window = 1; record.report.cleanupTrace[0].clear = false;
  const result = replay(source, record);
  assert.equal(result.cleanupTrace[0].clear, false); assert.ok(result.cleanupTrace.slice(-2).every((state) => state.clear));
  record.report.cleanupTrace[1].survivors.document = 1; record.report.cleanupTrace[1].clear = false;
  assert.throws(() => replay(source, record));
  assert.throws(() => validateWorker(record.report, source.index.manifest, {
    phase: record.input.phase, engine: record.input.engine, position: record.input.factor,
    label: record.input.label, rowIndex: record.input.rowIndex }, { ...record.invocation, mode: 'capture' }));
});
