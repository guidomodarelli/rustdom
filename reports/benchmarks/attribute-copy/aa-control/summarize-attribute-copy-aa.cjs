'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');
const task = '/mnt/c/Users/guido/ghq/projects/rustdom';
const root = fs.readFileSync(task + '/.cache/attribute-copy-root.txt', 'utf8').trim();
const directory = root + '/reports/benchmarks/attribute-copy/aa-control';
const expectedHash = '10ebf630ccc70bf2ac94fec4c4a2e8ba2aaacb90070c4f229dabcde164a96803';
function read(round, stage) {
  const log = fs.readFileSync(`${directory}/round${round}-${stage}.log`, 'utf8');
  const file = log.match(/Guardado: (reports\/benchmarks\/[^\r\n]+\.json)/)?.[1];
  assert.ok(file);
  const report = JSON.parse(fs.readFileSync(root + '/' + file));
  assert.equal(report.complete, true); assert.equal(report.nativeBinarySha256, expectedHash);
  return { file, report };
}
function median(values) {
  const sorted = values.toSorted((left, right) => left - right), middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}
const stages = Object.fromEntries(['first', 'second'].map((stage) => [stage, [read(1, stage), read(2, stage)]]));
const rows = [];
for (const workload of stages.first[0].report.runs[0].workloads) {
  const samples = (stage) => stages[stage].flatMap(({ report }) => report.runs.filter((run) => run.engine === 'rustdom')
    .flatMap((run) => {
      const sample = run.workloads.find((entry) => entry.name === workload.name && entry.rows === workload.rows);
      assert.equal(sample.outputHash, workload.outputHash); return sample.samplesMs;
    }));
  const first = samples('first'), second = samples('second');
  assert.equal(first.length, 36); assert.equal(second.length, 36);
  const deviationPercent = (median(second) / median(first) - 1) * 100;
  rows.push({ workload: workload.name, size: workload.rows, firstMedianMs: median(first), secondMedianMs: median(second),
    deviationPercent, absoluteDeviationAboveFivePercent: Math.abs(deviationPercent) > 5, firstSamplesMs: first, secondSamplesMs: second });
}
assert.equal(rows.length, 12);
const summary = { capturedAt: new Date().toISOString(), node: stages.first[0].report.node,
  nativeBinarySha256: expectedHash, runtimeRoots: [...new Set(Object.values(stages).flatMap((entries) => entries.map(({ report }) => report.runtimeSource.root)))],
  reports: Object.values(stages).flatMap((entries) => entries.map(({ file }) => file)),
  interpretation: 'Diagnostic A/A of the same frozen checkpoint65 distribution. Observed differences measure repeatability, not a candidate improvement or acceptance. Original regression budgets remain unchanged.', rows };
fs.writeFileSync(directory + '/summary.json', JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify({ node: summary.node, rows: rows.length, overFive: rows.filter((row) => row.absoluteDeviationAboveFivePercent)
  .map(({ workload, size, deviationPercent }) => ({ workload, size, deviationPercent })) }, null, 2));
