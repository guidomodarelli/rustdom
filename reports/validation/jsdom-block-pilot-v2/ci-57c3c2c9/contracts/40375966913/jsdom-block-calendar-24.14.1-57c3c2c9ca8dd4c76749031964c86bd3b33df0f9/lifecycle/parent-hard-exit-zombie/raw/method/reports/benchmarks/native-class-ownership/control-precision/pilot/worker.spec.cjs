'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');
const { workerArguments } = require('./worker.cjs');
const policy = require('./constants/worker.json');
const protocol = require('../../combined-process-study/constants/protocol.json');

test('worker flags preserve all sixteen original factors and reject undeclared positions', () => {
  for (const [factor, seed] of protocol.v8Seeds.entries()) {
    assert.deepEqual(workerArguments(factor), ['--expose-gc', '--random-seed=' + seed, '--hash-seed=' + seed]);
  }
  assert.throws(() => workerArguments(-1)); assert.throws(() => workerArguments(protocol.v8Seeds.length));
});

test('real worker CLI rejects scientific mode and missing arguments with controlled diagnostics', () => {
  for (const args of [[], ['--capture'], [policy.functionalOption]]) {
    const result = spawnSync(process.execPath, [path.join(__dirname, 'worker.cjs'), ...args], { encoding: 'utf8', timeout: policy.authenticationTimeoutMs });
    assert.equal(result.error, undefined); assert.equal(result.status, policy.failureExitCode); assert.equal(result.stdout, '');
    const error = JSON.parse(result.stderr);
    assert.equal(error.operation, 'Pilot functional worker');
    assert.match(error.message, /only explicit functional mode|provide manifest, input and new report/);
  }
});

test('real qualifier CLI cannot activate a scientific sequence', () => {
  const result = spawnSync(process.execPath, [path.join(__dirname, 'functional.cjs'), '--capture', 'unused-package', 'unused-output'],
    { encoding: 'utf8', timeout: policy.authenticationTimeoutMs });
  assert.equal(result.error, undefined); assert.equal(result.status, policy.failureExitCode); assert.equal(result.stdout, '');
  const error = JSON.parse(result.stderr);
  assert.equal(error.operation, 'Pilot functional qualification'); assert.match(error.message, /only functional mode is implemented/);
});
