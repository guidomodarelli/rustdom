'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { estimatorView } = require('../../../benchmarks/native-class-ownership/shared-fixture-study/study.cjs');
const [directory, output] = process.argv.slice(2);
const index = JSON.parse(fs.readFileSync(path.join(directory, 'index.json'), 'utf8'));
assert.equal(index.complete, true); assert.equal(index.processes.length, 80);
const groups = {};
for (const [ordinal, entry] of index.processes.entries()) {
  const report = JSON.parse(fs.readFileSync(path.join(directory, ordinal < 40 ? 'node22' : 'node24', String(ordinal % 40).padStart(3, '0'), 'report.json'), 'utf8'));
  const view = estimatorView(report); const key = `${report.node}/${report.schedule.physical}`;
  const group = groups[key] ?? { reports: 0, serializedOriginalBytes: 0, serializedEstimatorBytes: 0, measuredDurations: 0 };
  group.reports++; group.serializedOriginalBytes += Buffer.byteLength(JSON.stringify(report));
  group.serializedEstimatorBytes += Buffer.byteLength(JSON.stringify(view));
  for (const [position, batch] of report.batches.entries()) {
    assert.deepEqual(view.batches[position].samplesMs, batch.samplesMs);
    assert.equal(view.batches[position].outputHash, batch.outputHash);
    group.measuredDurations += batch.samplesMs.length;
  }
  assert.deepEqual(view.randomProbe, report.randomProbe); groups[key] = group;
}
const totals = Object.values(groups).reduce((total, group) => Object.fromEntries(Object.keys(group).map((name) => [name, (total[name] ?? 0) + group[name]])), {});
const result = { samplerInvoked: false, freshDOMExecuted: false, performanceAccepted: null,
  source: 'Existing authenticated functional qualification published in 8ea5f569', totals, groups,
  limits: ['Bytes JSON serializados de reportes guardados; no son heap, RSS, memoria pico ni medición de una fuga',
    'La proyección conserva números/hash/RNG del estimador; los reportes crudos no se modifican',
    'El estudio nuevo sigue sin ejecutar; no se extrapola una garantía de memoria a todo rustdom'] };
fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ totals, samplerInvoked: false }));
