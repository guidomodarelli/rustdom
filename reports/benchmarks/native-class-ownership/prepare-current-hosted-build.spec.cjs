/** @file Validates real current-input builds and their resource reports, preserving legacy rejection contracts. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const current = require('./prepare-current-hosted-build.cjs');
const legacy = require('./prepare-hosted-build.cjs');
const recipe = require('./constants/current-hosted-build.cjs');
const legacyRecipe = require('./constants/hosted-build.cjs');
const contracts = require('./constants/current-build-contracts.cjs');
const archive = process.env.RUSTDOM_HOSTED_BUILD_ARCHIVE;
const legacyArchive = process.env.RUSTDOM_LEGACY_HOSTED_BUILD_ARCHIVE;
assert.ok(archive && legacyArchive, 'Provide actual v2 and original v1 build archives');

/** Own only a checked temporary directory; never mutate the supplied archives. */
function temporary(context) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), contracts.preparationDirectoryPrefix));
  context.after(() => {
    const resolved = fs.realpathSync(directory);
    assert.equal(path.dirname(resolved), fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith(contracts.preparationDirectoryPrefix));
    fs.rmSync(resolved, { recursive: true });
  });
  return directory;
}

test('verifies the actual fresh candidate and its preserved inputs without granting timing acceptance', () => {
  const identity = current.verify(archive);
  assert.equal(identity.verified, true);
  assert.equal(identity.measurementExecuted, false); assert.equal(identity.performanceAccepted, null);
  assert.equal(identity.inputs.policy, recipe.revision);
  assert.deepEqual(Object.keys(identity.distributions), ['A0', 'A1', 'B', 'J0', 'J1']);
});

test('both real Node workers preserve public output, allocation isolation and separate realm release', () => {
  const identity = current.verify(archive);
  assert.equal(contracts.functionalReports.length, recipe.validationNodeVersions.length);
  for (const { filename, node } of contracts.functionalReports) {
    const report = JSON.parse(fs.readFileSync(path.join(path.dirname(archive), filename)));
    assert.equal(current.verifyFunctionalReport(report, identity).verified, true);
    assert.equal(report.node, node); assert.equal(report.results.length, 15);
    assert.equal(report.observedWindows, 15); assert.equal(report.observedDocuments, 15);
    for (const endpoint of Object.values(report.endpoints)) {
      assert.equal(endpoint.reached, true);
      assert.deepEqual(endpoint.state.survivors, { window: 0, document: 0 });
    }
  }
});

test('legacy and current readers reject relabeling each other while the original archive stays valid', () => {
  assert.equal(legacy.verify(legacyArchive).verified, true);
  assert.throws(() => legacy.verify(archive));
  assert.throws(() => current.verify(legacyArchive));
});

test('input-policy variants cannot misdeclare the shared tool and command contract', () => {
  assert.throws(() => legacy.verify(legacyArchive, { recipe: { ...legacyRecipe, npm: 'undeclared' } }),
    /must preserve tools, commands and resource settings/);
});

test('the actual current-build CLI returns the independently verified archive identity', () => {
  const child = spawnSync(process.execPath, [path.join(__dirname, 'prepare-current-hosted-build.cjs'), '--verify', archive],
    { encoding: 'utf8', timeout: recipe.validationTimeoutMs });
  assert.ifError(child.error); assert.equal(child.status, 0, child.stderr);
  assert.deepEqual(JSON.parse(child.stdout), current.verify(archive));
});

test('relocated real packages preserve integrity and execute their public behavior and release again', (context) => {
  const directory = temporary(context); const relocated = path.join(directory, 'archive');
  fs.cpSync(archive, relocated, { recursive: true, verbatimSymlinks: true });
  assert.deepEqual(current.verify(relocated), current.verify(archive));
  const child = spawnSync(process.execPath, ['--expose-gc', path.join(__dirname, 'current-hosted-build-worker.cjs'), relocated],
    { encoding: 'utf8', timeout: recipe.validationTimeoutMs });
  assert.ifError(child.error); assert.equal(child.status, 0, child.stderr);
  assert.equal(current.verifyFunctionalReport(JSON.parse(child.stdout), current.verify(relocated)).verified, true);
});

test('rejects tampered real build inputs, stale functional identity and falsely clear owners', (context) => {
  const directory = temporary(context); const damaged = path.join(directory, 'archive');
  fs.cpSync(archive, damaged, { recursive: true, verbatimSymlinks: true });
  fs.appendFileSync(path.join(damaged, 'sources/build.rs'), '\n// Changed archived input.\n');
  assert.throws(() => current.verify(damaged));
  const identity = current.verify(archive);
  const report = JSON.parse(fs.readFileSync(path.join(path.dirname(archive), 'ownership-node24.json')));
  report.integrity.preparationId = 'stale-preparation';
  assert.throws(() => current.verifyFunctionalReport(report, identity), /belongs to another preparation/);
  report.integrity = identity; report.endpoints.B.trace.at(-1).survivors.window = 1;
  assert.throws(() => current.verifyFunctionalReport(report, identity));
});

test('the real fresh CLI rejects inherited compiler overrides before creating output', (context) => {
  const directory = temporary(context); const output = path.join(directory, 'output');
  const child = spawnSync(process.execPath, [path.join(__dirname, 'prepare-current-hosted-build.cjs'),
    path.join(archive, 'baseline-sources'), path.join(archive, 'sources'), output],
    { encoding: 'utf8', env: { ...process.env, RUSTFLAGS: '-C opt-level=0' }, timeout: recipe.validationTimeoutMs });
  assert.ifError(child.error); assert.equal(child.status, 2); assert.match(child.stderr, /undeclared RUSTFLAGS/);
  assert.equal(fs.existsSync(output), false);
});
