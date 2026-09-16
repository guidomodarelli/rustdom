/** @file Verifies that failed real iterator/conversion calls leave no native lists or realm roots. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');

test('should collect failed FormData iterator owners and each realm after repeated errors', () => {
  const child = spawnSync(process.execPath, ['--expose-gc', 'tests/helpers/formdata-iterator-errors-memory.cjs'], {
    encoding: 'utf8', timeout: 120_000, maxBuffer: 4 * 1024 * 1024,
  });
  assert.equal(child.error, undefined);
  assert.equal(child.signal, null);
  assert.equal(child.status, 0, `${child.stdout}\n${child.stderr}`);
  const result = JSON.parse(child.stdout);
  assert.equal(result.pass, true);
  assert.equal(result.cycles, 6);
});
