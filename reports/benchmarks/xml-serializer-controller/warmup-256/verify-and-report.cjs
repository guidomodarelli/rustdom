/** Validate the completed experiment's raw artifacts before publishing all rows. */
'use strict';
const fs = require('node:fs'), assert = require('node:assert/strict');
const directory = 'reports/benchmarks/xml-serializer-controller/warmup-256';
const versions = ['v22.12.0', 'v24.14.1'];
const reports = versions.map((version) => JSON.parse(fs.readFileSync(`${directory}/${version}/experiment.json`)));
const checks = [];
for (let index = 0; index < reports.length; index++) {
  const report = reports[index];
  assert.equal(report.node, versions[index]); assert.equal(report.complete, true);
  assert.equal(report.calibration.pass, index === 0); assert.equal(report.accepted, index === 0 ? true : null);
  assert.equal(report.calibration.rows.length, 13); assert.equal(report.comparisons.length, index === 0 ? 13 : 0);
  assert.equal(report.referenceComparison?.length ?? 0, index === 0 ? 13 : 0);
  assert.equal(report.baselineBinary, reports[0].baselineBinary); assert.equal(report.candidateBinary, reports[0].candidateBinary);
  assert.equal(report.sourceIdentity.sourceHash, reports[0].sourceIdentity.sourceHash);
  const stages = { AA: 0, AB: 0, reference: 0 };
  for (const run of report.runs) {
    stages[run.stage]++;
    assert.equal(run.exitCode, 0);
    const raw = JSON.parse(fs.readFileSync(`${directory}/${report.node}/${run.stdoutFile}`));
    assert.deepEqual(raw, run.observations);
    assert.equal(raw.results.length, 1);
    const row = raw.results[0], warmup = report.settings.XML_SERIALIZER_WARMUP_BATCHES_BY_SIZE[row.size] ?? report.settings.XML_SERIALIZER_WARMUP_BATCHES;
    assert.equal(row.warmupBatches, warmup); assert.equal(row.warmupBatchMs.length, warmup); assert.equal(row.measuredBatchMs.length, 32);
    assert.ok([...row.warmupBatchMs, ...row.measuredBatchMs].every((value) => Number.isFinite(value) && value > 0));
    if (run.engine === 'rustdom') {
      assert.equal(raw.statistics.xmlSerialization.live, 0); assert.equal(raw.statistics.xmlSerialization.references, 0);
      assert.equal(raw.statistics.xmlSerialization.cleanupErrors, 0);
      if (raw.statistics.xmlSerializerOperations) {
        const direct = row.name === 'xml-serialize' || row.name === report.settings.XML_SERIALIZER_GETTER_ERROR_WORKLOAD;
        assert.equal(raw.statistics.xmlSerializerOperations.calls, direct ? (warmup + 32) * row.batchSize : 0);
        assert.equal(raw.statistics.xmlSerializerOperations.active, 0);
      }
    }
  }
  assert.deepEqual(stages, index === 0 ? { AA: 208, AB: 208, reference: 52 } : { AA: 208, AB: 0, reference: 0 });
  for (const row of report.calibration.rows) { if (report.calibration.pass) assert.ok(Math.abs(row.changePercent) <= 2); assert.deepEqual(row.samplesPerLabel, { A: 256, B: 256 }); }
  for (const row of report.comparisons) { assert.ok(row.changePercent <= 5); assert.deepEqual(row.samplesPerLabel, { A: 256, B: 256 }); }
  checks.push({ node: report.node, stages, calibrated: report.calibration.pass, accepted: report.accepted,
    maxChangePercent: report.comparisons.length ? Math.max(...report.comparisons.map((row) => row.changePercent)) : null });
}
const lines = ['# Resultados con warmup revisado', '',
  'Node 22 completó 208 procesos A/A, 208 A/B y 52 descriptivos contra jsdom. Node 24 completó 208 A/A y se detuvo sin A/B ni referencia al fallar su calibración. Cada fila de A/A y A/B conserva 256 muestras por etiqueta. La verificación contrasta cada stdout crudo con el índice, longitudes de warmup/muestras, contadores nativos y referencias temporales.', '',
  'Node 22 calibra dentro de ±2% y pasa el gate de +5% en todas las filas (máximo +2,522%). Node 24 no calibra en dos filas de tamaño uno. El hito no tiene aceptación global: se conserva variación entre procesos y mitades, y el siguiente control de Node 24 está predeclarado en hosted-protocol.md. No certifica otras máquinas, operaciones sobre documentos recién creados ni mejora general sobre jsdom.', '',
  '| Tarea | Rows | A/A Node 22 | A/B Node 22 | A/A Node 24 | A/B Node 24 |', '| --- | ---: | ---: | ---: | ---: | ---: |'];
for (let index = 0; index < 13; index++) {
  const row = reports[0].comparisons[index];
  assert.equal(`${row.name}/${row.size}`, `${reports[1].calibration.rows[index].name}/${reports[1].calibration.rows[index].size}`);
  lines.push(`| ${row.name} | ${row.size} | ${reports[0].calibration.rows[index].changePercent.toFixed(2)}% | ${row.changePercent.toFixed(2)}% | ${reports[1].calibration.rows[index].changePercent.toFixed(2)}% | — |`);
}
lines.push('', 'La referencia descriptiva contra jsdom se conserva completa en los JSON. Los pilotos que no calibraron permanecen publicados; sus datos no se incorporan a esta aceptación.', '',
  `Harness: \`${reports[0].sourceIdentity.sourceHash}\`. Baseline: \`${reports[0].baselineBinary}\`. Candidato: \`${reports[0].candidateBinary}\`.`, '');
fs.writeFileSync(directory + '/README.md', lines.join('\n'));
fs.writeFileSync(directory + '/verification.json', JSON.stringify({ scope: 'Raw artifact consistency, not global performance acceptance',
  checks, verificationPass: true, performanceAcceptanceComplete: reports.every((report) => report.calibration.pass && report.accepted === true) }, null, 2) + '\n');
fs.copyFileSync(__filename, directory + '/verify-and-report.cjs');
console.log(JSON.stringify(checks));
