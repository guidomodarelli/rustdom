/** @file Declares the complete balanced runner schedule and the unchanged median-ratio decision. */
'use strict';
const assert = require('node:assert/strict');
const settings = require('./constants/study.json');

/** Enumerate every warmup and measured CLI in its actual serial execution order. */
function plan() {
  const commands = [];
  for (const [nodeIndex, node] of settings.nodeVersions.entries()) {
    for (let round = 0; round < settings.warmupRounds; round++) {
      const runners = [...settings.runners.slice(round), ...settings.runners.slice(0, round)];
      const physical = round % 2 ? [...settings.physicalPackages].reverse() : settings.physicalPackages;
      for (const runner of runners) for (const packageName of physical) {
        commands.push({ node, stage: 'warmup', round, runner, physical: packageName });
      }
    }
    for (const phase of settings.phases) {
      const positions = Array.from({ length: settings.factorCombinations * settings.runnerRotations }, (_, position) => position);
      if (nodeIndex % 2) positions.reverse();
      for (const position of positions) {
        const rotation = Math.floor(position / settings.factorCombinations);
        const runners = [...settings.runners.slice(rotation), ...settings.runners.slice(0, rotation)];
        const reversePair = Boolean(position & 1), reverseAssignment = Boolean(position & 2);
        const physical = { A: reverseAssignment ? 'A1' : 'A0', B: phase === 'AA' ? (reverseAssignment ? 'A0' : 'A1') : 'B' };
        for (const runner of runners) for (const label of reversePair ? ['B', 'A'] : ['A', 'B']) {
          commands.push({ node, stage: 'measured', phase, position, runner, label,
            physical: physical[label], factors: { reversePair, reverseAssignment, rotation } });
        }
      }
    }
  }
  return commands;
}

/** Keep every observation in the pooled CLI median; tests within a CLI are not extra samples. */
function median(values) {
  assert.ok(values.length > 0 && values.every((value) => Number.isFinite(value) && value > 0), 'Suite timing: invalid duration');
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** Decide only the twelve declared suite rows; leave ownership and previous studies unchanged. */
function summarize(records) {
  const rows = [];
  for (const node of settings.nodeVersions) for (const phase of settings.phases) for (const runner of settings.runners) {
    const cells = Object.fromEntries(['A', 'B'].map((label) => {
      const selected = records.filter((record) => record.selection.stage === 'measured' && record.selection.node === node &&
        record.selection.phase === phase && record.selection.runner === runner && record.selection.label === label);
      assert.equal(selected.length, settings.factorCombinations * settings.runnerRotations, 'Suite timing: incomplete cell');
      assert.equal(new Set(selected.map((record) => record.selection.position)).size, selected.length, 'Suite timing: duplicate position');
      assert.ok(selected.every((record) => record.complete && record.exitCode === 0), 'Suite timing: incomplete process');
      assert.ok(selected.every((record) => /^\d+$/.test(record.elapsedNs) && BigInt(record.elapsedNs) > 0n &&
        record.elapsedMs === Number(record.elapsedNs) / 1e6), 'Suite timing: invalid raw clock');
      return [label, selected];
    }));
    const samples = Object.fromEntries(Object.entries(cells).map(([label, cell]) => [label, cell.map((record) => record.elapsedMs)]));
    const twiceMedian = (cell) => {
      const sorted = cell.map((record) => BigInt(record.elapsedNs)).sort((left, right) => left < right ? -1 : left > right ? 1 : 0);
      const middle = Math.floor(sorted.length / 2);
      return sorted.length % 2 ? sorted[middle] * 2n : sorted[middle - 1] + sorted[middle];
    };
    const baseline = twiceMedian(cells.A), candidate = twiceMedian(cells.B);
    const baselineMs = Number(baseline) / 2e6, candidateMs = Number(candidate) / 2e6;
    const changePercent = (candidateMs / baselineMs - 1) * 100;
    const upper = candidate * 100n <= baseline * BigInt(100 + settings.budgetPercent);
    const lower = candidate * 100n >= baseline * BigInt(100 - settings.budgetPercent);
    const calibrated = phase === 'AA' ? lower && upper
      : rows.find((row) => row.node === node && row.phase === 'AA' && row.runner === runner).withinBudget;
    rows.push({ node, phase, runner, samples, baselineMs, candidateMs, changePercent, calibrated,
      baselineMedianNsTwice: String(baseline), candidateMedianNsTwice: String(candidate), withinBudget: calibrated && upper });
  }
  return { suiteTimingAccepted: rows.every((row) => row.withinBudget), ownershipAcceptanceChanged: false, rows };
}
module.exports = { plan, median, summarize };
