/** @file Recomputes the real affinity diagnostic and rejects corrupted CPU, masks, lifetime and acceptance claims. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createHash } = require('node:crypto');
const { verify } = require('./thread-diagnostic.cjs');
const archive = path.join(__dirname, 'thread-affinity/2026-10-21');
const read = (filename) => JSON.parse(fs.readFileSync(filename));
const write = (filename, value) => fs.writeFileSync(filename, JSON.stringify(value, null, 2) + '\n');

/** Work only on private flat copies of actual reports; no fake distributions, clocks or observations. */
function withChangedReport(change, check) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rustdom-thread-evidence-'));
  try {
    for (const filename of fs.readdirSync(archive)) fs.copyFileSync(path.join(archive, filename), path.join(directory, filename));
    const indexPath = path.join(directory, 'index.json');
    const index = read(indexPath);
    const run = index.runs.find((entry) => entry.engine === 'rustdom');
    const reportPath = path.join(directory, run.report);
    const report = read(reportPath);
    change(index, report);
    write(reportPath, report);
    index.files[run.report] = createHash('sha256').update(fs.readFileSync(reportPath)).digest('hex');
    write(indexPath, index);
    check(directory);
  } finally {
    for (const filename of fs.readdirSync(directory)) fs.unlinkSync(path.join(directory, filename));
    fs.rmdirSync(directory);
  }
}

test('recomputes every real affinity observation without accepting candidate performance', () => {
  const result = verify(archive);
  assert.equal(result.verified, true); assert.equal(result.processes, 8);
  assert.equal(result.measuredDurations, 144); assert.equal(result.copiesIncludingWarmup, 192000);
  assert.equal(result.accepted, false);
});

test('rejects CPU timestamps in reverse order even after updating the report hash', () => {
  withChangedReport((index, report) => {
    const timing = report.samples[0].timing;
    [timing.threadCpuStartMs, timing.threadCpuEndMs] = [timing.threadCpuEndMs, timing.threadCpuStartMs];
  }, (directory) => { assert.throws(() => verify(directory), { code: 'ERR_ASSERTION' }); });
});

test('rejects the main thread running on a different CPU even after updating the report hash', () => {
  withChangedReport((index, report) => {
    report.affinity.configured.find((entry) => entry.tid === report.pid).mask = '0';
  }, (directory) => { assert.throws(() => verify(directory), { code: 'ERR_ASSERTION' }); });
});

test('rejects a retained native Range at a required endpoint even after updating the report hash', () => {
  withChangedReport((index, report) => {
    report.samples[0].cleanupTrace.at(-1).released.live = 1;
  }, (directory) => { assert.throws(() => verify(directory), { code: 'ERR_ASSERTION', actual: 1, expected: 0 }); });
});

test('rejects an acceptance claim for a diagnostic that did not execute candidate B', () => {
  withChangedReport((index) => { index.accepted = true; },
    (directory) => { assert.throws(() => verify(directory), { code: 'ERR_ASSERTION', actual: true, expected: false }); });
});
