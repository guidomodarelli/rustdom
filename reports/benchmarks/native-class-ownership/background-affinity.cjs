/** @file Configures and checks Linux thread affinity outside all DOM workload timers. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const { affinities } = require('./thread-worker.cjs');
const settings = require('./constants/background-affinity.cjs');

/**
 * Check an observed Linux thread snapshot, including the main and every auxiliary thread.
 * @param {object[]} threads - Actual /proc task observations.
 * @param {number} pid - Observed main task identity.
 * @param {string} mainCpuList - Required main task mask at this boundary.
 * @param {string} backgroundCpuList - Required mask for every other task.
 * @returns {void} Throws when a task is missing, duplicated, disappearing or on an undeclared mask.
 */
function assertSnapshot(threads, pid, mainCpuList, backgroundCpuList) {
  assert.ok(Array.isArray(threads) && threads.length > 1, 'Background affinity: auxiliary threads were not initialized');
  const tids = threads.map((thread) => thread.tid);
  assert.equal(new Set(tids).size, tids.length, 'Background affinity: duplicate task identity');
  assert.ok(tids.includes(pid), 'Background affinity: main task is missing');
  for (const thread of threads) {
    assert.ok(Number.isSafeInteger(thread.tid) && thread.tid > 0, 'Background affinity: invalid task identity');
    assert.notEqual(thread.disappeared, true, `Background affinity: task disappeared at snapshot tid=${thread.tid}`);
    assert.equal(thread.mask, thread.tid === pid ? mainCpuList : backgroundCpuList,
      `Background affinity: unexpected mask for tid=${thread.tid}`);
  }
}

/**
 * Initialize libuv then move existing auxiliary tasks to the declared disjoint pool.
 * The main task keeps its initial mask; the unchanged sampler subsequently pins it to CPU2.
 * @returns {Promise<object>} Before/configured snapshots, without loading a DOM package or reading RNG.
 */
async function configureBackgroundAffinity() {
  assert.equal(process.platform, 'linux', 'Background affinity: Linux /proc and taskset are required');
  await fs.promises.readFile(__filename);
  const before = affinities();
  assertSnapshot(before, process.pid, settings.initialCpuList, settings.initialCpuList);
  for (const thread of before.filter((entry) => entry.tid !== process.pid)) {
    const result = spawnSync('taskset', ['--pid', '--cpu-list', settings.backgroundCpuList, String(thread.tid)],
      { encoding: 'utf8' });
    if (result.error) throw new Error(`Background affinity: taskset could not execute for tid=${thread.tid}`, { cause: result.error });
    assert.equal(result.status, 0, `Background affinity: taskset failed for tid=${thread.tid}: ${result.stderr}`);
  }
  const configured = affinities();
  assertSnapshot(configured, process.pid, settings.initialCpuList, settings.backgroundCpuList);
  assert.deepEqual(configured.map((thread) => thread.tid), before.map((thread) => thread.tid),
    'Background affinity: task set changed during configuration');
  return { revision: settings.affinityRevision, before, configured };
}

/**
 * Verify the bootstrap and unchanged sampler boundaries against the prospective CPU declaration.
 * @param {object} report - Complete real worker output with backgroundAffinity attached.
 * @returns {void} Throws on missing, forged, overlapping or changed affinity observations.
 */
function validateBackgroundAffinity(report) {
  const state = report.backgroundAffinity;
  assert.ok(state, 'Background affinity: bootstrap observations are missing');
  assert.equal(state.revision, settings.affinityRevision);
  assertSnapshot(state.before, report.pid, settings.initialCpuList, settings.initialCpuList);
  assertSnapshot(state.configured, report.pid, settings.initialCpuList, settings.backgroundCpuList);
  const identities = (threads) => threads.map(({ tid, mask }) => ({ tid, mask }));
  assert.deepEqual(state.configured.map((thread) => thread.tid), state.before.map((thread) => thread.tid));
  assertSnapshot(report.affinity.initial, report.pid, settings.initialCpuList, settings.backgroundCpuList);
  assert.deepEqual(identities(report.affinity.initial), identities(state.configured),
    'Background affinity: sampler initial tasks differ from configured tasks');
  for (const threads of [report.affinity.configured, report.affinitiesAfter, state.final]) {
    assertSnapshot(threads, report.pid, String(settings.cpu), settings.backgroundCpuList);
    assert.deepEqual(threads.map((thread) => thread.tid), state.configured.map((thread) => thread.tid),
      'Background affinity: an untracked task appeared or disappeared');
  }
}

module.exports = { configureBackgroundAffinity, validateBackgroundAffinity };
