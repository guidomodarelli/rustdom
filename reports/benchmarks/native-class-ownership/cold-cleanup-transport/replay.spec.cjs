/** @file Tests read-only replay against real hosted packages and altered copies, without creating a DOM. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { replay } = require('./replay.cjs');
const policy = require('./constants/transport.json');
const buildPolicy = require('../cold-cleanup-build/constants/inputs.json');
const archive = process.env[policy.environment.replayRoot];
assert.ok(archive, 'Cold replay contracts: provide the real extracted preparation');
const read = (filename) => JSON.parse(fs.readFileSync(filename, 'utf8'));
const write = (filename, data) => fs.writeFileSync(filename, JSON.stringify(data));

/** @param {object} context - Test context. @returns {string} Independent real fixture copy with scoped cleanup. */
function copy(context) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), policy.temporaryDirectoryPrefix));
  context.after(() => {
    const resolved = fs.realpathSync(directory);
    assert.equal(path.dirname(resolved), fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith(policy.temporaryDirectoryPrefix));
    fs.rmSync(resolved, { recursive: true });
  });
  const destination = path.join(directory, 'preparation');
  fs.cpSync(archive, destination, { recursive: true, verbatimSymlinks: true });
  return destination;
}

test('the actual hosted preparation and both recorded Node probes match the independent pin', () => {
  const result = replay(archive);
  assert.equal(result.verified, true);
  assert.deepEqual(result.identity, policy.preparationIdentity);
  assert.equal(result.replayExecutedDOM, false);
  assert.equal(result.measurementExecuted, false);
  assert.equal(result.performanceAccepted, null);
  assert.equal(result.gateReevaluated, false);
  assert.deepEqual(result.reports.map((report) => [report.node, report.windows, report.documents, report.finalClearStates]),
    [['v22.12.0', 15, 15, 10], ['v24.14.1', 15, 15, 10]]);
});

test('a changed saved identity is rejected without touching the original packages', (context) => {
  const damaged = copy(context);
  const filename = path.join(damaged, policy.replay.identityFile);
  const identity = read(filename);
  identity.preparationId = 'changed-preparation';
  write(filename, identity);
  assert.throws(() => replay(damaged));
});

test('a self-consistently relabeled index and reports cannot replace the hosted preparation', (context) => {
  const damaged = copy(context);
  const indexFile = path.join(damaged, policy.replay.buildDirectory, buildPolicy.archive.index);
  const index = read(indexFile);
  index.preparationId = 'self-resealed-preparation';
  write(indexFile, index);
  const identityFile = path.join(damaged, policy.replay.identityFile);
  const identity = read(identityFile);
  identity.preparationId = index.preparationId;
  write(identityFile, identity);
  for (const { filename } of buildPolicy.functionalReports) {
    const target = path.join(damaged, filename);
    const report = read(target);
    report.integrity = identity;
    write(target, report);
  }
  assert.throws(() => replay(damaged), /authenticated artifact/);
});

test('recorded Git failures cannot be normalized into a clean patched checkout', (context) => {
  const damaged = copy(context);
  const filename = path.join(damaged, buildPolicy.archive.patchReceipt);
  const patch = read(filename);
  patch.after.sourceGitErrors = [{ operation: 'status', exitCode: 128, signal: null, errorCode: null }];
  write(filename, patch);
  assert.throws(() => replay(damaged));
});

test('a retained Window in a falsely clear endpoint remains a resource failure', (context) => {
  const damaged = copy(context);
  const filename = path.join(damaged, buildPolicy.functionalReports[0].filename);
  const report = read(filename);
  report.endpoints.B.trace.at(-1).survivors.window = 1;
  report.endpoints.B.state.survivors.window = 1;
  write(filename, report);
  assert.throws(() => replay(damaged));
});
