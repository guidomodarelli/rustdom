/** @file Tests method boundaries with genuine saved reports; no DOM, platform mocks or new sampling. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const study = require('./study.cjs');
const { annotate, main: workerMain } = require('./worker.cjs');
const policy = require('./constants/protocol.json');
const originalSettings = require('../constants/current-ownership.cjs');
const directory = process.env.SHARED_WORKER_EVIDENCE;
assert.ok(directory, 'Set SHARED_WORKER_EVIDENCE to the authenticated real functional qualification');
const read = (filename) => JSON.parse(fs.readFileSync(filename, 'utf8'));
const index = read(path.join(directory, 'index.json'));
const report = read(path.join(directory, 'node22/000/report.json'));
const sidecar = read(path.join(directory, 'node22/000/report.json.integration.json'));
const input = index.processes[0];
const repository = path.resolve(__dirname, '../../../..');

/** Every temporary tree is created here and its absolute owner checked before recursive cleanup. */
function temporary(action) {
  const parent = fs.realpathSync(os.tmpdir());
  const root = fs.mkdtempSync(path.join(parent, 'rustdom-study-contract-'));
  try { return action(root); }
  finally { assert.equal(path.dirname(root), parent); assert.ok(path.isAbsolute(root)); fs.rmSync(root, { recursive: true }); }
}

/** Reconstruct only the pre-annotation header of the actual saved inner result; measured values stay untouched. */
function innerReport() { return { ...structuredClone(report), revision: report.sourceSamplerRevision }; }
const metadata = () => ({ ...structuredClone(sidecar), revision: policy.revision, purpose: policy.purpose,
  sourceSamplerRevision: report.sourceSamplerRevision, functionalOnly: false });

test('the prospective sequence covers all phases, 16 seeds, engines, labels and eight public rows', () => {
  const plan = study.plan(); assert.equal(plan.length, 1024);
  const seen = new Set(plan.map((entry) => `${entry.phase}/${entry.position}/${entry.engine}/${entry.label}/${entry.rowIndex}`));
  assert.equal(seen.size, plan.length);
  for (const phase of originalSettings.phases) for (let position = 0; position < 16; position++) {
    for (const engine of originalSettings.engines) for (const label of originalSettings.labels) for (const rowIndex of originalSettings.rows.keys()) {
      assert.ok(seen.has(`${phase}/${position}/${engine}/${label}/${rowIndex}`));
    }
  }
});
test('annotation preserves every real sample, output and resource observation while separating the study identity', () => {
  const before = innerReport(); const result = annotate(before, metadata(), report.integration);
  assert.equal(before.revision, originalSettings.revision); assert.equal(result.revision, policy.revision);
  assert.equal(result.functionalOnly, false); assert.equal(result.performanceAccepted, null);
  assert.deepEqual(result.batches, before.batches); assert.deepEqual(result.affinity, before.affinity);
  assert.deepEqual(result.nativeBaseline, before.nativeBaseline); assert.deepEqual(result.randomProbe, before.randomProbe);
  study.validateReport(result, index.manifest, input.input, input, metadata(), index.derivationSha256);
});
test('the functional qualification cannot be relabeled by the prospective verifier', () => {
  assert.throws(() => study.validateReport(report, index.manifest, input.input, input, sidecar, index.derivationSha256), { code: 'ERR_ASSERTION' });
});
test('historical sampler revisions cannot substitute for the new study identity', () => {
  assert.throws(() => study.validateReport(innerReport(), index.manifest, input.input, input, sidecar, index.derivationSha256), { code: 'ERR_ASSERTION' });
});
test('annotation cannot claim a report produced by another PID or Node', () => {
  for (const altered of [{ ...metadata(), pid: report.pid + 1 }, { ...metadata(), node: 'v24.14.1' }]) {
    assert.throws(() => annotate(innerReport(), altered, report.integration), { code: 'ERR_ASSERTION' });
  }
});
test('estimator inputs preserve real durations and RNG values without retaining the complete worker report', () => {
  const source = annotate(innerReport(), metadata(), report.integration);
  const view = study.estimatorView(source);
  assert.deepEqual(view.batches[0].samplesMs, source.batches[0].samplesMs);
  assert.deepEqual(view.randomProbe, source.randomProbe); assert.equal(view.batches[0].outputHash, source.batches[0].outputHash);
  const originalSample = source.batches[0].samplesMs[0]; const originalProbe = source.randomProbe[0];
  view.batches[0].samplesMs[0]++; view.randomProbe[0]++;
  assert.equal(source.batches[0].samplesMs[0], originalSample); assert.equal(source.randomProbe[0], originalProbe);
  assert.equal(view.batches[0].memoryAfterCleanup, undefined); assert.equal(view.loadedAfter, undefined);
});
test('an incomplete two-Node qualification cannot make a performance decision', () => {
  assert.throws(() => study.decide(originalSettings.nodeVersions.map((node) => ({ node, entries: [] }))), { code: 'ERR_ASSERTION' });
});
test('one executable cannot substitute for the two distinct pinned Node binaries', () => {
  assert.throws(() => study.runtimeIdentities([process.execPath, process.execPath]), { code: 'ERR_ASSERTION' });
});
test('a missing Window observation still rejects the new report header', () => {
  const result = annotate(innerReport(), metadata(), report.integration);
  delete result.batches[0].cleanupTrace.at(-1).survivors.window;
  assert.throws(() => study.validateReport(result, index.manifest, input.input, input, metadata(), index.derivationSha256), { code: 'ERR_ASSERTION' });
});
test('derivation authenticates the qualified inner sampler and rejects a substituted executable wrapper', () => temporary((root) => {
  const derived = path.join(root, 'derived');
  const result = spawnSync('python3', ['-B', path.join(__dirname, 'prepare.py'), repository, path.join(directory, 'source-manifest.json'), derived], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const receipt = read(path.join(derived, 'preparation.json'));
  study.verifyDerived(derived, receipt, require('../current-ownership-experiment.cjs').captureHarness());
  fs.appendFileSync(path.join(derived, 'worker.cjs'), '\n');
  assert.throws(() => study.verifyDerived(derived, receipt, require('../current-ownership-experiment.cjs').captureHarness()), { code: 'ERR_ASSERTION' });
}));
test('a corrupted input manifest is rejected before derivation creates output', () => temporary((root) => {
  const manifest = read(path.join(directory, 'source-manifest.json')); manifest.files[0].sha256 = '0'.repeat(64);
  const filename = path.join(root, 'manifest.json'); fs.writeFileSync(filename, JSON.stringify(manifest));
  const output = path.join(root, 'derived');
  const result = spawnSync('python3', ['-B', path.join(__dirname, 'prepare.py'), repository, filename, output], { encoding: 'utf8' });
  assert.equal(result.status, 1); assert.match(result.stderr, /source identity differs/); assert.equal(fs.existsSync(output), false);
}));
test('optimized Python cannot disable study derivation checks', () => {
  const result = spawnSync('python3', ['-O', '-B', path.join(__dirname, 'prepare.py'), 'unused', 'unused', 'unused'], { encoding: 'utf8' });
  assert.equal(result.status, 1); assert.match(result.stderr, /requires non-optimized Python/);
});
test('off-host capture is rejected before creating evidence or loading a sampler', () => temporary((root) => {
  const env = { ...process.env }; delete env.GITHUB_ACTIONS;
  const output = path.join(root, 'capture');
  const result = spawnSync(process.execPath, [path.join(__dirname, 'study.cjs'), '--capture', 'unused', output, '0'.repeat(40), 'unused', 'unused'], { env, encoding: 'utf8' });
  assert.equal(result.status, 2); assert.match(result.stderr, /requires the declared hosted runner/); assert.equal(fs.existsSync(output), false);
}));
test('another workflow attempt is rejected before preparation or sampling', () => temporary((root) => {
  const output = path.join(root, 'capture');
  const result = spawnSync(process.execPath, [path.join(__dirname, 'study.cjs'), '--capture', 'unused', output, '0'.repeat(40), 'unused', 'unused'],
    { env: { ...process.env, GITHUB_ACTIONS: 'true', GITHUB_RUN_ATTEMPT: '2' }, encoding: 'utf8' });
  assert.equal(result.status, 2); assert.match(result.stderr, /no retries/); assert.equal(fs.existsSync(output), false);
}));
test('the worker preserves existing evidence before loading any runtime', async () => {
  const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'rustdom-study-preservation-'));
  const output = path.join(root, 'report.json'); fs.writeFileSync(output, 'existing evidence');
  try {
    await assert.rejects(workerMain(['unused', 'AA', 'jsdom', '0', 'A', output, '0']), { code: 'ERR_ASSERTION' });
    assert.equal(fs.readFileSync(output, 'utf8'), 'existing evidence'); assert.equal(fs.existsSync(`${output}.integration.json`), false);
  } finally { fs.unlinkSync(output); fs.rmdirSync(root); }
});
