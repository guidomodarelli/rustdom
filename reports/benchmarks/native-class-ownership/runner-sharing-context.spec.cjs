/** @file Exercises complete public workload context and preserves the focused sampler's default contract. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { test } = require('node:test');
const { schedule } = require('./paired-main-worker.cjs');
const { diagnosticSchedule } = require('./runner-sharing-worker.cjs');
const { processSchedule, prepareRunners, runWorker, validateWorker } = require('./runner-sharing-diagnostic.cjs');
const original = require('./constants/paired-inline.cjs');
const settings = require('./constants/runner-sharing-context.cjs');
const root = path.resolve(__dirname, '../../..');
const manifestPath = process.env.RUSTDOM_SHARING_MANIFEST;

test('complete context retains all original rows in two matched cases and balances leading module mode', () => {
  const manifest = { copies: { J0: '/reference/J0', J1: '/reference/J1' } };
  assert.deepEqual(processSchedule(settings), [
    { mode: 'shared', position: 0 }, { mode: 'independent', position: 0 },
    { mode: 'independent', position: 4 }, { mode: 'shared', position: 4 },
  ]);
  for (const { mode, position } of processSchedule(settings)) {
    const plan = diagnosticSchedule(manifest, mode, position, settings);
    assert.deepEqual(plan, schedule(manifest, 'AA', 'jsdom', position, original));
    assert.equal(plan.batches.length, 16);
    assert.deepEqual(plan.physical, { A: 'J0', B: 'J1' });
    assert.deepEqual(plan.loadOrder, ['A', 'B']);
  }
  assert.equal(diagnosticSchedule(manifest, 'shared', 0).batches.length, 2);
});

test('real complete-context batches preserve every public result and reject corruption in a later row',
  { skip: process.platform !== 'linux' || !manifestPath }, () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rustdom-sharing-context-test-'));
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      const runnerRoots = prepareRunners(root, path.relative(process.cwd(), path.join(directory, 'runners')));
      const reports = settings.modes.map((mode) => {
        const input = { mode, position: mode === 'shared' ? 0 : 4, manifest, runnerRoots };
        const report = runWorker(input, path.join(directory, mode), settings);
        assert.equal(report.revision, 'runner-sharing-complete-context-v1');
        assert.equal(report.batches.length, 16);
        assert.equal(report.batches.reduce((count, batch) => count + batch.samplesMs.length, 0), 144);
        const altered = structuredClone(report);
        altered.batches.at(-1).outputHash = '0'.repeat(64);
        assert.throws(() => validateWorker(altered, input, settings));
        const retained = structuredClone(report);
        retained.batches.at(-1).cleanupTrace.at(-1).B.survivors.window = 1;
        assert.throws(() => validateWorker(retained, input, settings), /falsely clear endpoint/);
        return report;
      });
      const outputs = reports.map((report) => Object.fromEntries(report.batches.map((batch) =>
        [`${batch.name}/${batch.rows}`, batch.outputHash])));
      assert.equal(Object.keys(outputs[0]).length, 8);
      assert.deepEqual(outputs[0], outputs[1]);
      if (process.env.RUSTDOM_CONTEXT_VALIDATION_DIR) {
        fs.cpSync(directory, path.join(process.env.RUSTDOM_CONTEXT_VALIDATION_DIR, process.version),
          { recursive: true, errorOnExist: true, force: false });
      }
    } finally {
      const resolved = fs.realpathSync(directory);
      assert.equal(path.dirname(resolved), fs.realpathSync(os.tmpdir()));
      assert.ok(path.basename(resolved).startsWith('rustdom-sharing-context-test-'));
      fs.rmSync(resolved, { recursive: true });
    }
  });
