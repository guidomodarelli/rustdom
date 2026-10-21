/** @file Checks complete real benchmark archives and rejects independently altered evidence without rerunning measurements. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createHash } = require('node:crypto');
const { verify } = require('./main-affinity-experiment.cjs');
const archiveRoot = process.env.RUSTDOM_MAIN_AFFINITY_ARCHIVE || path.join(__dirname, 'main-affinity/2026-10-21');
const readJson = (filename) => JSON.parse(fs.readFileSync(filename, 'utf8'));
const writeJson = (filename, value) => fs.writeFileSync(filename, JSON.stringify(value, null, 2) + '\n');

/** Mutate a private copy only; refresh the inner hash to test semantic verification beyond byte integrity. */
function withAlteredArchive(archive, change) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rustdom-main-affinity-evidence-'));
  try {
    fs.cpSync(archive, directory, { recursive: true });
    const indexPath = path.join(directory, 'index.json');
    const index = readJson(indexPath);
    const entry = index.runs.find((run) => run.phase === 'AB' && run.label === 'B' && run.engine === 'rustdom');
    const update = (filename, changeReport) => {
      const absolute = path.join(directory, filename);
      const report = readJson(absolute); changeReport(report); writeJson(absolute, report);
      index.files[filename] = createHash('sha256').update(fs.readFileSync(absolute)).digest('hex');
    };
    change(index, entry, update); writeJson(indexPath, index);
    assert.throws(() => verify(directory), { code: 'ERR_ASSERTION' });
  } finally {
    assert.equal(path.dirname(fs.realpathSync(directory)), fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(directory).startsWith('rustdom-main-affinity-evidence-'));
    fs.rmSync(directory, { recursive: true });
  }
}

for (const runtime of ['node-22', 'node']) {
  const archive = path.join(archiveRoot, runtime);

  test(`${runtime}: recomputes all 64 real processes and 4,608 durations without changing acceptance`, () => {
    const index = readJson(path.join(archive, 'index.json'));
    const result = verify(archive);
    assert.equal(result.verified, true); assert.equal(result.processes, 64);
    assert.equal(result.measuredDurations, 4608); assert.equal(result.accepted, index.accepted);
  });

  test(`${runtime}: rejects a false acceptance claim`, () => {
    withAlteredArchive(archive, (index) => { index.accepted = !index.accepted; });
  });

  test(`${runtime}: rejects wrong main affinity even after refreshing the metadata hash`, () => {
    withAlteredArchive(archive, (index, entry, update) => update(entry.metadata, (report) => {
      report.affinity.configured.find((thread) => thread.tid === report.pid).mask = '0';
    }));
  });

  test(`${runtime}: rejects the wrong treatment in the candidate phase`, () => {
    withAlteredArchive(archive, (index, entry) => { entry.treatment = 'A'; });
  });

  test(`${runtime}: rejects an omitted public row even after refreshing the stdout hash`, () => {
    withAlteredArchive(archive, (index, entry, update) => update(entry.stdout, (report) => { report.workloads.pop(); }));
  });

  test(`${runtime}: rejects a missing hash for a referenced raw report`, () => {
    withAlteredArchive(archive, (index, entry) => { delete index.files[entry.stdout]; });
  });

  test(`${runtime}: rejects divergent public output even after refreshing the stdout hash`, () => {
    withAlteredArchive(archive, (index, entry, update) => update(entry.stdout, (report) => {
      report.workloads[0].outputHash = '0'.repeat(64);
    }));
  });

  test(`${runtime}: rejects an addon identity different from the predeclared candidate`, () => {
    withAlteredArchive(archive, (index) => { index.binaries.B = index.binaries.A; });
  });
}
