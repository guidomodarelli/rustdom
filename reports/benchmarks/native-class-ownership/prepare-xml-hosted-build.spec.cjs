/** @file Exercises real XML preparations, their CLI and both actual Node lifetime reports. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const preparation = require('./prepare-xml-hosted-build.cjs');
const ownership = require('./prepare-current-hosted-build.cjs');
const policy = require('./constants/xml-build-inputs.cjs');
const recipe = require('./constants/xml-hosted-build.cjs');
const contracts = require('./constants/xml-build-contracts.cjs');
const archive = process.env.RUSTDOM_XML_BUILD_ARCHIVE;
assert.ok(archive, 'Provide the actual new XML preparation archive');

test('verifies the real XML packages and preserved inputs independently from timing evidence', () => {
  const identity = preparation.verify(archive);
  assert.equal(identity.verified, true); assert.equal(identity.inputs.policy, recipe.revision);
  assert.equal(identity.inputs.sources.A, policy.baselineSourceHash);
  assert.equal(identity.measurementExecuted, false); assert.equal(identity.performanceAccepted, null);
  assert.deepEqual(Object.keys(identity.distributions), ['A0', 'A1', 'B', 'J0', 'J1']);
});

test('both actual Node profiles preserve public results, native isolation and pre-exit realm release', () => {
  const identity = preparation.verify(archive);
  for (const { filename, node } of contracts.functionalReports) {
    const report = JSON.parse(fs.readFileSync(path.join(path.dirname(archive), filename), 'utf8'));
    assert.equal(report.node, node); assert.equal(preparation.verifyFunctionalReport(report, identity).verified, true);
    assert.equal(report.observedWindows, 15); assert.equal(report.observedDocuments, 15);
    for (const endpoint of Object.values(report.endpoints)) {
      assert.equal(endpoint.reached, true); assert.deepEqual(endpoint.state.survivors, { window: 0, document: 0 });
    }
  }
});

test('the checkpoint067 reader cannot silently relabel the XML preparation', () => {
  assert.throws(() => ownership.verify(archive));
  assert.equal(preparation.verify(archive).verified, true);
});

test('the real XML verifier CLI returns the full independently verified build identity', () => {
  const child = spawnSync(process.execPath, [path.join(__dirname, 'prepare-xml-hosted-build.cjs'), '--verify', archive],
    { encoding: 'utf8', timeout: recipe.validationTimeoutMs });
  assert.ifError(child.error); assert.equal(child.status, 0, child.stderr);
  assert.deepEqual(JSON.parse(child.stdout), preparation.verify(archive));
});

test('the actual full preparation remains verifiable after physical relocation with relative symlinks', () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), contracts.preparationDirectoryPrefix));
  const relocated = path.join(temporary, 'moved');
  try {
    fs.cpSync(archive, relocated, { recursive: true, verbatimSymlinks: true });
    const command = [path.join(__dirname, 'prepare-xml-hosted-build.cjs'), '--verify', relocated];
    const child = spawnSync(process.execPath, command, { encoding: 'utf8', timeout: recipe.validationTimeoutMs });
    const prefix = path.join(path.dirname(archive), `${contracts.relocatedReportPrefix}${process.version}`);
    fs.writeFileSync(`${prefix}.json`, child.stdout ?? '', { flag: 'wx' });
    fs.writeFileSync(`${prefix}.stderr.log`, child.stderr ?? '', { flag: 'wx' });
    fs.writeFileSync(`${prefix}.process.json`, `${JSON.stringify({ command: [process.execPath, ...command], pid: child.pid,
      exitCode: child.status, signal: child.signal, error: child.error?.message ?? null })}\n`, { flag: 'wx' });
    assert.ifError(child.error); assert.equal(child.status, 0, child.stderr);
    assert.deepEqual(JSON.parse(child.stdout), preparation.verify(archive));
  } finally {
    const resolved = fs.realpathSync(temporary);
    assert.equal(path.dirname(resolved), fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith(contracts.preparationDirectoryPrefix));
    fs.rmSync(resolved, { recursive: true });
  }
});
