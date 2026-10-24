/** @file Exercises the real unchanged workload in both module-sharing arms and verifies weak resource endpoints. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { test } = require('node:test');
const { diagnosticSchedule } = require('./runner-sharing-worker.cjs');
const { prepareRunners, processSchedule, runWorker, validateWorker } = require('./runner-sharing-diagnostic.cjs');
const settings = require('./constants/runner-sharing.cjs');
const sourceRoot = path.resolve(__dirname, '../../..');
const manifestPath = process.env.RUSTDOM_SHARING_MANIFEST;

test('all eight physical/load/batch assignments remain balanced in both module-sharing arms', () => {
  const manifest = { copies: { J0: '/reference/J0', J1: '/reference/J1' } };
  const sequence = processSchedule();
  assert.equal(sequence.length, 16);
  const leading = sequence.filter((trial, index) => index % 2 === 0);
  for (const bit of [1, 2, 4]) for (const set of [false, true]) {
    assert.equal(leading.filter((trial) => Boolean(trial.position & bit) === set && trial.mode === 'shared').length, 2);
    assert.equal(leading.filter((trial) => Boolean(trial.position & bit) === set && trial.mode === 'independent').length, 2);
  }
  for (const mode of settings.modes) {
    const trials = sequence.filter((trial) => trial.mode === mode);
    assert.deepEqual(trials.map((trial) => trial.position), [0, 1, 2, 3, 4, 5, 6, 7]);
    const plans = trials.map((trial) => diagnosticSchedule(manifest, mode, trial.position));
    assert.equal(plans.filter((plan) => plan.batches[0].label === 'A').length, 4);
    assert.equal(plans.filter((plan) => plan.loadOrder[0] === 'A').length, 4);
    assert.equal(plans.filter((plan) => plan.physical.A === 'J0').length, 4);
    assert.ok(plans.every((plan) => plan.batches.length === 2 && plan.batches.every((batch) =>
      batch.name === settings.workload.name && batch.size === settings.workload.size)));
  }
  assert.throws(() => diagnosticSchedule(manifest, 'other', 0), /unknown diagnostic mode/);
  assert.throws(() => diagnosticSchedule(manifest, 'shared', 8), /outside the declared schedule/);
});

test('real shared and independent harnesses preserve public results and reject retained resource evidence',
  { skip: process.platform !== 'linux' || !manifestPath }, () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rustdom-runner-sharing-test-'));
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      const runnerRoots = prepareRunners(sourceRoot, path.relative(process.cwd(), path.join(directory, 'runners')));
      assert.ok(Object.values(runnerRoots).every((runnerRoot) => path.isAbsolute(runnerRoot)));
      const reports = settings.modes.map((mode) => {
        const input = { mode, position: mode === 'shared' ? 0 : 7, manifest, runnerRoots };
        const report = runWorker(input, path.join(directory, mode));
        if (process.env.RUSTDOM_SHARING_VALIDATION_DIR) {
          fs.cpSync(directory, path.join(process.env.RUSTDOM_SHARING_VALIDATION_DIR, process.version, mode),
            { recursive: true, errorOnExist: true, force: false });
        }
        assert.equal(report.batches.reduce((count, batch) => count + batch.samplesMs.length, 0), 18);
        const retained = structuredClone(report);
        retained.batches[0].cleanupTrace.at(-1).A.survivors.document = 1;
        assert.throws(() => validateWorker(retained, input), /falsely clear endpoint/);
        const changedIdentity = structuredClone(report);
        changedIdentity.factoryShared = !report.factoryShared;
        assert.throws(() => validateWorker(changedIdentity, input));
        return report;
      });
      assert.equal(reports[0].batches[0].outputHash, reports[1].batches[0].outputHash);
      const changedWorker = path.join(runnerRoots.B, 'benchmarks/worker.cjs');
      fs.appendFileSync(changedWorker, '\n');
      assert.throws(() => runWorker({ mode: 'shared', position: 0, manifest, runnerRoots }, path.join(directory, 'changed')),
        /worker failed/);
      const failed = JSON.parse(fs.readFileSync(path.join(directory, 'changed.json'), 'utf8'));
      assert.equal(failed.complete, false); assert.deepEqual(failed.batches, []);
      assert.match(failed.failure.message, /changed B harness/);
    } finally {
      const resolved = fs.realpathSync(directory);
      assert.equal(path.dirname(resolved), fs.realpathSync(os.tmpdir()));
      assert.ok(path.basename(resolved).startsWith('rustdom-runner-sharing-test-'));
      fs.rmSync(resolved, { recursive: true });
    }
  });
