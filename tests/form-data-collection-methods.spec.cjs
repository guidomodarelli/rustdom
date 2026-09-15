/** @file Verifies real FormData operations and consistency after host prototype mutations. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { join } = require('node:path');

for (const mode of ['default', 'vm']) {
  test(`should preserve FormData collection method contracts in ${mode}`, async (context) => {
    // Arrange and act in an isolated process; the parent runner's platform methods remain intact.
    const child = spawnSync(process.execPath, [join(__dirname, 'helpers/form-data-collection-methods.cjs'), mode], {
      encoding: 'utf8', timeout: 120_000, maxBuffer: 4 * 1024 * 1024,
    });
    assert.ifError(child.error); assert.equal(child.status, 0, child.stderr || child.stdout);
    const report = JSON.parse(child.stdout);
    assert.equal(report.cases.length, 21);
    for (const sample of report.cases) {
      await context.test(`should retain entries when ${sample.collection}.prototype.${sample.method} is ${sample.mutation}`, () => {
        // Assert the public reference contract and continued usability after restoring the method.
        assert.equal(sample.jsdom.error, undefined);
        assert.deepEqual(sample.rustdom, sample.jsdom);
        assert.equal(sample.rustdom.reads, 0);
        assert.equal(sample.rustdom.postError, undefined);
        assert.equal(sample.rustdom.postValue, 'replacement');
        assert.deepEqual(sample.rustdom.result.empty, []);
        assert.deepEqual(sample.rustdom.result.all, ['one', 'two']);
        assert.equal(sample.rustdom.result.fileIdentity, true);
        assert.deepEqual(sample.rustdom.result.mutated, [['text', 'replacement']]);
        assert.deepEqual(sample.rustdom.result.cached, [['duplicate', 'replacement'], ['kept', { name: 'input.txt', size: 7, type: 'text/plain' }]]);
      });
    }
  });
}
