/** @file Compares real AbortSignal ownership with an independent jsdom under host intrinsic replacement. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { resolve } = require('node:path');

/** Each mutation was reproduced independently against the pinned reference before changing the adapter. */
const scenarios = ['finalizer-delete', 'Map.constructor', 'WeakMap.constructor', 'WeakRef.constructor',
  'Map.get', 'Map.set', 'Map.has', 'Map.delete', 'Map.size', 'WeakMap.get', 'WeakMap.set', 'WeakMap.delete',
  'WeakRef.deref', 'FinalizationRegistry.register'];

for (const scenario of scenarios) {
  test(`should preserve real abort ownership when ${scenario} changes after initialization`, () => {
    const outcomes = [];
    for (const engine of ['jsdom', 'rustdom']) {
      const childEnvironment = { ...process.env };
      delete childEnvironment.NODE_TEST_CONTEXT;
      delete childEnvironment.ABORT_INTRINSIC_REPORT;
      const child = spawnSync(process.execPath, ['--expose-gc', 'tests/helpers/abort-intrinsics.cjs', engine, scenario], {
        cwd: resolve(__dirname, '..'), env: childEnvironment, encoding: 'utf8', timeout: 30_000,
      });
      assert.equal(child.error, undefined, `${engine}: ${child.error?.message}`);
      assert.equal(child.signal, null, `${engine}: ${child.signal}`);
      assert.equal(child.status, 0, `${engine}: ${child.stdout}\n${child.stderr}`);
      const result = JSON.parse(child.stdout.trim());
      assert.equal(result.pass, true);
      assert.equal(result.calls, 0);
      assert.deepEqual(result.uncaught, []);
      outcomes.push({ trace: result.trace, survivingSignals: result.survivingSignals, witnessed: result.witnessed,
        survivingDocument: result.survivingDocument, survivingWindow: result.survivingWindow });
    }
    assert.deepEqual(outcomes[1], outcomes[0]);
  });
}
