'use strict';
const fs = require('node:fs');
for (const node of ['v22.12.0', 'v24.14.1']) {
  const variant = process.argv[2] ? process.argv[2] + '/' : '';
  const file = `reports/benchmarks/xml-serializer-controller/${variant}${node}/experiment.json`;
  if (!fs.existsSync(file)) continue;
  const report = JSON.parse(fs.readFileSync(file));
  console.log(JSON.stringify({ node, complete: report.complete, calibrated: report.calibration?.pass,
    rows: report.calibration?.rows.map((row) => ({ name: row.name, size: row.size, changePercent: row.changePercent,
      phaseSpreadPercent: (Math.max(...row.phases.map((phase) => phase.medianMs)) / Math.min(...row.phases.map((phase) => phase.medianMs)) - 1) * 100,
      maxAbsoluteHalfDriftPercent: Math.max(...row.phases.map((phase) => Math.abs((phase.lastHalfMs / phase.firstHalfMs - 1) * 100))) })),
    accepted: report.accepted, comparisons: report.comparisons,
    reference: report.referenceComparison?.map((row) => ({ name: row.name, size: row.size, jsdomMs: row.baselineMs, rustdomMs: row.candidateMs })) }));
}
