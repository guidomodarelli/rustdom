/** @file Replay the full actual hosted two-SDK collection through current trusted CLI code, preserving negative outcomes. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test, after } = require('node:test');
const { readJSON, hashFile } = require('./io.cjs');
const policy = require('./constants/capture.json');
const settings = require('./constants/decision.json');
const source = require('./source.cjs');
const { finalize } = require('./decision.cjs');
const collection = process.env.RUSTDOM_OWNER_BATCH_COLLECTION_FOR_CONTRACTS;
assert.ok(collection, 'Provide the complete actual hosted two-SDK transport collection');
const bindingFile = path.join(collection, 'authenticated-binding.json');
const binding = readJSON(bindingFile); assert.equal(binding.mode, 'functional');
const executable = path.join(__dirname, 'decision.cjs');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'owner-batch-decision-'));
const outcomes = [];

/** Exercise only current trusted CLI code; transport payloads are data. */
function invoke(name, selectedBinding = bindingFile, operation = '--functional') {
  const output = path.join(root, name);
  const child = spawnSync(process.execPath, [executable, operation, selectedBinding, collection, output],
    { encoding: 'utf8', timeout: policy.maximumMetadataCommandMs, maxBuffer: policy.maximumMetadataOutputBytes });
  fs.writeFileSync(path.join(root, name + '.stdout.log'), child.stdout ?? '');
  fs.writeFileSync(path.join(root, name + '.stderr.log'), child.stderr ?? '');
  outcomes.push({ name, exitCode: child.status, error: child.error?.message ?? null });
  return { child, output };
}

test('both real hosted parts replay completely and remain functional with no performance acceptance', () => {
  const { child, output } = invoke('complete'); assert.ifError(child.error); assert.equal(child.status, 0, child.stderr);
  const result = readJSON(path.join(output, settings.filename));
  assert.equal(result.complete, true); assert.equal(result.transportAuthenticated, true);
  assert.equal(result.captureAuthenticated, false); assert.equal(result.performanceAccepted, null); assert.equal(result.gateReevaluated, false);
  assert.equal(result.parts.length, 2);
  for (const part of result.parts) {
    assert.equal(part.processes, 32); assert.equal(part.measuredDurations, 4608); assert.equal(part.warmupDurations, 1536);
    assert.equal(part.windows, 384); assert.equal(part.documents, 384); assert.equal(part.parentSnapshots, 3);
    assert.equal(hashFile(part.filename), part.sha256);
    const complete = readJSON(part.filename); assert.equal(complete.sourceCommit, binding.head);
    assert.deepEqual(complete.sourceGitErrors, []); assert.deepEqual(complete.readerIdentity.sourceGitErrors, []);
  }
});

test('an existing complete result is preserved before any rewrite or transport replay', () => {
  const filename = path.join(root, 'complete', settings.filename); const original = hashFile(filename);
  const { child } = invoke('complete'); assert.ifError(child.error); assert.notEqual(child.status, 0);
  assert.equal(hashFile(filename), original);
});

test('a different independent artifact pin yields a preserved incomplete decision with no numerical acceptance', () => {
  const modified = structuredClone(binding); modified.artifacts['22.12.0'].digest = 'sha256:' + '0'.repeat(64);
  const selected = path.join(root, 'wrong-artifact-binding.json'); fs.writeFileSync(selected, JSON.stringify(modified));
  const { child, output } = invoke('wrong-artifact', selected); assert.ifError(child.error); assert.notEqual(child.status, 0);
  const result = readJSON(path.join(output, settings.filename));
  assert.equal(result.complete, false); assert.equal(result.transportAuthenticated, false); assert.equal(result.captureAuthenticated, false);
  assert.equal(result.performanceAccepted, null); assert.equal(result.gateReevaluated, false); assert.ok(result.failure);
});

test('the functional run cannot be promoted through the scientific CLI operation', () => {
  const { child, output } = invoke('false-capture', bindingFile, '--verify'); assert.ifError(child.error); assert.notEqual(child.status, 0);
  const result = readJSON(path.join(output, settings.filename));
  assert.equal(result.complete, false); assert.equal(result.captureAuthenticated, false); assert.equal(result.performanceAccepted, null);
  assert.equal(result.gateReevaluated, false); assert.ok(result.failure);
});

test('a real final provenance read failure cannot publish completion or pending numerical acceptance', () => {
  const ownedDirectory = path.join(source.repository, '.cache'); fs.mkdirSync(ownedDirectory, { recursive: true });
  const filename = path.join(ownedDirectory, 'decision-provenance-' + process.pid + '.cjs');
  fs.writeFileSync(filename, 'module.exports = { ownedProvenanceFixture: true };\n', { flag: 'wx' });
  require(filename); fs.unlinkSync(filename); // Actual loaded-module loss, with no dependency mocks.
  try {
    for (const mode of ['functional', 'capture']) {
      const result = { mode, complete: false, captureAuthenticated: false, performanceAccepted: null,
        gateReevaluated: false, comparison: { allBudgetsMet: true } }; // Pending DTO only; never a study acceptance.
      assert.throws(() => finalize(result), { code: 'ENOENT' });
      assert.equal(result.complete, false); assert.equal(result.captureAuthenticated, false);
      assert.equal(result.performanceAccepted, null); assert.equal(result.gateReevaluated, false);
    }
  } finally { delete require.cache[filename]; }
});

after(() => fs.writeFileSync(path.join(root, 'observations.json'), JSON.stringify({ node: process.version,
  collection, bindingSha256: hashFile(bindingFile), outcomes, DOMExecuted: false, archivedCodeExecuted: false,
  scientificCaptureExecuted: false, performanceAccepted: null }, null, 2) + '\n'));
