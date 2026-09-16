/** @file Checks that native length extraction does not retain its ID views or buffers. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
test('should release native ID arrays and buffers after repeated length extraction', () => {
  const child = spawnSync(process.execPath, ['--expose-gc', 'tests/helpers/formdata-native-length-memory.cjs'], { encoding: 'utf8', timeout: 120_000 });
  assert.equal(child.error, undefined); assert.equal(child.status, 0, child.stdout + child.stderr);
  const result = JSON.parse(child.stdout); assert.equal(result.pass, true); assert.equal(result.cycles, 6);
});
