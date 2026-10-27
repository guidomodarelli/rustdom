/** @file Replay the actual preserved workers and reject corrupted observable evidence without another DOM execution. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { test } = require('node:test');
const { validateWorker, validateSeedGroups } = require('./results.cjs');
const fixture = require('./constants/replay-fixtures.json');
const repository = path.resolve(__dirname, '../../../..');
const read = (filename) => JSON.parse(fs.readFileSync(filename, 'utf8'));
const digest = (filename) => createHash('sha256').update(fs.readFileSync(filename)).digest('hex');
assert.equal(digest(path.join(repository, fixture.manifestPath)), fixture.manifestSha256);
const files = read(path.join(repository, fixture.manifestPath)).files;

/** Read only data authenticated by the independently pinned committed fixture manifest. */
function authenticated(relative) {
  const filename = path.join(repository, fixture.root, relative);
  assert.equal(digest(filename), files[fixture.root + '/' + relative]);
  return read(filename);
}
const manifest = authenticated(fixture.physicalManifest);
const entries = [];
for (const [node, directory] of Object.entries(fixture.versions)) {
  const summary = authenticated(directory + '/workers/summary.json');
  for (const entry of summary.cases.filter((entry) => /^\d+$/.test(entry.name))) {
    entries.push({ input: entry.input, expected: { node, pid: entry.pid, mode: 'functional' },
      report: authenticated(directory + '/workers/' + entry.name + '/report.json') });
  }
}
assert.equal(entries.length, 64);
const native = entries.find((entry) => entry.input.engine === 'rustdom' && entry.input.label === 'B');
const reference = entries.find((entry) => entry.input.engine === 'jsdom');

/** Mutate a fresh decoded data copy, never the preserved files or any internal runtime library. */
function rejects(change, base = native) {
  const copy = structuredClone(base); change(copy);
  assert.throws(() => validateWorker(copy.report, manifest, copy.input, copy.expected));
}

test('both SDK captures replay all 64 genuine functional workers with every task, warmup and owner', () => {
  let measured = 0; let warmup = 0; let windows = 0; let documents = 0;
  for (const entry of entries) {
    const result = validateWorker(entry.report, manifest, entry.input, entry.expected);
    measured += result.samplesMs.length; warmup += result.warmupSamplesMs.length;
    windows += result.observedWindows; documents += result.observedDocuments;
    assert.equal(result.performanceAccepted, null); assert.equal(result.gateReevaluated, false);
  }
  assert.equal(measured, 9216); assert.equal(warmup, 3072);
  assert.equal(windows, 768); assert.equal(documents, 768);
});
test('matched startup RNG prefixes remain identical within each complete original factor group', () => {
  for (const node of Object.keys(fixture.versions)) validateSeedGroups(entries.filter((entry) => entry.expected.node === node)
    .map((entry) => ({ ...entry.input, observation: entry.report })));
});
test('functional data cannot be promoted to an enabled scientific capture', () => {
  rejects((entry) => { entry.expected.mode = 'capture'; });
});
test('the invocation PID, SDK, V8 startup seed and canonical process tuple cannot change', () => {
  rejects((entry) => { entry.expected.pid += 1; });
  rejects((entry) => { entry.expected.node = entry.expected.node === 'v22.12.0' ? 'v24.14.1' : 'v22.12.0'; });
  rejects((entry) => { entry.report.execArgv[1] = '--random-seed=99'; });
  rejects((entry) => { entry.report.rowIndex = (entry.report.rowIndex + 1) % 8; });
});
test('dropping the first measured task or warmup is rejected without repairing missing samples', () => {
  rejects((entry) => { entry.report.blocks[3].tasks.shift(); });
  rejects((entry) => { entry.report.measurement.warmupSamplesMs.shift(); });
  rejects((entry) => { entry.report.blocks[0].stage = 'measured'; });
});
test('changed independent public output and overlapping task clocks are rejected', () => {
  rejects((entry) => { entry.report.blocks[0].tasks[0].outputHash = '0'.repeat(64); });
  rejects((entry) => { entry.report.blocks[0].tasks[1].startMs = entry.report.blocks[0].tasks[0].startMs; });
});
test('a different physical distribution or a second loaded package cannot hide behind a valid output', () => {
  rejects((entry) => { entry.report.distributionsAfter.B.sha256 = '0'.repeat(64); });
  rejects((entry) => { entry.report.loadedAfter.J0.push(manifest.copies.J0 + '/lib/api.js'); });
});
test('native baseline and endpoint families are required even when both could otherwise compare as undefined', () => {
  rejects((entry) => {
    delete entry.report.nativeBaseline.rangeStates;
    for (const state of entry.report.cleanupTrace) delete state.nativeTree.rangeStates;
  });
  rejects((entry) => { delete entry.report.cleanupTrace[2].nativeTree.napiClasses; });
});
test('a false clear claim, retained final owner and invalid memory snapshot remain rejected', () => {
  rejects((entry) => { entry.report.cleanupTrace[2].survivors.document = 1; });
  rejects((entry) => { entry.report.cleanupTrace[2].survivors.window = 1; entry.report.cleanupTrace[2].clear = false; });
  rejects((entry) => { delete entry.report.cleanupTrace[1].memory.rss; });
  rejects((entry) => { entry.report.cleanupTrace[2].nativeTree.napiClasses.cleanupErrors += 1; });
});
test('native resources cannot be relabeled as independent jsdom or vice versa', () => {
  rejects((entry) => { entry.report.nativeBaseline = null; });
  rejects((entry) => { entry.report.nativeBaseline = {}; }, reference);
});
test('main/background affinity evidence must preserve the declared CPU isolation', () => {
  rejects((entry) => { entry.report.affinitiesAfter.find((thread) => thread.tid === entry.expected.pid).mask = '0'; });
  rejects((entry) => {
    for (const thread of entry.report.affinity.configured) if (!thread.disappeared) thread.mask = '2';
  });
});
