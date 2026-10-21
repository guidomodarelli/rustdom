'use strict';
const fs = require('node:fs'), assert = require('node:assert/strict');
const directory = process.argv[2], index = JSON.parse(fs.readFileSync(directory + '/index.json'));
assert.equal(index.complete, true);
const median = (values) => { const sorted = [...values].sort((left, right) => left - right); const middle = Math.floor(sorted.length / 2); return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2; };
const summary = [];
for (const run of index.runs) {
  const report = JSON.parse(fs.readFileSync(directory + '/' + run.label + '.json'));
  assert.equal(report.nativeBinarySha256, '10ebf630ccc70bf2ac94fec4c4a2e8ba2aaacb90070c4f229dabcde164a96803');
  const samples = report.samples.filter((sample) => !sample.warmup);
  const trace = fs.readFileSync(directory + '/' + run.label + '.stdout.log', 'utf8');
  const firstMeasured = report.warmupBatches ?? report.settings.XML_SERIALIZER_WARMUP_BATCHES;
  const lastMeasured = firstMeasured + report.settings.XML_SERIALIZER_MEASURED_BATCHES - 1;
  const startMarker = trace.indexOf(`PROBE_START batch=${firstMeasured} `), endMarker = trace.lastIndexOf(`PROBE_END batch=${lastMeasured} `);
  if (run.traced) assert.ok(startMarker >= 0 && endMarker > startMarker, 'Both measurement markers must exist in the raw trace');
  const measuredTrace = run.traced ? trace.slice(startMarker, endMarker) : '';
  const overlapSamples = samples.filter((sample) => sample.gcOverlapMs > 0);
  summary.push({ label: run.label, row: run.row, node: report.node, traced: run.traced,
    medianCallMs: median(samples.map((sample) => sample.elapsedMs / report.batchSize)),
    halfDriftPercent: (median(samples.slice(16).map((sample) => sample.elapsedMs)) / median(samples.slice(0, 16).map((sample) => sample.elapsedMs)) - 1) * 100,
    medianCpuWallRatio: median(samples.map((sample) => (sample.cpuUserMs + sample.cpuSystemMs) / sample.elapsedMs)),
    minimumCpuWallRatio: Math.min(...samples.map((sample) => (sample.cpuUserMs + sample.cpuSystemMs) / sample.elapsedMs)),
    gcBatches: overlapSamples.length, gcOverlapMs: samples.reduce((total, sample) => total + sample.gcOverlapMs, 0),
    wallMs: samples.reduce((total, sample) => total + sample.elapsedMs, 0),
    jitTraceDuringMeasurement: measuredTrace.split('\n').filter((line) => /compiling method|completed compiling|bailout|deoptimizing/.test(line)),
    xmlCreated: report.statistics.xmlSerialization.created, xmlLive: report.statistics.xmlSerialization.live, outputHash: report.outputHash });
}
fs.writeFileSync(directory + '/summary.json', JSON.stringify(summary, null, 2) + '\n');
fs.copyFileSync(__filename, directory + '/analyze.cjs');
for (const row of summary) console.log(JSON.stringify({ ...row, jitTraceDuringMeasurement: row.jitTraceDuringMeasurement.length }));
