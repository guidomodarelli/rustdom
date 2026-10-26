/** @file Behavioral regressions over a real functional criterion and its independently generated source expectation. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createHash } = require('node:crypto');
const test = require('node:test');
const { verifyCriterion, physicalFiles } = require('./verify.cjs');
const policy = require('../constants/capture.json');
const fixture = process.env[policy.criterionFixtureEnvironment];
const expectationFile = process.env[policy.criterionExpectedEnvironment];
assert.ok(fixture && expectationFile, 'Provide the real functional criterion and its external source expectation');
const expected = JSON.parse(fs.readFileSync(expectationFile, 'utf8'));
assert.equal(expected.mode, policy.functionalMode);
const read = (root, name) => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
const write = (root, name, value) => fs.writeFileSync(path.join(root, name), JSON.stringify(value, null, 2) + '\n');

/** @param {function(string):void} callback - Changes only a fresh owned copy. @returns {void} Preserve original real raw fixtures after every adversarial case. */
function changed(callback) {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'rustdom-pilot-replay-'));
  const root = path.join(temporary, 'criterion');
  try { fs.cpSync(fixture, root, { recursive: true, errorOnExist: true }); callback(root); }
  finally {
    assert.equal(path.dirname(fs.realpathSync(temporary)), fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(temporary).startsWith('rustdom-pilot-replay-'));
    fs.rmSync(temporary, { recursive: true });
  }
}
/** Rebuild attacker-controlled inventory to prove metadata consistency cannot replace the external source or public behavior. */
function reindex(root) {
  const files = Object.fromEntries(physicalFiles(root).filter((name) => name !== policy.inventoryFile).map((name) => {
    const raw = fs.readFileSync(path.join(root, name)); return [name, { bytes: raw.length, sha256: createHash('sha256').update(raw).digest('hex') }];
  }));
  write(root, policy.inventoryFile, { revision: policy.revision, files, dataOnly: true });
}

test('replays every original factor and separate Window/Document endpoints without statistical observations', () => {
  const result = verifyCriterion(fixture, expected);
  assert.equal(result.complete, true); assert.equal(result.totals.processes, 32);
  assert.equal(result.totals.measured, 4608); assert.equal(result.totals.warmup, 1536);
  assert.equal(result.totals.windows, 384); assert.equal(result.totals.documents, 384);
  assert.equal(result.analysis, null); assert.equal(result.performanceAccepted, null);
  assert.equal(result.transportAuthenticationPerformed, false);
});
test('rejects raw-byte corruption before trusting any same-archive declaration', () => changed((root) => {
  fs.appendFileSync(path.join(root, 'workers/0000/report.json'), '\nchanged');
  assert.throws(() => verifyCriterion(root, expected));
}));
test('coherent archive hashes cannot replace the independent source identity or source graph', () => {
  for (const mutate of [
    (index) => { index.sourceIdentity.sourceCommit = 'b'.repeat(40); },
    (index) => { index.sourceFiles['unreviewed.cjs'] = '0'.repeat(64); }
  ]) changed((root) => {
    const index = read(root, policy.indexFile); mutate(index); write(root, policy.indexFile, index); reindex(root);
    assert.throws(() => verifyCriterion(root, expected));
  });
});
test('a partial remains explicitly incomplete even if every saved task is valid', () => changed((root) => {
  const index = read(root, policy.indexFile); index.complete = false;
  write(root, policy.indexFile, index); reindex(root);
  assert.throws(() => verifyCriterion(root, expected));
  const result = verifyCriterion(root, { ...expected, requireComplete: false });
  assert.equal(result.complete, false); assert.equal(result.analysis, null); assert.equal(result.performanceAccepted, null);
}));
test('complete claims cannot omit or reorder planned processes', () => {
  for (const mutate of [
    (index) => { index.processes.pop(); },
    (index) => { [index.processes[0], index.processes[1]] = [index.processes[1], index.processes[0]]; }
  ]) changed((root) => {
    const index = read(root, policy.indexFile); mutate(index); write(root, policy.indexFile, index); reindex(root);
    assert.throws(() => verifyCriterion(root, { ...expected, requireComplete: false }));
  });
});
test('rehashed raw output and cleanup substitutions are rejected by the public task/resource contract', () => {
  for (const mutate of [
    (report) => { report.blocks[0].tasks[0].outputHash = '0'.repeat(64); },
    (report) => { report.cleanupTrace.at(-1).clear = false; },
    (report) => { report.measurement.warmupSamplesMs.pop(); }
  ]) changed((root) => {
    const report = read(root, 'workers/0000/report.json'); mutate(report);
    write(root, 'workers/0000/report.json', report); reindex(root);
    assert.throws(() => verifyCriterion(root, expected));
  });
});
test('cannot promote a functional criterion into the scientific collection', () => {
  assert.throws(() => verifyCriterion(fixture, { ...expected, mode: policy.captureMode }));
});
test('parent snapshots cannot disappear while process coverage remains complete', () => changed((root) => {
  const index = read(root, policy.indexFile); index.parentMemory.pop(); write(root, policy.indexFile, index); reindex(root);
  assert.throws(() => verifyCriterion(root, expected));
}));
test('coherently scaled task clocks cannot exceed the independently recorded process duration', () => changed((root) => {
  const report = read(root, 'workers/0000/report.json');
  for (const block of report.blocks) for (const task of block.tasks) { task.startMs *= 1_000_000; task.durationMs *= 1_000_000; }
  report.measurement.blocks = report.blocks;
  report.measurement.measuredSamplesMs = report.blocks.filter((block) => block.stage === 'measured').flatMap((block) => block.tasks.map((task) => task.durationMs));
  report.measurement.warmupSamplesMs = report.blocks.filter((block) => block.stage === 'warmup').flatMap((block) => block.tasks.map((task) => task.durationMs));
  write(root, 'workers/0000/report.json', report); reindex(root);
  assert.throws(() => verifyCriterion(root, expected), /task interval exceeds/);
}));
