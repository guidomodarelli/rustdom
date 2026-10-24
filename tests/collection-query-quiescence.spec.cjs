/** @file Verifies collection-specific waiting with actual owners, late release and persistent-retention failures. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { TEST_TIMEOUT_MS } = require('../scripts/constants/collection-query-memory.cjs');

for (const engine of ['jsdom', 'rustdom']) {
  test(`requires real release after the original observation cap and rejects retained ${engine} collections`, () => {
    const child = spawnSync(process.execPath, ['--expose-gc', path.join(__dirname, 'helpers/collection-query-quiescence-worker.cjs'), engine],
      { encoding: 'utf8', timeout: TEST_TIMEOUT_MS });
    assert.equal(child.error, undefined, child.stderr);
    assert.equal(child.status, 0, child.stderr);
    const report = JSON.parse(child.stdout);
    assert.equal(report.pass, true);
    assert.deepEqual(report.cases.map((scenario) => scenario.mode), ['default', 'vm']);
    for (const scenario of report.cases) {
      assert.equal(scenario.original.reached, false);
      assert.equal(scenario.retained.reached, false);
      assert.equal(scenario.released.reached, true);
      assert.ok(scenario.released.trace.length >= 14);
      assert.ok(scenario.released.trace.slice(-2).every((state) => state.clear));
      assert.equal(scenario.cleanup.reached, true);
    }
  });
}
