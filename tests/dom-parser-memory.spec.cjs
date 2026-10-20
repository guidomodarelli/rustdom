/** @file Verifies actual DOMParser recovery lifetimes in a separate GC-enabled process. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { TEST_TIMEOUT_MS } = require('../scripts/constants/dom-parser-memory.cjs');

test('should release Window, Document, recovered Text and errors after repeated XML recovery', () => {
  const child = spawnSync(process.execPath, ['--expose-gc', 'tests/helpers/dom-parser-memory.cjs'], {
    encoding: 'utf8', timeout: TEST_TIMEOUT_MS,
  });
  assert.equal(child.error, undefined);
  assert.equal(child.status, 0, child.stdout + child.stderr);
  assert.equal(JSON.parse(child.stdout).pass, true);
});
