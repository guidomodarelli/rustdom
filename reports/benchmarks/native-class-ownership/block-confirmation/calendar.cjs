/** @module ownership-confirmation-calendar Fixed full-factor process schedules; no runtime loading or capture activation. */
'use strict';
const assert = require('node:assert/strict');
const original = require('../combined-process-study/model.cjs');
const protocol = require('../combined-process-study/constants/protocol.json');
const sampling = require('../owner-batch-study/constants/sampler.json');
const design = require('./constants/design.json');

/** @returns {object[]} All 64 criteria; each criterion must stay on one physical host. */
function criteria() {
  const result = [];
  for (const node of protocol.nodes) for (const phase of protocol.phases) {
    for (const engine of protocol.engines) for (const [rowIndex, row] of protocol.rows.entries()) {
      result.push({ ordinal: result.length, criterionId: [node, phase, engine, row].join('/'),
        node, phase, engine, rowIndex, row, blocks: design.blocksPerCriterion[engine] });
    }
  }
  assert.equal(result.length, protocol.comparisons);
  return result;
}

/**
 * Preserve physical-package counterbalance, seed and A/B lead from each original factor.
 * Repeat the complete cyclic square twice for jsdom, once for Rust; never split a criterion between hosts.
 * @param {string} criterionId - Exact published SDK/phase/engine/row identifier.
 * @returns {object} Fresh chronological process tuples, without launching workers.
 */
function schedule(criterionId) {
  const criterion = criteria().find((entry) => entry.criterionId === criterionId);
  assert.ok(criterion, 'Ownership confirmation calendar: undeclared criterion');
  assert.ok(Number.isSafeInteger(criterion.blocks) && criterion.blocks >= design.factorsPerBlock &&
    criterion.blocks % design.factorsPerBlock === 0, 'Ownership confirmation calendar: incomplete cyclic square');
  const originalProcesses = original.plan().filter((input) => input.phase === criterion.phase &&
    input.engine === criterion.engine && input.rowIndex === criterion.rowIndex);
  const factors = Array.from({ length: design.factorsPerBlock }, (unused, factor) => {
    const pair = originalProcesses.filter((input) => input.position === factor);
    assert.equal(pair.length, design.labelsPerPair);
    assert.deepEqual(new Set(pair.map((input) => input.label)), new Set(protocol.labels));
    return pair;
  });
  const processes = [];
  for (let block = 0; block < criterion.blocks; block += 1) {
    for (let slot = 0; slot < design.factorsPerBlock; slot += 1) {
      const factor = (slot + block) % design.factorsPerBlock;
      for (const input of factors[factor]) processes.push({ ...input, node: criterion.node,
        row: criterion.row, block, slot, factor, ordinal: processes.length,
        processId: [criterionId, block, factor, input.label].join('/'), seed: protocol.v8Seeds[factor] });
    }
  }
  return { ...criterion, processes };
}

/** @returns {object} Exact capture denominators, without claiming that any process has executed. */
function population() {
  const matrix = criteria();
  const processes = matrix.reduce((count, entry) => count + entry.blocks * design.factorsPerBlock * design.labelsPerPair, 0);
  const realmsPerProcess = sampling.warmupBlocksPerProcess + sampling.measuredBlocksPerProcess;
  return { criteria: matrix.length, processes,
    measuredDurations: processes * sampling.measuredBlocksPerProcess * sampling.logicalTasksPerBlock,
    warmupDurations: processes * sampling.warmupBlocksPerProcess * sampling.logicalTasksPerBlock,
    windows: processes * realmsPerProcess, documents: processes * realmsPerProcess,
    cleanupRounds: processes * sampling.cleanupRounds,
    requiredFinalClearStates: processes * sampling.requiredFinalClearStates,
    parentSnapshots: matrix.length * 3 };
}

module.exports = { criteria, schedule, population };
