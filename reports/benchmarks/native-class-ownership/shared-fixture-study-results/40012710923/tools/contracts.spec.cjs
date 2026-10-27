/** @file Resource-reader regressions over the genuine existing 80-worker qualification; no new DOM or timing capture. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createAnalyzer } = require('./analyze.cjs');
const repository = path.resolve(process.env.SHARED_STUDY_REPOSITORY);
const directory = path.resolve(process.env.SHARED_WORKER_EVIDENCE);
const reader = createAnalyzer(repository);
const read = (filename) => JSON.parse(fs.readFileSync(filename, 'utf8'));
const index = read(path.join(directory, 'index.json'));
const records = index.processes.map((entry, ordinal) => read(path.join(directory,
  entry.node === 'v22.12.0' ? 'node22' : 'node24', String(ordinal % (index.processes.length / 2)).padStart(3, '0'), 'report.json')));

test('all genuine qualified workers retain separate Window/Document and final native baselines', () => {
  const totals = { windows: 0, documents: 0, warmupSpans: 0, measuredSpans: 0, requiredFinalClearStates: 0 };
  for (const record of records) {
    const summary = reader.summarizeWorker(record);
    for (const name of Object.keys(totals)) totals[name] += summary[name];
    if (record.engine === 'rustdom') assert.equal(summary.nativeClassFinal, summary.nativeClassBaseline);
    else assert.equal(summary.nativeClassFinal, null);
  }
  assert.deepEqual(totals, { windows: 960, documents: 960, warmupSpans: 240, measuredSpans: 720, requiredFinalClearStates: 160 });
});
test('missing Window tracking cannot be reported as zero survivors', () => {
  const record = structuredClone(records[0]); delete record.batches[0].trackedOwners.window;
  assert.throws(() => reader.summarizeWorker(record), { code: 'ERR_ASSERTION' });
});
test('a retained Window at the final boundary prevents a release claim', () => {
  const record = structuredClone(records[0]); const endpoint = record.batches[0].cleanupTrace.at(-1);
  endpoint.survivors.window = 1; endpoint.clear = false;
  assert.throws(() => reader.summarizeWorker(record), { code: 'ERR_ASSERTION' });
});
test('a substituted native baseline cannot borrow a clear endpoint', () => {
  const record = structuredClone(records.find((entry) => entry.engine === 'rustdom'));
  record.nativeBaseline.napiClasses.live++;
  assert.throws(() => reader.summarizeWorker(record), { code: 'ERR_ASSERTION' });
});
test('functional qualification cannot be promoted into a complete new performance study', () => {
  const parent = fs.realpathSync(os.tmpdir()); const temporary = fs.mkdtempSync(path.join(parent, 'rustdom-study-result-'));
  const output = path.join(temporary, 'analysis');
  try {
    assert.throws(() => reader.analyze(directory, output), { code: 'ERR_ASSERTION' });
    assert.equal(fs.existsSync(output), false);
  } finally { assert.equal(path.dirname(temporary), parent); fs.rmdirSync(temporary); }
});
test('an output parent symlink cannot place analysis inside the original archive', () => {
  const parent = fs.realpathSync(os.tmpdir()); const temporary = fs.mkdtempSync(path.join(parent, 'rustdom-study-alias-'));
  const alias = path.join(temporary, 'archive-alias'); const name = 'analysis-should-not-exist';
  fs.symlinkSync(fs.realpathSync(directory), alias, 'dir');
  try {
    assert.throws(() => reader.analyze(directory, path.join(alias, name)), {
      code: 'ERR_ASSERTION', message: 'Shared study analysis: preserve the original archive tree' });
    assert.equal(fs.existsSync(path.join(directory, name)), false);
  } finally { fs.unlinkSync(alias); fs.rmdirSync(temporary); }
});
