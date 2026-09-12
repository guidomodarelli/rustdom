/** @file Checks collection while public native readers and pending body reads outlive environment teardown. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

for (const mode of ['normal', 'vm']) {
  test(`should release Documents and Windows when retained form readers outlive ${mode} teardown`, () => {
    const child = spawnSync(process.execPath, ['--expose-gc', path.join(__dirname, 'helpers/formdata-realm-memory.cjs'), mode], {
      cwd: path.join(__dirname, '..'), encoding: 'utf8', timeout: 120_000, maxBuffer: 8 * 1024 * 1024,
    });
    if (child.error) throw child.error;
    assert.equal(child.status, 0, child.stderr || child.stdout);
    const report = JSON.parse(child.stdout);
    assert.equal(report.pass, true);
    assert.equal(report.observedDocuments, 24);
    assert.equal(report.observedWindows, 24);
    for (const batch of report.batches) {
      assert.deepEqual(batch.pending.state.survivors, { documents: 0, windows: 0 });
      assert.deepEqual(batch.settled.state.survivors, { documents: 0, windows: 0 });
    }
  });
}
