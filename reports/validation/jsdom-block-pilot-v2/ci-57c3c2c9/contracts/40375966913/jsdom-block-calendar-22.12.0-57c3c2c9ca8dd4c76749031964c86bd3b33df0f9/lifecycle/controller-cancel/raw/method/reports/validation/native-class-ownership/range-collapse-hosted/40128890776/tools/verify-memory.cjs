/** @module range-build-memory-reader Checks saved scalar observations with the current canonical release predicate. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const policy = require('./constants/transport.json');
const hash = (filename) => createHash('sha256').update(fs.readFileSync(filename)).digest('hex');

/**
 * Require this owned diagnostic DTO's complete published native shape without fixing cumulative counter values.
 * @param {*} value - Saved native statistics.
 * @param {*} reference - Actual statistics from the same published candidate API.
 * @returns {void} Throws for missing observations or invalid counters.
 */
function sameShape(value, reference) {
  if (reference !== null && typeof reference === 'object') {
    assert.ok(value !== null && typeof value === 'object' && !Array.isArray(value));
    assert.deepEqual(Object.keys(value).sort(), Object.keys(reference).sort());
    for (const key of Object.keys(reference)) sameShape(value[key], reference[key]);
  } else {
    assert.equal(typeof value, typeof reference);
    if (typeof reference === 'number') assert.ok(Number.isFinite(value) && value >= 0);
    else if (reference === null) assert.equal(value, null);
  }
}

/**
 * Verify every retained/released endpoint without constructing a DOM or loading a native addon.
 * @param {string} repository - Current reviewed source checkout.
 * @param {object} report - Unmodified JSON extracted from the authenticated artifact.
 * @returns {object} Finite scalar resource summary; no performance or universal leak acceptance.
 */
function verifyMemory(repository, report) {
  const dependency = path.join(repository, policy.memoryDependencyPath);
  const referenceFile = path.join(repository, policy.referenceMemoryPath);
  assert.equal(hash(dependency), policy.memoryDependencySha256); assert.equal(hash(referenceFile), policy.referenceMemorySha256);
  const { isReleased } = require(dependency);
  const reference = JSON.parse(fs.readFileSync(referenceFile, 'utf8'));
  assert.equal(report.pass, true); assert.equal(report.benchmarkExecuted, false); assert.equal(report.performanceAccepted, null);
  assert.equal(report.cycles.length, policy.expected.cycles);
  sameShape(report.baseline, reference.baseline);
  const ranges = {}; let retainedEndpoints = 0; let releaseEndpoints = 0; let initialUnclearReleaseStates = 0;
  for (const [index, cycle] of report.cycles.entries()) {
    assert.equal(cycle.cycle, index); assert.equal(cycle.retained.reached, false); assert.equal(cycle.released.reached, true);
    assert.ok(cycle.retained.state.survivors.ranges >= 1);
    initialUnclearReleaseStates += Number(!cycle.released.trace[0].clear);
    for (const [phase, outcome] of Object.entries({ retained: cycle.retained, released: cycle.released })) {
      const maximum = phase === 'retained' ? policy.expected.retainedMaxRounds : policy.expected.releaseMaxRounds;
      assert.equal(outcome.maxRounds, maximum); assert.equal(outcome.timeoutMs, policy.expected.quiescenceTimeoutMs);
      assert.equal(outcome.requiredClearSamples, policy.expected.requiredClearStatesPerCycle);
      assert.ok(outcome.trace.length >= (phase === 'retained' ? 1 : policy.expected.requiredClearStatesPerCycle) && outcome.trace.length <= maximum);
      if (phase === 'retained' && outcome.trace.length < maximum) assert.ok(outcome.trace.at(-1).elapsedMs >= outcome.timeoutMs);
      for (const [roundIndex, endpoint] of outcome.trace.entries()) {
        assert.equal(endpoint.round, roundIndex + 1);
        assert.deepEqual(Object.keys(endpoint.survivors).sort(), ['document', 'native', 'ranges', 'window']);
        for (const count of Object.values(endpoint.survivors)) assert.ok(Number.isSafeInteger(count) && count >= 0);
        sameShape(endpoint.nativeTree, reference.baseline);
        assert.equal(endpoint.clear, isReleased(endpoint, report.baseline));
        if (phase === 'retained') { assert.equal(endpoint.clear, false); retainedEndpoints++; }
        else releaseEndpoints++;
        for (const name of policy.memoryFields) {
          const value = endpoint.memory[name]; assert.ok(Number.isFinite(value) && value >= 0);
          const range = ranges[name] ?? { min: value, max: value };
          range.min = Math.min(range.min, value); range.max = Math.max(range.max, value); ranges[name] = range;
        }
      }
      for (const key of ['survivors', 'memory', 'nativeTree']) assert.deepEqual(outcome.state[key], outcome.trace.at(-1)[key]);
    }
    for (const endpoint of cycle.released.trace.slice(-policy.expected.requiredClearStatesPerCycle)) assert.equal(endpoint.clear, true);
    assert.deepEqual(cycle.released.state.survivors, { window: 0, document: 0, ranges: 0, native: 0 });
  }
  const created = report.cycles.at(-1).released.state.nativeTree.rangeStates.created - report.baseline.rangeStates.created;
  const released = report.cycles.at(-1).released.state.nativeTree.rangeStates.released - report.baseline.rangeStates.released;
  const expectedRanges = policy.expected.cycles * policy.expected.rangesPerCycle * 2;
  assert.equal(created, expectedRanges); assert.equal(released, expectedRanges);
  return { node: report.node, cycles: report.cycles.length, windowsObserved: report.cycles.length,
    documentsObserved: report.cycles.length, rangesObserved: created, nativeRangesObserved: created,
    retainedEndpoints, releaseEndpoints, requiredFinalClearStates: report.cycles.length * policy.expected.requiredClearStatesPerCycle,
    initialUnclearReleaseStates, baseline: report.baseline, memoryRangesBytes: ranges,
    collectorExecutedDOM: false, performanceAccepted: null, peakMemoryMeasured: false, universalLeakFreedomProven: false };
}
if (require.main === module) {
  assert.equal(process.argv.length, 4, 'Provide reviewed repository and original memory JSON');
  console.log(JSON.stringify(verifyMemory(path.resolve(process.argv[2]), JSON.parse(fs.readFileSync(process.argv[3], 'utf8')))));
}
module.exports = { verifyMemory };
