/** @file Verify the real diagnostic plan without starting a worker or collecting a sample. */
'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { createHash } = require('node:crypto');
const { plan } = require('./schedule.cjs');
const { analyzeProcess } = require('./analyze.cjs');
const policy = require('./constants/protocol.json');
const repository = path.resolve(__dirname, '../../../..');
const study = require('../current-ownership-experiment.cjs');
const settings = require('../constants/current-ownership.cjs');
const entries = plan(repository);
const historicalRoot = process.env.NATIVE_TELEMETRY_HISTORICAL_CORPUS;
const historical = JSON.parse(fs.readFileSync(path.join(historicalRoot, 'index.json'), 'utf8'));
const originalReader = require('../jsdom-telemetry/analyze.cjs');
const originalPolicy = require('../jsdom-telemetry/constants/protocol.json');
const historicalIdentity = { engine: 'jsdom', reportRevision: settings.revision, telemetryRevision: originalPolicy.revision };
const profiles = policy.nodeVersions.flatMap((node) => policy.modes.map((mode) => {
  const ordinal = historical.processes.findIndex((entry) => entry.node === node && entry.input.mode === mode);
  assert.ok(ordinal >= 0);
  const entry = historical.processes[ordinal];
  const directory = path.join(historicalRoot, ordinal < historical.processes.length / 2 ? 'node22' : 'node24',
    String(ordinal % (historical.processes.length / 2)).padStart(3, '0'));
  for (const [name, expected] of Object.entries(entry.files)) {
    assert.equal(createHash('sha256').update(fs.readFileSync(path.join(directory, name))).digest('hex'), expected);
  }
  return { node, mode, directory };
}));

/** Exercise controlled corruption of a real CPU artifact, without changing its original files. */
function withCorruptedReport(change, inspect) {
  const source = profiles.find((entry) => entry.mode === 'cpu');
  const parent = fs.realpathSync(os.tmpdir()); const temporary = fs.mkdtempSync(path.join(parent, 'rustdom-native-telemetry-corruption-'));
  const names = ['report.json', 'report.json.telemetry.json', 'cpu.cpuprofile'];
  try {
    for (const name of names) fs.copyFileSync(path.join(source.directory, name), path.join(temporary, name));
    const report = JSON.parse(fs.readFileSync(path.join(temporary, 'report.json'), 'utf8'));
    change(report); fs.writeFileSync(path.join(temporary, 'report.json'), JSON.stringify(report));
    inspect(temporary);
  } finally {
    assert.equal(path.dirname(temporary), parent);
    for (const name of names) if (fs.existsSync(path.join(temporary, name))) fs.unlinkSync(path.join(temporary, name));
    fs.rmdirSync(temporary);
  }
}

test('diagnostic plan preserves all phases engines labels and sixteen seeds for the declared row', () => {
  const original = study.processSchedule().filter((entry) => entry.rowIndex === policy.rowIndex);
  assert.equal(entries.length, 512);
  for (const node of policy.nodeVersions) for (const mode of policy.modes) {
    const group = entries.filter((entry) => entry.node === node && entry.mode === mode);
    assert.equal(group.length, 128);
    assert.deepEqual(group.map(({ node: actualNode, mode: actualMode, ...input }) => input), original);
    assert.deepEqual([...new Set(group.map((entry) => entry.position))].sort((left, right) => left - right), Array.from({ length: 16 }, (_, position) => position));
    for (const phase of settings.phases) for (const engine of settings.engines) for (const label of settings.labels) {
      assert.equal(group.filter((entry) => entry.phase === phase && entry.engine === engine && entry.label === label).length, 16);
    }
  }
});
test('mutating a diagnostic plan cannot change the original schedule rows or budgets', () => {
  const original = study.processSchedule();
  const originalSettings = structuredClone({ rows: settings.rows, phases: settings.phases, controlBudgetPercent: settings.controlBudgetPercent,
    rustBudgetPercent: settings.rustBudgetPercent });
  const modified = plan(repository); modified[0].rowIndex = -1; modified[0].label = 'changed'; modified[0].position = -1;
  assert.deepEqual(study.processSchedule(), original);
  assert.deepEqual({ rows: settings.rows, phases: settings.phases, controlBudgetPercent: settings.controlBudgetPercent,
    rustBudgetPercent: settings.rustBudgetPercent }, originalSettings);
});

test('identified historical CPU/JIT profiles preserve every original clock GC frame and signed-delta result', () => {
  for (const profile of profiles) {
    const expected = originalReader.analyzeProcess(profile.directory);
    const actual = analyzeProcess(profile.directory, historicalIdentity);
    assert.equal(actual.engine, 'jsdom');
    assert.equal(actual.sourceReportRevision, settings.revision);
    assert.equal(actual.sourceTelemetryRevision, originalPolicy.revision);
    const comparable = Object.fromEntries(Object.keys(expected).map((name) => [name, actual[name]]));
    assert.deepEqual(comparable, { ...expected, revision: policy.revision });
    assert.equal(actual.spans.length, 12); assert.equal(actual.accepted, null); assert.equal(actual.gateReevaluated, false);
  }
});
test('historical jsdom telemetry cannot borrow a native or new-capture identity', () => {
  const profile = profiles[0];
  assert.throws(() => analyzeProcess(profile.directory, { ...historicalIdentity, engine: 'rustdom' }), { code: 'ERR_ASSERTION' });
  assert.throws(() => analyzeProcess(profile.directory, { ...historicalIdentity, reportRevision: policy.revision }), { code: 'ERR_ASSERTION' });
  assert.throws(() => analyzeProcess(profile.directory, { ...historicalIdentity, telemetryRevision: policy.revision }), { code: 'ERR_ASSERTION' });
});
test('a corrupted jsdom report cannot claim native release without a native baseline', () => {
  withCorruptedReport((report) => { report.engine = 'rustdom'; }, (temporary) => {
    assert.throws(() => analyzeProcess(temporary, { ...historicalIdentity, engine: 'rustdom' }), {
      code: 'ERR_ASSERTION', message: 'Native telemetry: missing native class baseline' });
  });
});
test('missing release rounds or a report-supplied weaker requirement cannot claim release', () => {
  for (const change of [(report) => { report.batches[0].cleanupTrace = []; },
    (report) => { delete report.batches[0].cleanupTrace; },
    (report) => { report.batches[0].cleanupTrace = report.batches[0].cleanupTrace.slice(-2); },
    (report) => { report.settings.requiredClearRounds = 0; }]) {
    withCorruptedReport(change, (temporary) => assert.throws(() => analyzeProcess(temporary, historicalIdentity), { code: 'ERR_ASSERTION' }));
  }
});
test('a report cannot omit spans by declaring a smaller measurement plan', () => {
  withCorruptedReport((report) => {
    report.settings.warmupSamples = 0; report.settings.measuredSamples = 0;
    report.batches[0].sampleTimings = []; report.batches[0].samplesMs = [];
  }, (temporary) => assert.throws(() => analyzeProcess(temporary, historicalIdentity), { code: 'ERR_ASSERTION' }));
});
test('an incomplete batch or omitted owner observations cannot claim complete release', () => {
  for (const change of [(report) => { report.batches[0].complete = false; },
    (report) => { delete report.batches[0].trackedOwners.window; }]) {
    withCorruptedReport(change, (temporary) => assert.throws(() => analyzeProcess(temporary, historicalIdentity), { code: 'ERR_ASSERTION' }));
  }
});
