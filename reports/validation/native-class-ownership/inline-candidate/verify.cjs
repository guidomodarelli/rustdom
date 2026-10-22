/** @file Rechecks the archived C validation without loading a native addon. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { gunzipSync } = require('node:zlib');
const archive = path.resolve(process.argv[2] ?? __dirname);
const repository = path.resolve(archive, '../../../..');
const { assertWptParity } = require(path.join(repository, 'tests/wpt/comparison.cjs'));
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const readJson = (filename) => JSON.parse(fs.readFileSync(path.join(archive, filename), 'utf8'));
const validation = readJson('validation.json');
const observations = [];
for (const record of validation.records) {
  const stored = fs.readFileSync(path.join(archive, record.path));
  assert.equal(stored.length, record.bytes, record.path);
  assert.equal(digest(stored), record.sha256, record.path);
  const raw = record.gzip ? gunzipSync(stored) : stored;
  assert.equal(raw.length, record.rawBytes, record.path);
  assert.equal(digest(raw), record.rawSha256, record.path);
  if (record.source.endsWith('.json')) observations.push({ record, report: JSON.parse(raw) });
}
const wpt = observations.filter(({ record }) => record.source.startsWith('reports/compatibility/') && record.source.endsWith('-wpt.json'));
assert.equal(wpt.length, 2);
for (const { report } of wpt) {
  assert.equal(report.pass, true);
  assert.equal(report.results.length, 240);
  for (const row of report.results) assertWptParity(row.file, row.actual, row.expected);
  assert.equal(report.results.reduce((count, row) => count + row.actual.tests.length, 0), 83007);
  assert.equal(report.results.reduce((count, row) => count + row.actual.tests.filter((test) => test.status !== 0).length, 0), 1203);
}
const packages = observations.filter(({ record, report }) => record.source.startsWith('reports/distribution/') && Array.isArray(report.runs));
assert.equal(packages.length, 2);
for (const { report } of packages) {
  assert.equal(report.pass, true);
  assert.equal(report.runs.length, 20);
  for (const run of report.runs) {
    assert.equal(run.exitCode, 0);
    assert.equal(run.signal, null);
  }
  assert.equal(report.artifact.native.binarySha256, validation.candidateBinarySha256);
}
const memory = observations.filter(({ record }) => /^reports\/memory\/[^/]+-linux-x64.json$/.test(record.source));
assert.equal(memory.length, 2);
assert.deepEqual(memory.map(({ report }) => report.node).sort(), ['v22.12.0', 'v24.14.1']);
for (const { report } of memory) {
  assert.equal(report.nativeBinarySha256, validation.candidateBinarySha256);
  assert.equal(report.pass, true);
  assert.equal(report.results.length, 5);
  for (const result of report.results) {
    assert.equal(result.pass, true);
    assert.equal(result.survivingDocuments, 0);
    assert.equal(result.survivingWindows, 0);
  }
}
process.stdout.write(`${JSON.stringify({ verified: true, records: validation.records.length,
  wptFixtures: 480, packageGates: 40, memoryModes: 10, candidateBinarySha256: validation.candidateBinarySha256,
  scope: 'Archived observations; no native execution or performance acceptance.' }, null, 2)}\n`);
