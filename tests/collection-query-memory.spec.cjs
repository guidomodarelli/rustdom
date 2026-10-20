/** @file Verifies live collection retention and release with real runtimes in a GC-enabled child process. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { TEST_TIMEOUT_MS } = require('../scripts/constants/collection-query-memory.cjs');

test('should release live collections, their nodes, Documents and Windows after owners are dropped', () => {
  const child = spawnSync(process.execPath, ['--expose-gc', 'tests/helpers/collection-query-memory.cjs'], { encoding: 'utf8', timeout: TEST_TIMEOUT_MS });
  assert.equal(child.error, undefined, child.stderr);
  assert.equal(child.status, 0, child.stdout + child.stderr);
  assert.equal(JSON.parse(child.stdout).pass, true);
});
