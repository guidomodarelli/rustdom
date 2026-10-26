/** @file Exercises actual qualified controls, filesystem copies, symlinks and Git metadata without loading DOM. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test, before, after } = require('node:test');
const { prepare, verify } = require('./baselines.cjs');
const { fingerprint, captureSourceIdentity } = require('../range-collapse-packages/identity.cjs');
const original = require('../range-collapse-study/preparation.cjs');
const policy = require('./constants/baselines.json');
const historicalRoot = fs.realpathSync.native(process.env[policy.test.sourceEnvironment]);
const root = fs.mkdtempSync(path.join(os.tmpdir(), policy.test.prefix));
let beforeIdentity;

before(() => { beforeIdentity = original.createManifest(historicalRoot); });
after(() => {
  assert.deepEqual(original.createManifest(historicalRoot), beforeIdentity);
  const actual = fs.realpathSync.native(root);
  assert.equal(path.dirname(actual), fs.realpathSync.native(os.tmpdir()));
  assert.ok(path.basename(actual).startsWith(policy.test.prefix));
  fs.rmSync(actual, { recursive: true });
});

test('public CLI copies and verifies exactly four controls with original dependencies and provenance', () => {
  const output = path.join(root, 'public-cli');
  const result = spawnSync(process.execPath, [path.join(__dirname, 'baselines.cjs'), '--prepare', historicalRoot, output],
    { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const prepared = JSON.parse(result.stdout);
  assert.equal(prepared.verified, true);
  assert.deepEqual(prepared.distributions, policy.distributions);
  assert.equal(prepared.dependenciesSha256, policy.dependenciesSha256);
  assert.equal(prepared.runtimeExecuted, false); assert.equal(prepared.benchmarkExecuted, false);
  assert.equal(prepared.performanceAccepted, null); assert.equal(prepared.gateReevaluated, false);
  assert.equal(prepared.baselineCompilerProvenance.commit, policy.baselineCompilerCommit);
  assert.deepEqual(prepared.sourceTransportIdentity, captureSourceIdentity(path.join(output, policy.paths.sources)));
  assert.equal(fs.existsSync(path.join(output, policy.paths.packages, 'B')), false);
  assert.deepEqual(verify(output), prepared);
});

test('does not accept a changed binary even when the local distribution ledger is resealed', () => {
  const output = path.join(root, 'altered-binary'); prepare(historicalRoot, output);
  const directory = path.join(output, policy.paths.packages, 'A0');
  const binary = path.join(directory, 'dist/rustdom.node');
  const bytes = fs.readFileSync(binary); bytes[0] ^= 1; fs.writeFileSync(binary, bytes);
  const indexFile = path.join(output, policy.paths.index); const index = JSON.parse(fs.readFileSync(indexFile, 'utf8'));
  index.distributions.A0 = fingerprint(directory, policy.nativeParts);
  fs.writeFileSync(indexFile, JSON.stringify(index));
  assert.throws(() => verify(output), /changed distribution A0/);
});

test('rejects a same-byte runtime symlink that would alias another physical control', () => {
  const output = path.join(root, 'aliased-runtime'); prepare(historicalRoot, output);
  const filename = path.join(output, policy.paths.packages, 'A0/dist/index.cjs');
  const originalBytes = fs.readFileSync(filename); fs.unlinkSync(filename);
  fs.symlinkSync('../../A1/dist/index.cjs', filename);
  assert.deepEqual(fs.readFileSync(filename), originalBytes);
  assert.throws(() => verify(output), /runtime-resolution links/);
});

test('does not replace actual snapshot Git errors with an invented clean compiler checkout', () => {
  const output = path.join(root, 'invented-provenance'); prepare(historicalRoot, output);
  const indexFile = path.join(output, policy.paths.index); const index = JSON.parse(fs.readFileSync(indexFile, 'utf8'));
  index.sourceTransportIdentity = { ...index.sourceTransportIdentity,
    sourceCommit: policy.baselineCompilerCommit, sourceChanges: [], sourceGitErrors: [] };
  fs.writeFileSync(indexFile, JSON.stringify(index));
  assert.throws(() => verify(output), /actual transported snapshot Git metadata/);
});

test('rejects a same-byte native hardlink shared by two physical controls', () => {
  const output = path.join(root, 'hardlinked-runtime'); prepare(historicalRoot, output);
  const filename = path.join(output, policy.paths.packages, 'A0/dist/rustdom.node');
  const other = path.join(output, policy.paths.packages, 'A1/dist/rustdom.node');
  const originalBytes = fs.readFileSync(filename); fs.unlinkSync(filename); fs.linkSync(other, filename);
  assert.deepEqual(fs.readFileSync(filename), originalBytes);
  assert.equal(fs.lstatSync(filename).ino, fs.lstatSync(other).ino);
  assert.throws(() => verify(output), /independently owned runtime files/);
});

test('preserves existing destinations and rejects output overlap before copying', () => {
  const existing = path.join(root, 'existing'); fs.mkdirSync(existing);
  const marker = path.join(existing, 'foreign.txt'); fs.writeFileSync(marker, 'original bytes\n');
  assert.throws(() => prepare(historicalRoot, existing), /preserve existing destination/);
  assert.equal(fs.readFileSync(marker, 'utf8'), 'original bytes\n');
  const overlap = path.join(historicalRoot, policy.test.prefix + 'overlap');
  assert.throws(() => prepare(historicalRoot, overlap), /overlaps protected input/);
  assert.equal(fs.existsSync(overlap), false);
});
