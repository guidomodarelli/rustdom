/** @module jsdom-block-pilot-plan Writes a prospective calendar exclusively; never executes DOM or a scientific capture. */
'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { calendar } = require('./blocks.cjs');
const design = require('./constants/design.json');

/** @param {string} destination - New file, never an existing receipt. @returns {object} Planning metadata, without measured durations. */
function writePlan(destination) {
  const shards = calendar();
  const result = { revision: design.revision, executionReady: false, planningOnly: true,
    criteria: shards.length, blocks: shards.reduce((total) => total + design.blocksPerCriterion, 0),
    processes: shards.reduce((total, shard) => total + shard.processes.length, 0),
    performanceAccepted: null, gateReevaluated: false, scientificCaptureExecuted: false, shards };
  fs.writeFileSync(destination, JSON.stringify(result) + '\n', { flag: 'wx' });
  return result;
}
if (require.main === module) {
  assert.equal(process.argv.length, 3, 'Pilot plan: provide one new output file');
  const result = writePlan(process.argv[2]);
  process.stdout.write(JSON.stringify({ criteria: result.criteria, blocks: result.blocks, processes: result.processes,
    executionReady: false, scientificCaptureExecuted: false, performanceAccepted: null, gateReevaluated: false }) + '\n');
}
module.exports = { writePlan };
