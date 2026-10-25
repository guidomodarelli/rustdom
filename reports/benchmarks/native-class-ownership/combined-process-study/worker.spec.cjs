/** @module combined-worker-contracts Tests provenance and preservation at the real worker entry point without loading a DOM. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { spawnSync } = require('node:child_process');
const { annotate, main } = require('./worker.cjs');
const policy = require('./constants/protocol.json');

test('annotation preserves raw measurements, warmup, failures and functional provenance without mutating the input', () => {
  const raw = { revision: policy.samplerRevision, pid: process.pid, node: process.version,
    complete: false, batches: [{ samplesMs: [1, 2, 3], sampleTimings: [{ stage: 'warmup', durationMs: 4 }] }],
    failure: { message: 'Observed incomplete sampler output' } };
  const before = structuredClone(raw);
  const metadata = { pid: process.pid, node: process.version, sourceSamplerRevision: policy.samplerRevision,
    revision: policy.revision, purpose: policy.functionalQualification.purpose, functionalOnly: true };
  const adapter = { mutationCreated: 0, mutationSharedMethods: 0, deliveryCreated: 0, deliverySharedMethods: 0 };
  const report = annotate(raw, metadata, adapter);
  assert.deepEqual(raw, before);
  assert.deepEqual(report.batches, before.batches); assert.deepEqual(report.failure, before.failure);
  assert.equal(report.complete, false); assert.equal(report.functionalOnly, true);
  assert.equal(report.purpose, policy.functionalQualification.purpose);
  assert.equal(report.sourceSamplerRevision, policy.samplerRevision);
  assert.equal(report.performanceAccepted, null); assert.equal(report.gateReevaluated, false);
  assert.deepEqual(report.integration, adapter);
});

test('annotation rejects a report from another process, runtime or sampler', () => {
  const raw = { revision: policy.samplerRevision, pid: process.pid, node: process.version };
  const metadata = { pid: process.pid, node: process.version, sourceSamplerRevision: policy.samplerRevision };
  for (const replacement of [{ pid: process.pid + 1 }, { node: 'unrelated-runtime' }, { revision: 'unrelated-sampler' }]) {
    assert.throws(() => annotate({ ...raw, ...replacement }, metadata, {}));
  }
});

test('capture remains unavailable before complete method publication, without touching an output', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'combined-worker-disabled-'));
  try {
    const report = path.join(root, 'report.json');
    await assert.rejects(main(['manifest', 'AB', 'rustdom', '0', 'B', report, '0']), /publication is not enabled/);
    assert.deepEqual(fs.readdirSync(root), []);
  } finally { fs.rmSync(root, { recursive: true }); }
});

test('functional invocation preserves existing report and sidecar before reading a derivation', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'combined-worker-preserve-'));
  try {
    const report = path.join(root, 'report.json'); const sidecar = report + policy.sidecarSuffix;
    for (const filename of [report, sidecar]) {
      fs.writeFileSync(filename, 'owned evidence\n');
      await assert.rejects(main(['manifest', 'AB', 'rustdom', '0', 'B', report, '0'], true), /preserve existing evidence/);
      assert.equal(fs.readFileSync(filename, 'utf8'), 'owned evidence\n'); fs.unlinkSync(filename);
    }
  } finally { fs.rmSync(root, { recursive: true }); }
});

test('the real derived entry point preserves a failed sampler sidecar instead of claiming completion', () => {
  const derived = process.env.RUSTDOM_COMBINED_DERIVED_ROOT;
  assert.ok(derived, 'Provide the actual freshly derived sampler via RUSTDOM_COMBINED_DERIVED_ROOT');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'combined-worker-partial-'));
  try {
    const report = path.join(root, 'report.json'); const manifest = path.join(root, 'manifest.json');
    fs.writeFileSync(manifest, '{}\n');
    const { createSinglePackageWorker } = require('../single-package-worker.cjs');
    const flags = createSinglePackageWorker(require('./model.cjs').settings).workerArguments(0);
    const child = spawnSync(process.execPath, [...flags, path.join(derived, 'worker.cjs'), policy.operations.functional,
      manifest, 'AB', 'rustdom', '0', 'B', report, '0'], { encoding: 'utf8', timeout: policy.workerTimeoutMs });
    assert.ifError(child.error); assert.equal(child.status, policy.failureExitCode); assert.equal(child.signal, null);
    const metadata = JSON.parse(fs.readFileSync(report + policy.sidecarSuffix, 'utf8'));
    assert.equal(metadata.complete, false); assert.equal(metadata.samplerInvoked, true);
    assert.equal(metadata.functionalOnly, true); assert.equal(metadata.performanceAccepted, null);
    assert.equal(metadata.gateReevaluated, false); assert.ok(metadata.failure.message.length > 0);
    assert.equal(metadata.sourceCommit, JSON.parse(fs.readFileSync(path.join(derived, 'preparation.json'), 'utf8')).sourceCommit);
  } finally { fs.rmSync(root, { recursive: true }); }
});
