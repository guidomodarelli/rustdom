/** @file Verifies bounded native/name caches while a real FormData and parent realm remain alive. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');

test('should release removed FormData host owners and foreign realms after repeated churn', () => {
  const child = spawnSync(process.execPath, ['--expose-gc', 'tests/helpers/formdata-host-values-memory.cjs'], { encoding: 'utf8', timeout: 120_000, maxBuffer: 4 * 1024 * 1024 });
  assert.equal(child.error, undefined); assert.equal(child.signal, null); assert.equal(child.status, 0, child.stdout + child.stderr);
  const result = JSON.parse(child.stdout); assert.equal(result.pass, true); assert.equal(result.cycles, 6);
});
