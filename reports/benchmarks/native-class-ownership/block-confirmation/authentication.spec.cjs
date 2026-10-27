/** @module historical-authentication-contracts Exercises a real pinned Git source, sealed package and adversarial disposable clones; no DOM or platform mocks. */
'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { inspectSource, authenticatePackage } = require('./authentication.cjs');
const policy = require('./constants/authentication.json');
const worker = require('./constants/worker.json');
const source = process.env[policy.authenticationSourceEnvironment];
const prepared = process.env[worker.functionalPackageEnvironment];

/** @param {object} context - Test lifecycle. @returns {string} Explicitly owned disposable fixture root. */
function temporary(context) {
  const parent = fs.realpathSync(os.tmpdir());
  const root = fs.mkdtempSync(path.join(parent, 'rustdom-historical-authentication-'));
  context.after(() => {
    const resolved = fs.realpathSync(root);
    assert.ok(resolved.startsWith(parent + path.sep));
    assert.ok(path.basename(resolved).startsWith('rustdom-historical-authentication-'));
    fs.rmSync(resolved, { recursive: true });
  });
  return root;
}

/** @param {string} directory - Real disposable Git root. @param {string[]} args - Real Git operation. @param {string} [input] - Exact sparse patterns. @returns {string} Original output. */
function git(directory, args, input) {
  const result = spawnSync('git', ['-c', 'gc.auto=0', '-c', 'maintenance.auto=false', ...args], {
    cwd: directory, encoding: 'utf8', input, timeout: policy.commandTimeoutMs, maxBuffer: policy.maximumCommandBytes });
  assert.equal(result.status, 0, result.stderr.slice(0, 4096));
  return result.stdout;
}

/** @param {string} directory - Owned empty fixture parent. @param {string} name - Simple fixture directory. @returns {string} Native Git metadata referencing immutable objects without copying or transferring repository history. */
function referenceFixture(directory, name) {
  const root = path.join(directory, name);
  git(directory, ['init', root]);
  const originalObjects = path.join(fs.realpathSync(source), '.git', 'objects');
  fs.writeFileSync(path.join(root, '.git/objects/info/alternates'), originalObjects + '\n', { flag: 'wx' });
  git(root, ['update-ref', 'HEAD', policy.sourceCommit]);
  return root;
}

test('real historical Git source authenticates all 903 pins without claiming current producer identity', () => {
  const result = inspectSource(source);
  assert.equal(result.sourceCommit, policy.sourceCommit); assert.equal(result.sourceChangesRaw, '');
  assert.deepEqual(result.sourceGitErrors, []); assert.equal(Object.keys(result.files).length, 903);
  assert.equal(result.currentProducerIdentityReplaced, false); assert.equal(result.DOMExecuted, false);
  assert.equal(result.performanceAccepted, null); assert.equal(result.gateReevaluated, false);
  result.reviewedReaderBindings.script.sha256 = '0'.repeat(64);
  assert.deepEqual(inspectSource(source).reviewedReaderBindings, policy.readerBindings,
    'Caller-owned metadata must not mutate the private reader bindings');
});

test('actual package verifier agrees with the selected artifact in the pinned SDK and preserves prior output', (context) => {
  const directory = temporary(context);
  const result = authenticatePackage(prepared, directory, 'verification', source);
  assert.equal(result.verified, true); assert.equal(result.artifactId, worker.selectedArtifactId);
  assert.equal(result.nativeBinarySha256, worker.nativeBinarySha256);
  assert.equal(result.historicalSource.sourceCommit, policy.sourceCommit);
  assert.equal(result.historicalSource.currentProducerIdentityReplaced, false);
  const stdout = fs.readFileSync(path.join(directory, 'verification.stdout.log'));
  const stderr = fs.readFileSync(path.join(directory, 'verification.stderr.log'));
  assert.throws(() => authenticatePackage(prepared, directory, 'verification', source));
  assert.deepEqual(fs.readFileSync(path.join(directory, 'verification.stdout.log')), stdout);
  assert.deepEqual(fs.readFileSync(path.join(directory, 'verification.stderr.log')), stderr);
  assert.throws(() => authenticatePackage(prepared, source, 'protected', source), /outside source and package/);
  assert.throws(() => authenticatePackage(prepared, directory, '../escape', source));
});

test('archive/package directories and dirty real Git fixtures cannot impersonate the original clean source', (context) => {
  const directory = temporary(context);
  assert.throws(() => inspectSource(prepared));
  const clone = referenceFixture(directory, 'dirty-metadata-fixture');
  assert.equal(git(clone, ['rev-parse', 'HEAD']).trim(), policy.sourceCommit);
  const before = git(clone, ['status', '--porcelain=v1', '--untracked-files=normal']);
  assert.notEqual(before, '');
  assert.throws(() => inspectSource(clone), /preserve foreign changes/);
  assert.equal(git(clone, ['status', '--porcelain=v1', '--untracked-files=normal']), before);
});

test('independent hashes reject a changed compiler input even when disposable Git metadata reports clean', (context) => {
  const directory = temporary(context);
  const clone = referenceFixture(directory, 'hash-contract-fixture');
  git(clone, ['config', 'core.autocrlf', 'false']);
  git(clone, ['read-tree', 'HEAD']);
  git(clone, ['sparse-checkout', 'init', '--no-cone']);
  const inspected = inspectSource(source);
  const names = [...Object.keys(inspected.files), policy.receipt.path];
  git(clone, ['sparse-checkout', 'set', '--no-cone', '--stdin'], names.map((name) => '/' + name).join('\n') + '\n');
  git(clone, ['read-tree', '--reset', '-u', 'HEAD']);
  const initialStatus = git(clone, ['status', '--porcelain=v1', '--untracked-files=normal']);
  assert.ok(initialStatus === '', 'The disposable sparse Git fixture must start clean: ' + initialStatus.split('\n').slice(0, 3).join(' | '));
  const target = path.join(clone, 'Cargo.toml');
  const original = fs.readFileSync(target);
  fs.appendFileSync(target, '\n');
  git(clone, ['update-index', '--assume-unchanged', '--', 'Cargo.toml']);
  assert.ok(git(clone, ['status', '--porcelain=v1', '--untracked-files=normal']) === '', 'The disposable assume-unchanged fixture must have genuinely empty Git status');
  assert.notEqual(createHash('sha256').update(fs.readFileSync(target)).digest('hex'),
    createHash('sha256').update(original).digest('hex'));
  assert.throws(() => inspectSource(clone), /frozen input changed: Cargo.toml/);
  assert.deepEqual(fs.readFileSync(target), Buffer.concat([original, Buffer.from('\n')]));
});
