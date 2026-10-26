/** @module range-control-telemetry-model Declares every AA control before profiling; never loads DOM. */
'use strict';
const assert = require('node:assert/strict');
const policy = require('./constants/protocol.json');
const original = require('../range-collapse-study/model.cjs');

/** @returns {object[]} Complete fixed Node/mode/engine/label/seed agenda with adjacent paired labels. */
function plan() {
  assert.equal(original.settings.rows[policy.rowIndex], policy.workload);
  const controls = original.plan().filter((entry) => entry.phase === policy.phase && entry.rowIndex === policy.rowIndex);
  const inputs = policy.nodeVersions.flatMap((node) => policy.modes.flatMap((mode) => controls.map((input) => ({ node, mode, ...input }))));
  assert.equal(inputs.length, policy.plannedProcesses);
  return inputs;
}
if (require.main === module) console.log(JSON.stringify({ revision: policy.revision, captureImplemented: policy.captureImplemented,
  samplerInvoked: false, performanceAccepted: null, gateReevaluated: false, inputs: plan() }, null, 2));
module.exports = { plan };
