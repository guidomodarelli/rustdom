/** @file Exercises the real cold-cleanup preparation and its ownership/public behavior contracts. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const preparation = require('./prepare.cjs');
const recipe = require('./constants/protocol.cjs');
const policy = require('./constants/inputs.json');
const archive = process.env[policy.environment.archive];
assert.ok(archive, 'Cold cleanup contracts: provide a real prepared archive');
const read = (filename) => JSON.parse(fs.readFileSync(filename, 'utf8'));
const hash = (filename) => createHash('sha256').update(fs.readFileSync(filename)).digest('hex');

/** @param {object} context - Real test context. @returns {string} New temporary directory with scoped cleanup. */
function temporary(context) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), policy.temporaryDirectoryPrefix));
  context.after(() => {
    const resolved = fs.realpathSync(directory);
    assert.equal(path.dirname(resolved), fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith(policy.temporaryDirectoryPrefix));
    fs.rmSync(resolved, { recursive: true });
  });
  return directory;
}

test('authenticates the five actual packages and qualified sources without timing acceptance', () => {
  const identity = preparation.verify(archive);
  assert.equal(identity.verified, true);
  assert.equal(identity.measurementExecuted, false);
  assert.equal(identity.performanceAccepted, null);
  assert.equal(identity.inputs.sources.A, policy.baselineSourceHash);
  assert.equal(identity.inputs.sources.B, policy.candidateSourceHash);
  assert.deepEqual(Object.keys(identity.distributions), ['A0', 'A1', 'B', 'J0', 'J1']);
  const index = read(path.join(archive, policy.archive.index));
  assert.equal(index.sourceProvenance.A.sourceCommit, policy.baselineCommit);
  assert.notEqual(hash(path.join(archive, 'packages/A0/dist/rustdom.node')),
    hash(path.join(archive, 'packages/B/dist/rustdom.node')), 'The baseline and candidate must not execute the same addon');
  const patch = read(path.join(path.dirname(archive), 'patch.json'));
  assert.equal(patch.before.sourceCommit, policy.candidateCommit);
  assert.deepEqual(patch.before.sourceChanges, []);
  assert.deepEqual(patch.before.sourceGitErrors, []);
  assert.equal(patch.after.sourceHash, policy.candidateSourceHash);
  assert.equal(patch.patchSha256, policy.patchSha256);
});

test('both real Node reports preserve public outputs and separate Window/Document release', () => {
  const identity = preparation.verify(archive);
  for (const { node, filename } of policy.functionalReports) {
    const report = read(path.join(path.dirname(archive), filename));
    assert.equal(preparation.verifyFunctionalReport(report, identity).verified, true);
    assert.equal(report.node, node);
    assert.equal(report.observedWindows, 15);
    assert.equal(report.observedDocuments, 15);
    for (const endpoint of Object.values(report.endpoints)) {
      assert.equal(endpoint.reached, true);
      assert.deepEqual(endpoint.state.survivors, { window: 0, document: 0 });
    }
  }
});

test('the real verification CLI returns the same authenticated identity', () => {
  const child = spawnSync(process.execPath, [path.join(__dirname, 'prepare.cjs'), '--verify', archive],
    { encoding: 'utf8', timeout: recipe.validationTimeoutMs });
  assert.ifError(child.error);
  assert.equal(child.status, 0, child.stderr);
  assert.deepEqual(JSON.parse(child.stdout), preparation.verify(archive));
});

test('relocated actual packages retain identity and execute their public lifecycle again', (context) => {
  const moved = path.join(temporary(context), 'archive');
  fs.cpSync(archive, moved, { recursive: true, verbatimSymlinks: true });
  assert.deepEqual(preparation.verify(moved), preparation.verify(archive));
  const child = spawnSync(process.execPath, ['--expose-gc', path.join(__dirname, 'worker.cjs'), moved],
    { encoding: 'utf8', timeout: recipe.validationTimeoutMs });
  assert.ifError(child.error);
  assert.equal(child.status, 0, child.stderr);
  assert.equal(preparation.verifyFunctionalReport(JSON.parse(child.stdout), preparation.verify(moved)).verified, true);
});

test('tampered actual inputs and resealed producer code cannot replace the reviewed preparation', (context) => {
  const damaged = path.join(temporary(context), 'archive');
  fs.cpSync(archive, damaged, { recursive: true, verbatimSymlinks: true });
  const source = path.join(damaged, 'sources', policy.guardPath);
  const before = fs.readFileSync(source);
  const changed = Buffer.from(before);
  changed[changed.length - 1] ^= 1;
  fs.writeFileSync(source, changed);
  assert.throws(() => preparation.verify(damaged));
  fs.writeFileSync(source, before);
  const name = 'reports/benchmarks/native-class-ownership/cold-cleanup-build/worker.cjs';
  const producerFile = path.join(damaged, 'sources', name);
  fs.appendFileSync(producerFile, Buffer.from([0]));
  const index = read(path.join(damaged, 'index.json'));
  index.files[`sources/${name}`] = hash(producerFile);
  fs.writeFileSync(path.join(damaged, 'index.json'), JSON.stringify(index));
  assert.throws(() => preparation.verify(damaged), /archived preparation source differs/);
});

test('stale identities and falsely clear Window endpoints are rejected', () => {
  const identity = preparation.verify(archive);
  const report = read(path.join(path.dirname(archive), policy.functionalReports[0].filename));
  report.integrity.preparationId = 'stale-cold-preparation';
  assert.throws(() => preparation.verifyFunctionalReport(report, identity));
  report.integrity = identity;
  report.endpoints.B.trace.at(-1).survivors.window = 1;
  assert.throws(() => preparation.verifyFunctionalReport(report, identity));
});

test('inherited compiler overrides fail before any build output is created', (context) => {
  const output = path.join(temporary(context), 'output');
  const child = spawnSync(process.execPath, [path.join(__dirname, 'prepare.cjs'),
    path.join(archive, 'baseline-sources'), path.join(archive, 'sources'), output],
    { encoding: 'utf8', env: { ...process.env, RUSTFLAGS: '-C opt-level=0' }, timeout: recipe.validationTimeoutMs });
  assert.ifError(child.error);
  assert.equal(child.status, 2);
  assert.match(child.stderr, /undeclared RUSTFLAGS/);
  assert.equal(fs.existsSync(output), false);
});

test('the patch cannot be reapplied to already-qualified sources', () => {
  const source = path.join(archive, 'sources');
  const before = hash(path.join(source, policy.guardPath));
  assert.throws(() => preparation.applyCandidatePatch(source), /unpatched sources differ/);
  assert.equal(hash(path.join(source, policy.guardPath)), before);
});
