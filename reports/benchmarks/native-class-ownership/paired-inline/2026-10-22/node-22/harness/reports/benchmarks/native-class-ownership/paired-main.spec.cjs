/** @file Verifies semantic treatment assignment, actual paired public batches, and rejection of modified packages. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { schedule, inspectDistributions } = require('./paired-main-worker.cjs');
const settings = require('./constants/paired-main.cjs');
const { fingerprint } = require('./paired-experiment.cjs');
const manifestPath = process.env.RUSTDOM_PAIRED_MANIFEST;
const manifest = manifestPath ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : undefined;

test('the complete factorial schedule keeps A/B treatment fixed and balances both batch and load order', () => {
  const copies = Object.fromEntries(['A0', 'A1', 'B', 'J0', 'J1'].map((label) => [label, `/packages/${label}`]));
  for (const phase of settings.phases) for (const engine of settings.engines) {
    const plans = Array.from({ length: settings.workerCount }, (_, position) => schedule({ copies }, phase, engine, position));
    assert.equal(new Set(plans.map((plan) => JSON.stringify(plan.factors))).size, settings.workerCount);
    assert.equal(plans.filter((plan) => plan.loadOrder[0] === 'A').length, settings.workerCount / 2);
    for (const key of settings.rows) {
      const pairs = plans.map((plan) => plan.batches.filter((input) => `${input.name}/${input.size}` === key));
      assert.ok(pairs.every((pair) => pair.length === 2 && new Set(pair.map((input) => input.label)).size === 2));
      assert.equal(pairs.filter((pair) => pair[0].label === 'A').length, settings.workerCount / 2);
    }
    for (const plan of plans) {
      assert.equal(plan.batches.length, settings.rows.length * 2);
      assert.notEqual(plan.roots.A, plan.roots.B);
      if (engine === 'rustdom' && phase === 'AB') {
        assert.equal(plan.physical.B, 'B');
        assert.ok(['A0', 'A1'].includes(plan.physical.A));
      }
      if (engine === 'rustdom' && phase === 'AA') assert.deepEqual(Object.values(plan.physical).sort(), ['A0', 'A1']);
      if (engine === 'jsdom') assert.deepEqual(Object.values(plan.physical).sort(), ['J0', 'J1']);
    }
  }
});

test('invalid phases, engines and schedule positions are rejected before a runtime can be loaded', () => {
  assert.throws(() => schedule({}, 'invalid', 'rustdom', 0), /unknown phase/);
  assert.throws(() => schedule({}, 'AA', 'invalid', 0), /unknown engine/);
  for (const position of [-1, settings.workerCount, 0.5, NaN]) {
    assert.throws(() => schedule({}, 'AA', 'rustdom', position), /outside the declared schedule/);
  }
});

test('real complete package fingerprints match independently pinned A, B and jsdom distributions', { skip: !manifestPath }, () => {
  for (const phase of settings.phases) for (const engine of settings.engines) for (const position of [0, 2]) {
    const result = inspectDistributions(manifest, schedule(manifest, phase, engine, position), engine);
    assert.equal(Object.keys(result).length, 2);
  }
});

test('modifying real dist JavaScript is rejected even when the manifest is refreshed', { skip: !manifestPath }, () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rustdom-paired-main-rejection-'));
  try {
    const target = path.join(directory, 'B');
    fs.mkdirSync(target);
    fs.cpSync(path.join(manifest.copies.B, 'dist'), path.join(target, 'dist'), { recursive: true });
    fs.copyFileSync(path.join(manifest.copies.B, 'package.json'), path.join(target, 'package.json'));
    fs.appendFileSync(path.join(target, 'dist/index.cjs'), '\n// Modified executable package identity.\n');
    const modified = { ...manifest, copies: { ...manifest.copies, B: target },
      distributions: { ...manifest.distributions, B: fingerprint(target, settings.distributionParts) } };
    assert.throws(() => inspectDistributions(modified, schedule(modified, 'AB', 'rustdom', 0), 'rustdom'), /changed B package/);
  } finally {
    const resolved = fs.realpathSync(directory);
    assert.equal(path.dirname(resolved), fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith('rustdom-paired-main-rejection-'));
    fs.rmSync(resolved, { recursive: true });
  }
});

for (const [phase, engine, position] of [['AB', 'rustdom', 7], ['AA', 'jsdom', 0]]) {
  test(`real ${phase}/${engine} worker executes all rows and releases both independently loaded runtimes`,
    { skip: !manifestPath || process.platform !== 'linux' }, () => {
      const directory = process.env.RUSTDOM_PAIRED_TEST_OUTPUT;
      assert.ok(directory, 'Set RUSTDOM_PAIRED_TEST_OUTPUT to preserve raw validation evidence');
      const output = path.join(directory, `${phase}-${engine}.json`);
      const environment = { ...process.env }; delete environment.NODE_OPTIONS;
      const child = spawnSync(process.execPath, ['--expose-gc', path.join(__dirname, 'paired-main-worker.cjs'),
        manifestPath, phase, engine, String(position), output], { env: environment, encoding: 'utf8', timeout: 600_000 });
      assert.ifError(child.error); assert.equal(child.status, 0, child.stderr);
      const report = JSON.parse(fs.readFileSync(output, 'utf8'));
      assert.equal(report.complete, true); assert.equal(report.gateReevaluated, false);
      assert.deepEqual(report.distributionsBefore, report.distributionsAfter);
      assert.equal(report.batches.length, settings.rows.length * 2);
      for (const row of settings.rows) {
        const pair = report.batches.filter((batch) => `${batch.name}/${batch.rows}` === row);
        assert.equal(pair.length, 2); assert.equal(pair[0].outputHash, pair[1].outputHash);
        for (const batch of pair) {
          assert.equal(batch.complete, true); assert.equal(batch.samplesMs.length, settings.measuredSamples);
          assert.equal(batch.cleanupTrace.length, settings.cleanupRounds);
          for (const observation of batch.cleanupTrace.slice(-settings.requiredClearRounds)) {
            assert.equal(observation.A.clear, true); assert.equal(observation.B.clear, true);
            assert.deepEqual(observation.A.survivors, { window: 0, document: 0 });
            assert.deepEqual(observation.B.survivors, { window: 0, document: 0 });
          }
        }
      }
      assert.equal(report.affinitiesAfter.find((entry) => entry.tid === report.affinity.configured[0].tid).mask, String(settings.cpu));
    });
}
