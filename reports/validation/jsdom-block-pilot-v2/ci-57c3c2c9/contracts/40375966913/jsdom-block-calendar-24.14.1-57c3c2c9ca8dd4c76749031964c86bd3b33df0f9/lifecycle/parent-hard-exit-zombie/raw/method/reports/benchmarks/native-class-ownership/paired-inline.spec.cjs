/** @file Exercises the bound inline study with actual workers and rejects stale or falsely clear evidence. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const study = require('./paired-inline-experiment.cjs');
const legacy = require('./paired-main-experiment.cjs');
const settings = require('./constants/paired-inline.cjs');
const method = require('./constants/paired-inline-study.cjs');
const evidence = process.env.RUSTDOM_INLINE_WORKER_EVIDENCE_DIR ||
  path.resolve(__dirname, '../../validation/native-class-ownership/paired-inline-sampler');
const metadata = JSON.parse(fs.readFileSync(path.join(evidence, 'validation.json')));
const manifest = JSON.parse(fs.readFileSync(path.join(evidence, 'runtime-manifest.json')));
const readWorker = (entry) => JSON.parse(fs.readFileSync(path.join(evidence, entry.path)));
const originalArchive = path.join(__dirname, 'paired-main/2026-10-21/node-22');

test('all four actual inline validation workers preserve package identities, public results and native release', () => {
  assert.equal(metadata.complete, true);
  assert.equal(metadata.workers.length, 4);
  let durations = 0;
  for (const entry of metadata.workers) {
    assert.equal(entry.exitCode, 0);
    const report = readWorker(entry);
    study.validateWorker(report, manifest, entry.expected);
    durations += report.batches.reduce((count, batch) => count + batch.samplesMs.length, 0);
  }
  assert.equal(durations, 576);
});

test('the new candidate cannot reuse the old complete study and leaves its default verifier intact', () => {
  assert.throws(() => study.verify(originalArchive));
  const result = legacy.verify(originalArchive);
  assert.equal(result.verified, true);
  assert.equal(result.accepted, false);
});

test('a self-consistent old candidate distribution cannot replace the explicit inline package pin', () => {
  const entry = metadata.workers.find((worker) => worker.expected.engine === 'rustdom');
  const report = readWorker(entry);
  const original = JSON.parse(fs.readFileSync(path.join(originalArchive, 'index.json')));
  report.distributionsBefore.B = original.manifest.distributions.B;
  report.distributionsAfter.B = report.distributionsBefore.B;
  assert.throws(() => study.validateWorker(report, manifest, entry.expected), /unpinned package distribution/);
});

test('an observed retained Document is rejected despite a worker clear flag', () => {
  const entry = metadata.workers.find((worker) => worker.expected.engine === 'rustdom');
  const report = readWorker(entry);
  report.batches[0].cleanupTrace.at(-1).B.survivors.document = 1;
  assert.throws(() => study.validateWorker(report, manifest, entry.expected), /falsely declared resource endpoint/);
});

test('the actual new CLI rejects old evidence without loading a DOM engine', () => {
  const child = spawnSync(process.execPath, [path.join(__dirname, 'paired-inline-experiment.cjs'), '--verify', originalArchive],
    { encoding: 'utf8', timeout: method.workerTimeoutMs });
  assert.equal(child.status, 2);
  assert.equal(child.stdout, '');
  assert.match(child.stderr, /AssertionError/);
});

test('a mismatched reviewed harness stops the bound driver before packages or workers',
  { skip: process.platform !== 'linux' || !settings.nodeVersions.includes(process.version) }, () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rustdom-inline-preflight-'));
    try {
      const manifestPath = path.join(root, 'manifest.json');
      const provenancePath = path.join(root, 'provenance.json');
      fs.writeFileSync(manifestPath, JSON.stringify(manifest));
      fs.writeFileSync(provenancePath, JSON.stringify({ harnessSha256: '0'.repeat(64),
        reviewedCommit: '767aca43b308f9d09fae2ee76f3d2876c132ed39',
        receiptUrl: 'https://github.com/guidomodarelli/rustdom/pull/80#issuecomment-6328835318',
        purpose: 'Invalid contract fixture; never an approval or measured study.' }));
      const output = path.join(root, 'output');
      assert.throws(() => study.run(manifestPath, output, provenancePath), /harness differs from reviewed sources/);
      const index = JSON.parse(fs.readFileSync(path.join(output, 'index.json')));
      assert.equal(index.complete, false);
      assert.deepEqual(index.runs, []);
      assert.deepEqual(fs.readdirSync(output), ['index.json']);
    } finally {
      const resolved = fs.realpathSync(root);
      assert.equal(path.dirname(resolved), fs.realpathSync(os.tmpdir()));
      assert.ok(path.basename(resolved).startsWith('rustdom-inline-preflight-'));
      fs.rmSync(resolved, { recursive: true });
    }
  });
