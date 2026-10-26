/** @file Checks explicit study identities against complete real evidence without collecting new timings. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createPairedStudy, verify } = require('./paired-main-experiment.cjs');
const { schedule } = require('./paired-main-worker.cjs');
const settings = require('./constants/paired-main.cjs');
const method = require('./constants/paired-main-study.cjs');
const { sourceHashes } = require('./constants/hosted.cjs');
const archive = path.join(__dirname, 'paired-main/2026-10-21');
const nodes = ['node-22', 'node-24'].map((label) => path.join(archive, label));

test('explicit historical identities verify all actual observations and preserve failed acceptance', () => {
  const study = createPairedStudy({ settings: structuredClone(settings), method: structuredClone(method),
    sourceHashes: { ...sourceHashes } });
  const result = study.verifySet(nodes);
  assert.equal(result.verified, true);
  assert.equal(result.accepted, false);
  assert.equal(result.results.reduce((count, entry) => count + entry.processes, 0), 64);
  assert.equal(result.results.reduce((count, entry) => count + entry.measuredDurations, 0), 9216);
});

test('a different source identity rejects actual historical evidence without changing the default study', () => {
  const study = createPairedStudy({ sourceHashes: { ...sourceHashes, B: '0'.repeat(64) } });
  assert.throws(() => study.verify(nodes[0]));
  const original = verify(nodes[0]);
  assert.equal(original.verified, true);
  assert.equal(original.accepted, false);
});

test('explicit factor bounds reach the worker scheduler and remain independent of the default configuration', () => {
  const index = JSON.parse(fs.readFileSync(path.join(nodes[0], 'index.json')));
  const configuration = { ...settings, workerCount: settings.workerCount + 1 };
  const custom = createPairedStudy({ settings: configuration });
  assert.equal(custom.processSchedule().length, configuration.phases.length * configuration.workerCount * configuration.engines.length);
  const position = settings.workerCount;
  assert.throws(() => schedule(index.manifest, 'AA', 'rustdom', position), /outside the declared schedule/);
  const plan = schedule(index.manifest, 'AA', 'rustdom', position, configuration);
  assert.equal(plan.batches.length, settings.rows.length * 2);
  assert.deepEqual(new Set(plan.batches.map((entry) => entry.label)), new Set(['A', 'B']));
  assert.throws(() => schedule(index.manifest, 'AA', 'rustdom', position), /outside the declared schedule/);
});
