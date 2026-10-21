/** @file Exercises descriptive calculations against the real immutable benchmark archive. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const { analyze } = require('./main-affinity-precision.cjs');
const archive = path.join(__dirname, 'main-affinity/2026-10-21');
const result = analyze(archive);

test('covers both versions, phases, engines and all workloads without collecting or accepting measurements', () => {
  assert.equal(result.rows.length, 64); assert.equal(result.measurementsCollected, 0);
  assert.equal(result.gateReevaluated, false);
  assert.deepEqual(result.sources.map((source) => source.studyAccepted), [false, false]);
  assert.equal(result.sources.reduce((sum, source) => sum + source.processes, 0), 128);
  assert.equal(result.sources.reduce((sum, source) => sum + source.measuredDurations, 0), 9216);
});

test('retains all process/sample counts in the full result and both complete balanced partitions', () => {
  for (const row of result.rows) {
    assert.equal(row.full.groups.A.processes, 8); assert.equal(row.full.groups.B.processes, 8);
    assert.equal(row.full.groups.A.measuredDurations, 72); assert.equal(row.full.groups.B.measuredDurations, 72);
    assert.equal(row.halves.length, 2); assert.equal(row.adjacentPairs.length, 4);
    for (const label of ['A', 'B']) {
      assert.equal(row.halves.reduce((sum, half) => sum + half.groups[label].measuredDurations, 0), 72);
      assert.equal(row.adjacentPairs.reduce((sum, pair) => sum + pair.groups[label].measuredDurations, 0), 72);
    }
  }
});

test('separate analyses do not share mutable rows or interpretation limits', () => {
  const first = analyze(archive);
  first.rows.length = 0; first.limits.length = 0;
  const second = analyze(archive);
  assert.equal(second.rows.length, 64); assert.ok(second.limits.length > 0);
  assert.deepEqual(second, result);
});

test('preserves the reported over-budget contrast and exposes its distinct balanced halves', () => {
  const row = result.rows.find((row) => row.node === 'v22.12.0' && row.phase === 'AB' && row.engine === 'rustdom' && row.key === 'mutation-records-collect/100');
  assert.equal(row.full.changePercent, 5.0576444768901);
  assert.equal(row.halves[0].changePercent, 6.870588981041581);
  assert.equal(row.halves[1].changePercent, 1.4253387544140406);
  assert.ok(row.adjacentPairs.some((pair) => pair.changePercent < 0));
  assert.ok(row.adjacentPairs.some((pair) => pair.changePercent > 5));
});

test('requires the complete two-version archive rather than silently analyzing one version', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rustdom-precision-scope-'));
  try {
    fs.cpSync(path.join(archive, 'node-22'), path.join(directory, 'node-22'), { recursive: true });
    assert.throws(() => analyze(directory), { code: 'ERR_ASSERTION' });
  } finally {
    assert.equal(path.dirname(fs.realpathSync(directory)), fs.realpathSync(os.tmpdir()));
    fs.rmSync(directory, { recursive: true });
  }
});

test('the real CLI publishes the full diagnostic and leaves original indices unchanged', () => {
  const indexPaths = ['node-22', 'node'].map((directory) => path.join(archive, directory, 'index.json'));
  const before = indexPaths.map((filename) => fs.readFileSync(filename));
  const cliResult = spawnSync(process.execPath, [path.join(__dirname, 'main-affinity-precision.cjs'), archive], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  assert.equal(cliResult.status, 0, cliResult.stderr);
  assert.deepEqual(JSON.parse(cliResult.stdout), result);
  for (const [index, filename] of indexPaths.entries()) assert.deepEqual(fs.readFileSync(filename), before[index]);
});
