'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = '/home/guido/rustdom-attribute-copy-zCfwmZ';
const output = root + '/reports/benchmarks/attribute-copy';
const budget = JSON.parse(fs.readFileSync('/mnt/c/Users/guido/.codex/worktrees/native-clone-seeds/rustdom/reports/benchmarks/attribute-copy/public-clone-budget.json'));
const variants = JSON.parse(fs.readFileSync(output + '/variants.json'));
function reportFor(log) {
  const text = fs.readFileSync(output + '/' + log, 'utf8');
  const match = text.match(/Guardado: (reports\/benchmarks\/[^\r\n]+\.json)/);
  assert.ok(match, `Missing completed report in ${log}`);
  const report = JSON.parse(fs.readFileSync(root + '/' + match[1]));
  return { file: match[1], report };
}
function median(samples) {
  const sorted = samples.toSorted((left, right) => left - right), middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}
const summary = { capturedAt: new Date().toISOString(), budget, sourceHash: variants.sourceIdentity.sourceHash,
  methodology: 'Two reversed stage rounds per Node, each with the existing reversed engine order and three warmups plus nine measured samples per worker. Pool 36 raw samples per engine/stage/row. Evaluate every unadjusted candidate median against checkpoint65; wins do not offset over-budget rows. Keep per-round direction and the independent jsdom timings visible.',
  micro: [], public: [], publicBudgetPass: false };
for (const version of ['v24.14.1', 'v22.12.0']) {
  const micro = reportFor(`micro-${version}.log`);
  assert.equal(micro.report.pass, true);
  summary.micro.push({ node: version, report: micro.file, rows: micro.report.rows });
  const reports = Object.fromEntries(['baseline', 'candidate'].map((stage) => [stage, [1, 2].map((round) => {
    const entry = reportFor(`public-${version}-round${round}-${stage}.log`);
    assert.equal(entry.report.complete, true);
    assert.equal(entry.report.node, version);
    assert.equal(entry.report.sourceHash, summary.sourceHash);
    assert.equal(entry.report.nativeBinarySha256, variants.variants[stage].files.find((file) => file.path === 'dist/rustdom.node').sha256);
    return { round, ...entry };
  })]));
  for (const workload of reports.baseline[0].report.runs[0].workloads) {
    const byStage = {};
    for (const [stage, entries] of Object.entries(reports)) {
      byStage[stage] = {};
      for (const engine of ['rustdom', 'jsdom']) {
        const selected = entries.flatMap((entry) => entry.report.runs.filter((run) => run.engine === engine).map((run) => {
          const selectedWorkload = run.workloads.find((candidate) => candidate.name === workload.name && candidate.rows === workload.rows);
          assert.ok(selectedWorkload);
          assert.equal(selectedWorkload.outputHash, workload.outputHash);
          return selectedWorkload;
        }));
        const samplesMs = selected.flatMap((entry) => entry.samplesMs);
        assert.equal(samplesMs.length, 36);
        byStage[stage][engine] = { medianMs: median(samplesMs), samplesMs };
      }
    }
    const regressionPercent = (byStage.candidate.rustdom.medianMs / byStage.baseline.rustdom.medianMs - 1) * 100;
    const isClone = workload.name.startsWith('clone-') || workload.name.startsWith('import-');
    const allowedPercent = isClone ? budget.cloneMedianRegressionBudgetPercent : budget.controlMedianRegressionBudgetPercent;
    summary.public.push({ node: version, workload: workload.name, size: workload.rows, category: isClone ? 'clone/import' : 'control',
      outputHash: workload.outputHash, ...byStage, regressionPercent, allowedPercent, withinBudget: regressionPercent <= allowedPercent,
      rounds: [0, 1].map((index) => ({ round: index + 1,
        baselineReport: reports.baseline[index].file, candidateReport: reports.candidate[index].file,
        regressionPercent: (reports.candidate[index].report.comparisons.find((entry) => entry.workload === workload.name && entry.rows === workload.rows).rustdom.medianMs /
          reports.baseline[index].report.comparisons.find((entry) => entry.workload === workload.name && entry.rows === workload.rows).rustdom.medianMs - 1) * 100 })) });
  }
}
assert.equal(summary.public.length, 40);
summary.publicBudgetPass = summary.public.every((entry) => entry.withinBudget);
fs.writeFileSync(output + '/summary.json', JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify({ publicBudgetPass: summary.publicBudgetPass, rows: summary.public.length,
  overBudget: summary.public.filter((entry) => !entry.withinBudget).map(({ node, workload, size, regressionPercent, rounds }) => ({ node, workload, size, regressionPercent, rounds })),
  micro: summary.micro.map((entry) => ({ node: entry.node, rows: entry.rows })) }, null, 2));
