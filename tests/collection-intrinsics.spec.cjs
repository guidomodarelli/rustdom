/** @file Verifies immutable typed-array transport through public generic HTMLCollections. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { join } = require('node:path');

for (const mode of ['default', 'vm']) {
  test(`should preserve generic collection transport in ${mode}`, async (context) => {
    // Mutations are confined to a child process and restored by the real-runtime fixture.
    const child = spawnSync(process.execPath, [join(__dirname, 'helpers/collection-intrinsics.cjs'), mode], {
      encoding: 'utf8', timeout: 120_000, maxBuffer: 4 * 1024 * 1024,
    });
    assert.ifError(child.error);
    assert.equal(child.status, 0, child.stderr || child.stdout);
    const report = JSON.parse(child.stdout);
    assert.equal(report.cases.length, mode === 'vm' ? 96 : 48);
    for (const sample of report.cases) {
      await context.test(`should preserve ${sample.stage} ${sample.kind} after ${sample.scope} becomes ${sample.mutation}`, () => {
        assert.equal(sample.jsdom.error, undefined);
        assert.deepEqual(sample.rustdom, sample.jsdom);
        assert.equal(sample.rustdom.reads, 0);
        assert.deepEqual(sample.rustdom.result, { length: 2, firstIdentity: true, addedIdentity: true,
          indexIdentity: true, names: ['0', '1', 'first', 'first-name', 'added', 'added-name'], missing: null,
          renamedIdentity: true, removedName: null,
          refreshedNames: ['0', '1', 'renamed', 'first-name', 'added', 'added-name'] });
      });
    }
  });
}
