'use strict';
const fs = require('node:fs');
const root = '/home/guido/rustdom-paired-calibration-ZXrMcC';
const directory = root + '/reports/benchmarks/paired-calibration';
const summary = JSON.parse(fs.readFileSync(directory + '/v22.12.0-summary.json'));
const report = JSON.parse(fs.readFileSync(root + '/' + summary.report));
const median = (values) => { const sorted = values.toSorted((left, right) => left - right); const middle = Math.floor(sorted.length / 2); return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2; };
const difference = (first, second) => (second / first - 1) * 100;
const pairRows = report.pairs.flatMap((pair) => summary.rows.map((row) => {
  const samples = pair.observations.filter((sample) => sample.name === row.name && sample.size === row.size);
  const stages = Object.fromEntries(['first', 'second'].map((label) => {
    const measured = samples.filter((sample) => sample.label === label && sample.phase === 'measured');
    const warmup = samples.filter((sample) => sample.label === label && sample.phase === 'warmup');
    return [label, { wallMedianMs: median(measured.map((sample) => sample.elapsedMs)),
      cpuMedianMs: median(measured.map((sample) => (sample.cpu.user + sample.cpu.system) / 1000)),
      warmupWallMedianMs: median(warmup.map((sample) => sample.elapsedMs)),
      measuredFirstEightMedianMs: median(measured.slice(0, 8).map((sample) => sample.elapsedMs)),
      measuredLastEightMedianMs: median(measured.slice(-8).map((sample) => sample.elapsedMs)),
      releasedHeapUsedMedianBytes: median(measured.map((sample) => sample.release.memory.heapUsed)),
      releasedRssMedianBytes: median(measured.map((sample) => sample.release.memory.rss)) }];
  }));
  return { pairIndex: pair.pairIndex, name: row.name, size: row.size, stages,
    wallDifferencePercent: difference(stages.first.wallMedianMs, stages.second.wallMedianMs),
    cpuDifferencePercent: difference(stages.first.cpuMedianMs, stages.second.cpuMedianMs),
    firstWarmupToMeasuredPercent: difference(stages.first.warmupWallMedianMs, stages.first.wallMedianMs),
    secondWarmupToMeasuredPercent: difference(stages.second.warmupWallMedianMs, stages.second.wallMedianMs),
    firstMeasuredDriftPercent: difference(stages.first.measuredFirstEightMedianMs, stages.first.measuredLastEightMedianMs),
    secondMeasuredDriftPercent: difference(stages.second.measuredFirstEightMedianMs, stages.second.measuredLastEightMedianMs) };
}));
const diagnostics = { capturedAt: new Date().toISOString(), node: report.node, report: summary.report,
  pooledRowsAboveTwoPercent: summary.rows.filter((row) => Math.abs(row.differencePercent) > 2).length,
  pooledRowsAboveFivePercent: summary.rows.filter((row) => Math.abs(row.differencePercent) > 5).length,
  rowsWithAnyPairAboveFivePercent: summary.rows.filter((row) => row.pairDifferencesPercent.some((value) => Math.abs(value) > 5)).length,
  rowsWithPairSignReversal: summary.rows.filter((row) => Math.sign(row.pairDifferencesPercent[0]) !== Math.sign(row.pairDifferencesPercent[1])).length,
  individualPairRowsAboveFivePercent: pairRows.filter((row) => Math.abs(row.wallDifferencePercent) > 5).length,
  pairRowsAboveFiveWithCpuDifferenceSameDirection: pairRows.filter((row) => Math.abs(row.wallDifferencePercent) > 5 && Math.sign(row.wallDifferencePercent) === Math.sign(row.cpuDifferencePercent)).length,
  pairRowsWithFirstOrSecondMeasuredDriftAboveFivePercent: pairRows.filter((row) => Math.abs(row.firstMeasuredDriftPercent) > 5 || Math.abs(row.secondMeasuredDriftPercent) > 5).length,
  limitations: 'CPU includes background process threads and cannot identify scheduling, JIT, GC or CPU-frequency causes. Warmup and within-phase drift are descriptive diagnostics, not new acceptance metrics. Do not select a favorable subset or infer causality from matching signs.',
  pairRows };
fs.writeFileSync(directory + '/diagnostics.json', JSON.stringify(diagnostics, null, 2) + '\n');
fs.copyFileSync(__filename, directory + '/analyze-calibration.cjs');
console.log(JSON.stringify(Object.fromEntries(Object.entries(diagnostics).filter(([name]) => name !== 'pairRows')), null, 2));
