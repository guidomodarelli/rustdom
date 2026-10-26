/** @file Verifies a real Node shutdown regression before expensive Windows runtime qualification. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const settings = require('./constants/windows-node-exit.cjs');

for (let repetition = 0; repetition < settings.PROCESS_REPETITIONS; repetition += 1) {
  test(`Node completes real redirect failure and process teardown without an addon (${repetition})`, (context) => {
    const child = spawnSync(process.execPath, [path.join(__dirname, 'fixtures/windows-node-exit.cjs')], {
      encoding: 'utf8', timeout: settings.CHILD_TIMEOUT_MS, maxBuffer: settings.MAX_PROCESS_OUTPUT_BYTES,
    });
    context.diagnostic(JSON.stringify({ node: process.version, repetition, pid: child.pid,
      exitCode: child.status, signal: child.signal, stdout: child.stdout, stderr: child.stderr,
      error: child.error ? { code: child.error.code, message: child.error.message } : null }));
    assert.ifError(child.error);
    assert.equal(child.status, 0, 'Node platform shutdown failed; retain stderr and use the patched Node 24 SDK on Windows');
    assert.equal(child.signal, null);
    const report = JSON.parse(child.stdout);
    assert.equal(report.node, process.version);
    assert.equal(report.pid, child.pid);
    assert.equal(report.redirectRejected, true);
    assert.ok(report.requests > 1, 'The loopback server must receive actual redirects before shutdown');
    assert.deepEqual(report.loadedAddonFiles, []);
    assert.throws(() => process.kill(child.pid, 0), { code: 'ESRCH' });
  });
}
