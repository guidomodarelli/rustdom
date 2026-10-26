/** @file Plans a separate diagnostic without launching processes or modifying the consumed study. */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const policy = require('./constants/protocol.json');

/** Retain every original phase/engine/label/seed for the declared diagnostic row in both observation modes. */
function plan(repository) {
  const study = require(path.join(repository, 'reports/benchmarks/native-class-ownership/current-ownership-experiment.cjs'));
  const settings = require(path.join(repository, 'reports/benchmarks/native-class-ownership/constants/current-ownership.cjs'));
  assert.equal(settings.rows[policy.rowIndex], policy.workload);
  const original = study.processSchedule().filter((entry) => entry.rowIndex === policy.rowIndex);
  const result = policy.nodeVersions.flatMap((node) => policy.modes.flatMap((mode) => original.map((input) => ({ node, mode, ...input }))));
  assert.equal(result.length, policy.plannedProcesses);
  return result;
}
module.exports = { plan };
