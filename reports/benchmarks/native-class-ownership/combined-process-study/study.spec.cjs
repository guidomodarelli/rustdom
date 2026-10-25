/** @module combined-capture-contracts Exercises real source/package snapshot preparation and fail-closed capture entry points without scientific measurements. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');
const study = require('./study.cjs');
const inventory = require('./inventory.cjs');
const processes = require('./processes.cjs');
const capture = require('./constants/capture.json');
const policy = require('./constants/protocol.json');
const results = require('./results.cjs');
const qualified = require('./constants/functional-qualification.json');
const { hashFile } = require('./io.cjs');

test('real preflight and input snapshots preserve complete current provenance without invoking workers', () => {
  const packageRoot = process.env.RUSTDOM_COMBINED_PACKAGE_ROOT;
  assert.ok(packageRoot, 'Provide a real authenticated package');
  const checked = study.preflight(packageRoot);
  assert.equal(checked.samplerInvoked, false); assert.equal(checked.performanceAccepted, null);
  assert.equal(checked.harness.files.length, policy.sourceHarnessFiles);
  assert.equal(typeof checked.sourceChangesRaw, 'string');
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'combined-inputs-'));
  try {
    const prepared = study.snapshotInputs(checked, temporary);
    assert.equal(prepared.samplerInvoked, false); assert.equal(prepared.performanceAccepted, null);
    const receipt = processes.read(path.join(prepared.derived, 'preparation.json'));
    assert.equal(receipt.sourceCommit, checked.sourceCommit); assert.equal(receipt.sourceChangesRaw, checked.sourceChangesRaw);
    assert.deepEqual(processes.read(path.join(temporary, capture.files.manifest)), checked.manifest);
    for (const [name, checksum] of Object.entries(checked.files)) assert.equal(hashFile(path.join(temporary, capture.files.method, name)), checksum);
    assert.equal(processes.hash(path.join(temporary, capture.files.package)), policy.packageArchiveSha256);
    const before = inventory.snapshot(temporary);
    assert.throws(() => study.snapshotInputs(checked, temporary), /preserve existing evidence/);
    assert.deepEqual(inventory.snapshot(temporary), before);
    const legacy = path.join(temporary, 'prior-functional-derivation');
    const extracted = spawnSync('python3', ['-B', path.join(__dirname, 'materialize-functional.py'), '--derived', legacy],
      { encoding: 'utf8', timeout: policy.preparationTimeoutMs });
    assert.ifError(extracted.error); assert.equal(extracted.status, 0, extracted.stderr);
    assert.equal(results.verifyDerived(legacy, checked.harness, qualified.sourceCommit, true).complete, true);
    assert.throws(() => results.verifyDerived(legacy, checked.harness, qualified.sourceCommit));
  } finally { fs.rmSync(temporary, { recursive: true }); }
});

test('capture stays disabled and genuine functional data cannot pass the scientific replay boundary', () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'combined-capture-disabled-'));
  try {
    const output = path.join(temporary, 'capture');
    assert.throws(() => study.run('/absent/package', output, '0'.repeat(40), []), /publication is not enabled/);
    assert.equal(fs.existsSync(output), false);
    const data = path.join(temporary, 'functional-data');
    const child = spawnSync('python3', ['-B', path.join(__dirname, 'materialize-functional.py'), data],
      { encoding: 'utf8', timeout: policy.preparationTimeoutMs });
    assert.ifError(child.error); assert.equal(child.status, 0, child.stderr);
    assert.throws(() => study.verify(data));
  } finally { fs.rmSync(temporary, { recursive: true }); }
});

test('physical inventory includes empty directories, rejects aliases, and bounds per-file reads before allocation', () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'combined-inventory-'));
  try {
    const filename = path.join(temporary, 'data.json'); fs.writeFileSync(filename, '{}\n');
    const first = inventory.snapshot(temporary);
    fs.mkdirSync(path.join(temporary, 'additional-empty-directory'));
    assert.notDeepEqual(inventory.snapshot(temporary), first);
    const alias = path.join(temporary, 'linked-data.json'); fs.linkSync(filename, alias);
    assert.throws(() => inventory.snapshot(temporary)); fs.unlinkSync(alias);
    fs.symlinkSync(filename, alias); assert.throws(() => inventory.snapshot(temporary)); fs.unlinkSync(alias);
    const oversized = path.join(temporary, 'oversized.json');
    fs.closeSync(fs.openSync(oversized, 'wx')); fs.truncateSync(oversized, policy.metadataOutputLimitBytes + 1);
    assert.throws(() => processes.read(oversized), /reader bound/);
    fs.truncateSync(oversized, capture.maximumExecutableBytes + 1);
    const descriptorsBefore = fs.readdirSync('/proc/self/fd').length;
    for (let index = 0; index < 32; index++) assert.throws(() => study.hashExecutable(oversized), /binary reader bound/);
    assert.equal(fs.readdirSync('/proc/self/fd').length, descriptorsBefore);
    for (let index = 0; index < 32; index++) assert.throws(() => hashFile('/proc/sys/kernel/ostype'));
    assert.equal(fs.readdirSync('/proc/self/fd').length, descriptorsBefore);
  } finally { fs.rmSync(temporary, { recursive: true }); }
});
