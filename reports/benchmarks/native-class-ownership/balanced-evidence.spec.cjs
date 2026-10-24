/** @file Verifies the completed real diagnostic and rejects altered acceptance, output, assignments and release evidence. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createHash } = require('node:crypto');
const { verify } = require('./balanced-experiment.cjs');
const archive = path.join(__dirname, 'balanced/2026-10-21');
const readJson = (filename) => JSON.parse(fs.readFileSync(filename));
const writeJson = (filename, value) => fs.writeFileSync(filename, JSON.stringify(value, null, 2) + '\n');

/** Mutate a private physical copy of real observations; never modify the measured archive or use hardlinks. */
function withArchiveCopy(check) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rustdom-balanced-evidence-'));
  try {
    for (const filename of fs.readdirSync(archive)) fs.copyFileSync(path.join(archive, filename), path.join(directory, filename));
    check(directory);
  } finally {
    for (const filename of fs.readdirSync(directory)) fs.unlinkSync(path.join(directory, filename));
    fs.rmdirSync(directory);
  }
}

/** Refresh the inner hash deliberately so contracts are checked beyond accidental file corruption. */
function changeReport(directory, modify) {
  const indexPath = path.join(directory, 'index.json');
  const index = readJson(indexPath);
  const run = index.runs.find((entry) => entry.engine === 'rustdom');
  const reportPath = path.join(directory, run.report);
  const report = readJson(reportPath);
  modify(report);
  writeJson(reportPath, report);
  index.files[run.report] = createHash('sha256').update(fs.readFileSync(reportPath)).digest('hex');
  writeJson(indexPath, index);
}

test('recalculates the complete real diagnostic without accepting candidate performance', () => {
  const result = verify(archive);
  assert.equal(result.verified, true); assert.equal(result.processes, 16);
  assert.equal(result.measuredDurations, 576); assert.equal(result.copiesIncludingWarmup, 768000);
  assert.equal(result.calibrated, false); assert.equal(result.accepted, false);
});

test('rejects a candidate acceptance claim even when all real A/A observations remain intact', () => {
  withArchiveCopy((directory) => {
    const filename = path.join(directory, 'index.json');
    const index = readJson(filename); index.accepted = true; writeJson(filename, index);
    assert.throws(() => verify(directory), { code: 'ERR_ASSERTION', actual: true, expected: false });
  });
});

test('rejects an incorrect public result even if its report hash is refreshed', () => {
  withArchiveCopy((directory) => {
    changeReport(directory, (report) => { report.samples[0].result = 0; });
    assert.throws(() => verify(directory), { code: 'ERR_ASSERTION', actual: 0, expected: 500 });
  });
});

test('rejects an incorrect physical assignment even if its report hash is refreshed', () => {
  withArchiveCopy((directory) => {
    changeReport(directory, (report) => { report.schedule.roots.B = report.schedule.roots.A; });
    assert.throws(() => verify(directory), { code: 'ERR_ASSERTION' });
  });
});

test('rejects retained native ranges at a required clear endpoint even if its report hash is refreshed', () => {
  withArchiveCopy((directory) => {
    changeReport(directory, (report) => {
      report.samples[0].cleanupTrace.at(-1).released.live = 1;
      report.samples[0].released.live = 1;
    });
    assert.throws(() => verify(directory), { code: 'ERR_ASSERTION', actual: 1, expected: 0 });
  });
});
