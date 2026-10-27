'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const test = require('node:test');
const { calendar } = require('./blocks.cjs');
const { replayProcess } = require('./process-reader.cjs');
const policy = require('./constants/process-fixtures.json');
const root = path.resolve(__dirname, '../../../../..', 'reports/validation/jsdom-block-pilot/process-reader/fixtures');

function read(name) {
  const raw = fs.readFileSync(path.join(root, name));
  assert.ok(raw.length <= policy.maximumFixtureBytes);
  assert.equal(raw.length, policy.files[name].bytes);
  assert.equal(createHash('sha256').update(raw).digest('hex'), policy.files[name].sha256);
  return JSON.parse(raw);
}
const manifest = read('physical-manifest.json');
const schedule = calendar();
const cases = policy.cases.map((entry) => {
  const shard = schedule.find((candidate) => candidate.node === entry.node && candidate.phase === entry.input.phase && candidate.rowIndex === entry.input.rowIndex);
  const planned = shard.processes.find((input) => input.block === 0 && input.factor === entry.input.position && input.label === entry.input.label);
  return { report: read(entry.path), planned, invocation: { node: entry.node, pid: entry.pid, mode: 'functional',
    hostId: 'historical-functional-fixture-with-synthetic-parent-context', startMonotonicMs: 10, endMonotonicMs: 20 } };
});

function replay(entry) { return replayProcess(entry.report, manifest, entry.planned, entry.invocation); }
function rejects(mutate) { const entry = structuredClone(cases[0]); mutate(entry); assert.throws(() => replay(entry)); }

test('all 32 historical jsdom functional payloads preserve 144 tasks, 48 warmup and separate owners', () => {
  let measured = 0; let warmup = 0; let windows = 0; let documents = 0;
  for (const entry of cases) {
    const result = replay(entry);
    measured += result.replay.samplesMs.length; warmup += result.replay.warmupSamplesMs.length;
    windows += result.trackedOwners.window; documents += result.trackedOwners.document;
    assert.equal(result.cleanupTrace.length, 3); assert.ok(result.cleanupTrace.slice(-2).every((endpoint) => endpoint.clear));
    assert.equal(result.analysisObservation, null); assert.equal(result.rawPayloadRewritten, false);
    assert.equal(result.transportAuthenticationPerformed, false); assert.equal(result.producerSourceAuthenticationPerformed, false);
    assert.equal(result.performanceAccepted, null); assert.equal(result.gateReevaluated, false);
  }
  assert.equal(measured, 4608); assert.equal(warmup, 1536);
  assert.equal(windows, 384); assert.equal(documents, 384);
});

test('dropping measured tasks or warmup and changing public output is rejected without repair', () => {
  rejects((entry) => { entry.report.blocks[3].tasks.shift(); });
  rejects((entry) => { entry.report.measurement.warmupSamplesMs.shift(); });
  rejects((entry) => { entry.report.blocks[3].tasks[0].outputHash = '0'.repeat(64); });
});

test('Window and Document retained in either final endpoint invalidate cleanup', () => {
  for (const kind of ['window', 'document']) for (const round of [1, 2]) {
    rejects((entry) => { entry.report.cleanupTrace[round].survivors[kind] = 1; entry.report.cleanupTrace[round].clear = false; });
  }
  rejects((entry) => { entry.report.cleanupTrace[2].survivors.window = 1; entry.report.cleanupTrace[2].clear = true; });
});

test('changed calendar position, factor or SDK cannot relabel a raw payload', () => {
  rejects((entry) => { entry.planned.ordinal += 1; });
  rejects((entry) => { entry.planned.factor = 1; });
  rejects((entry) => { entry.invocation.node = 'v24.14.1'; });
});

test('unordered or non-finite parent clock windows are rejected', () => {
  rejects((entry) => { entry.invocation.endMonotonicMs = entry.invocation.startMonotonicMs; });
  rejects((entry) => { entry.invocation.startMonotonicMs = Infinity; });
  rejects((entry) => { entry.invocation.hostId = ''; });
});

test('Rust payload roles cannot enter a jsdom-only criterion', () => {
  rejects((entry) => { entry.planned.engine = 'rustdom'; });
  rejects((entry) => { entry.report.engine = 'rustdom'; });
});

test('historical functional data cannot be promoted into the unpublished scientific method', () => {
  const entry = structuredClone(cases[0]); entry.invocation.mode = 'capture';
  assert.throws(() => replay(entry), { code: 'ERR_ASSERTION' });
  assert.equal(replay(cases[0]).analysisObservation, null);
});

test('native baselines and statistics cannot be invented for independent jsdom', () => {
  rejects((entry) => { entry.report.nativeBaseline = {}; });
  rejects((entry) => { entry.report.cleanupTrace[2].nativeTree = {}; });
});
