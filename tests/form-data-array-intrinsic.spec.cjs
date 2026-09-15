/** @file Verifies Array constructor/factory replacement through real FormData contracts. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { join } = require('node:path');
for (const mode of ['default', 'vm']) {
  test(`should preserve FormData array projections in ${mode}`, async (context) => {
    // Arrange and act with isolated host-global mutations and an independent jsdom reference.
    const child = spawnSync(process.execPath, [join(__dirname, 'helpers/form-data-array-intrinsic.cjs'), mode], {
      encoding: 'utf8', timeout: 120_000, maxBuffer: 4 * 1024 * 1024,
    });
    assert.ifError(child.error); assert.equal(child.status, 0, child.stderr || child.stdout);
    const report = JSON.parse(child.stdout); assert.equal(report.cases.length, 6);
    for (const sample of report.cases) await context.test(`should return fields when Array ${sample.scope} is ${sample.mutation}`, () => {
      // Assert returned values, ordering and File identity without source inspection.
      assert.equal(sample.jsdom.error, undefined); assert.deepEqual(sample.rustdom, sample.jsdom);
      assert.equal(sample.rustdom.reads, 0);
      assert.deepEqual(sample.rustdom.result, { values: ['first', 'second'], missing: [], fileIdentity: true, names: ['field', 'file', 'field'] });
    });
  });
}
