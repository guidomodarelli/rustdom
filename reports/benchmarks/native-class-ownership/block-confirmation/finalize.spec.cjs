/** @module confirmation-finalization-regressions Exercises real child GC/SIGTERM instead of mocking the platform. */
'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

for (const mode of ['complete', 'signal-during-gc', 'signal-during-postflight', 'deadline-during-gc', 'deadline-during-postflight']) {
  test('actual qualification finalization: ' + mode, () => {
    const child = spawnSync(process.execPath, ['--expose-gc', path.join(__dirname, 'fixtures/finalization-signal.cjs'), mode],
      { encoding: 'utf8', timeout: 10000 });
    assert.equal(child.status, 0, child.stderr); assert.equal(child.signal, null);
    const observed = JSON.parse(child.stdout);
    assert.equal(observed.complete, mode === 'complete');
    if (mode.startsWith('signal')) assert.equal(observed.cancelled, true);
  });
}
