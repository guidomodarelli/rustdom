/** @module inventory-runtime-source-contracts Exercises actual proposal/current files and physically mutated copies without loading DOM. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const test = require('node:test');
const { verifyMappedSources } = require('./sources.cjs');
const policy = require('./constants/correspondence.json');
const snapshot = process.env.RUSTDOM_INVENTORY_SOURCE_SNAPSHOT;
const runtime = process.env.RUSTDOM_INVENTORY_RUNTIME_SOURCE;
assert.ok(snapshot && runtime, 'Inventory source tests: provide the real proposal and current source roots');

/** @param {object} context - Real test owner. @returns {object} Independent physical files; original sources remain untouched. */
function copied(context) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'inventory-source-correspondence-'));
  context.after(() => fs.rmSync(directory, { recursive: true }));
  const copies = { snapshot: path.join(directory, 'snapshot'), runtime: path.join(directory, 'runtime') };
  const inputs = JSON.parse(fs.readFileSync(path.join(runtime, 'reports/implementation/range-numeric-composed-candidate/inputs.json'), 'utf8')).candidateInputs;
  for (const relative of Object.keys(inputs)) {
    const destination = path.join(copies.runtime, relative);
    fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.copyFileSync(path.join(runtime, relative), destination);
  }
  for (const family of Object.keys(policy.receipts)) {
    const receiptPath = 'reports/validation/inventory-' + family + '-audit/receipt.json';
    const receipt = JSON.parse(fs.readFileSync(path.join(snapshot, receiptPath), 'utf8'));
    for (const relative of [receiptPath, ...receipt.mappedLocalSources.map((entry) => entry.path)]) {
      const destination = path.join(copies.snapshot, relative);
      fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.copyFileSync(path.join(snapshot, relative), destination);
    }
  }
  return copies;
}

test('the real proposal remains intact while the qualified current Range bridge stays explicitly different', () => {
  const result = verifyMappedSources(snapshot, runtime);
  const differences = result.sources.filter((entry) => !entry.historicalBytesEqual);
  assert.equal(differences.length, 1); assert.equal(differences[0].path, policy.rangeBridgeTransition.path);
  assert.equal(differences[0].snapshotSha256, policy.rangeBridgeTransition.snapshotSha256);
  assert.equal(differences[0].runtimeSha256, policy.rangeBridgeTransition.runtimeSha256);
  assert.equal(result.qualifiedCompilerInputs, 344); assert.equal(result.currentPublicContractsStillRequired, true);
  assert.equal(result.originalReceiptsModified, false); assert.equal(result.actualGitIdentityAuthenticatedHere, false);
  assert.equal(result.runtimeExecutedHere, false); assert.equal(result.migrationCreditGranted, false);
  assert.equal(result.performanceAccepted, null); assert.equal(result.gateReevaluated, false);
});

test('the actual read-only CLI returns the same correspondence without executing a runtime', () => {
  const child = spawnSync(process.execPath, [path.join(__dirname, 'sources.cjs'), snapshot, runtime], { encoding: 'utf8' });
  assert.ifError(child.error); assert.equal(child.status, 0, child.stderr);
  assert.deepEqual(JSON.parse(child.stdout), verifyMappedSources(snapshot, runtime));
});

test('a changed token algorithm cannot borrow the qualified Range transition', (context) => {
  const roots = copied(context); fs.appendFileSync(path.join(roots.runtime, 'src/dom/token_list.rs'), '\n');
  assert.throws(() => verifyMappedSources(roots.snapshot, roots.runtime), /undeclared runtime change/);
});

test('a different bridge cannot borrow the exact qualified bridge digest', (context) => {
  const roots = copied(context); fs.appendFileSync(path.join(roots.runtime, policy.rangeBridgeTransition.path), '\n');
  assert.throws(() => verifyMappedSources(roots.snapshot, roots.runtime), /changed qualified Range bridge/);
});

test('an unlisted change to the integrated Rust Range candidate fails the complete compiler-input proof', (context) => {
  const roots = copied(context); fs.appendFileSync(path.join(roots.runtime, 'src/dom/range_state.rs'), '\n');
  assert.throws(() => verifyMappedSources(roots.snapshot, roots.runtime), /compiler inputs differ/);
});

test('changed original receipt bytes cannot redefine the proposed audit', (context) => {
  const roots = copied(context);
  fs.appendFileSync(path.join(roots.snapshot, 'reports/validation/inventory-dom-token-list-audit/receipt.json'), '\n');
  assert.throws(() => verifyMappedSources(roots.snapshot, roots.runtime), /changed original receipt/);
});

test('changed audited source bytes are rejected before current-runtime qualification', (context) => {
  const roots = copied(context); fs.appendFileSync(path.join(roots.snapshot, 'src/dom/token_list.rs'), '\n');
  assert.throws(() => verifyMappedSources(roots.snapshot, roots.runtime), /changed audited source/);
});

test('a linked bridge is rejected even if the target contains the exact qualified bytes', (context) => {
  const roots = copied(context); const bridge = path.join(roots.runtime, policy.rangeBridgeTransition.path);
  const target = path.join(roots.runtime, 'copied-bridge-data'); fs.copyFileSync(bridge, target);
  fs.unlinkSync(bridge); fs.symlinkSync(target, bridge);
  assert.throws(() => verifyMappedSources(roots.snapshot, roots.runtime));
});
