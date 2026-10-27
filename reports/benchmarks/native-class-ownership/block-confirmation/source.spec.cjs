/** @module confirmation-current-source-contracts Profiles real native Git roots and mutated physical copies; never imports archived code or starts DOM. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync, spawnSync } = require('node:child_process');
const test = require('node:test');
const { inspectCurrentSource, filesDigest } = require('./source.cjs');
const authentication = require('./constants/authentication.json');
const production = require('./constants/production.json');
const sourcePolicy = require('./constants/source.json');
const current = process.env[production.sourceEnvironment];
const historical = process.env[authentication.authenticationSourceEnvironment];
assert.ok(current && historical, 'Confirmation source contracts: provide actual current/original native Git roots');

/** @param {object} context - Test owner. @returns {string} Independent owned native Git fixture; no checkout or clone downloads history. */
function copyCurrent(context) {
  const original = inspectCurrentSource(current, historical);
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'confirmation-source-profile-'));
  context.after(() => fs.rmSync(directory, { recursive: true }));
  execFileSync('git', ['init', '--quiet', directory]);
  const objects = fs.realpathSync(path.join(current, '.git/objects'));
  fs.writeFileSync(path.join(directory, '.git/objects/info/alternates'), objects + '\n');
  execFileSync('git', ['update-ref', 'HEAD', original.sourceCommit], { cwd: directory });
  execFileSync('git', ['config', 'core.sparseCheckout', 'true'], { cwd: directory });
  fs.writeFileSync(path.join(directory, '.git/info/sparse-checkout'), Object.keys(original.currentFiles).map((name) => '/' + name).join('\n') + '\n');
  execFileSync('git', ['read-tree', '-mu', 'HEAD'], { cwd: directory });
  for (const name of Object.keys(original.currentFiles)) {
    const filename = path.join(directory, name); fs.mkdirSync(path.dirname(filename), { recursive: true });
    fs.copyFileSync(path.join(current, name), filename);
  }
  assert.equal(inspectCurrentSource(directory, historical).productionCompilerInputs.matchesSelectedCompilerInputs, true);
  return directory;
}

test('current and original native Git identities remain distinct and every historical digest stays intact', () => {
  const result = inspectCurrentSource(current, historical);
  assert.equal(result.sourceCommit, execFileSync('git', ['rev-parse', 'HEAD'], { cwd: current, encoding: 'utf8' }).trim());
  assert.equal(result.sourceChangesRaw, execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], { cwd: current, encoding: 'utf8' }));
  assert.deepEqual(result.sourceGitErrors, []);
  assert.equal(result.historicalSource.sourceCommit, authentication.sourceCommit);
  assert.equal(result.historicalSource.sourceChangesRaw, '');
  assert.equal(Object.keys(result.historicalSource.files).length, 903);
  assert.equal(result.currentFilesSha256, filesDigest(result.currentFiles));
  assert.equal(result.productionCompilerInputs.inputCount, 344);
  for (const [relative, expected] of Object.entries(result.productionCompilerInputs.observedInputs)) {
    assert.equal(result.currentFiles[relative], expected, 'All actual compiler inputs, including root files and types, must be bound');
  }
  assert.equal(result.profiledReaderMatchesCurrentInspector, true);
  const bridge = result.changedHistoricalMembers.find((entry) => entry.path === 'src/dom/native-tree.cjs');
  assert.ok(bridge); assert.notEqual(bridge.originalSha256, bridge.currentSha256);
  for (const field of ['historicalPinsRewritten', 'currentProducerIdentityReplaced', 'packageAuthenticatedHere',
    'scientificCaptureEnabled', 'executionReady', 'scientificCaptureExecuted', 'gateReevaluated']) assert.equal(result[field], false);
  assert.equal(result.performanceAccepted, null);
});

test('the actual inspect CLI does not start or authorize a scientific sequence', () => {
  const cli = path.join(__dirname, 'source.cjs');
  const child = spawnSync(process.execPath, [cli, '--inspect', current, historical], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  assert.ifError(child.error); assert.equal(child.status, 0, child.stderr);
  assert.equal(JSON.parse(child.stdout).executionReady, false);
  const forbidden = spawnSync(process.execPath, [cli, '--capture', current, historical], { encoding: 'utf8' });
  assert.ifError(forbidden.error); assert.equal(forbidden.status, 2); assert.equal(forbidden.stdout, '');
  assert.match(forbidden.stderr, /scientific execution is not enabled/);
});

test('a copied current profile preserves its real dirty Git state and rejects changed Rust compiler inputs', (context) => {
  const root = copyCurrent(context);
  const before = inspectCurrentSource(root, historical);
  assert.equal(before.sourceCommit, execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim());
  assert.equal(before.sourceChangesRaw, execFileSync('git', ['status', '--porcelain', '--untracked-files=all'],
    { cwd: root, encoding: 'utf8', maxBuffer: sourcePolicy.maximumGitCommandBytes }));
  fs.appendFileSync(path.join(root, 'src/dom/range_state.rs'), '\n');
  assert.throws(() => inspectCurrentSource(root, historical), /compiler inputs differ/);
});

test('an undeclared local build override cannot borrow the matching candidate source profile', (context) => {
  const root = copyCurrent(context); fs.writeFileSync(path.join(root, '.npmrc'), 'ignore-scripts=true\n');
  assert.throws(() => inspectCurrentSource(root, historical), /compiler inputs differ/);
});

test('changed selected archive bytes cannot borrow the original sealed package identity', (context) => {
  const root = copyCurrent(context);
  fs.appendFileSync(path.join(root, 'reports/validation/range-numeric-composed-package/20261026/packages.tar.xz'), '\n');
  assert.throws(() => inspectCurrentSource(root, historical), /selected package archive changed/);
});

test('different profiled inspector bytes cannot be described as the current source reader', (context) => {
  const root = copyCurrent(context);
  fs.appendFileSync(path.join(root, 'reports/benchmarks/native-class-ownership/block-confirmation/source.cjs'), '\n');
  assert.throws(() => inspectCurrentSource(root, historical), /profiled reader differs/);
});

test('the same source root cannot replace the original authentication role', () => {
  assert.throws(() => inspectCurrentSource(current, current), /roles must remain separate/);
});

test('a Windows-style gitfile or a source snapshot without native Git cannot masquerade as producer identity', (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'confirmation-source-gitfile-'));
  context.after(() => fs.rmSync(root, { recursive: true }));
  fs.writeFileSync(path.join(root, '.git'), 'gitdir: C:/not-a-native-checkout\n');
  assert.throws(() => inspectCurrentSource(root, historical), /actual native Git directory required/);
});
