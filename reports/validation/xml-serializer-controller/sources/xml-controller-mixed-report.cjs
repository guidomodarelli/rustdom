'use strict';
const fs = require('node:fs'), assert = require('node:assert/strict');
const directory = 'reports/benchmarks/xml-serializer-controller';
const reports = ['v22.12.0', 'v24.14.1'].map((version) => JSON.parse(fs.readFileSync(`${directory}/${version}/experiment.json`)));
for (const report of reports) {
  assert.equal(report.complete, true); assert.equal(report.calibration.pass, false);
  assert.equal(report.comparisons.length, 0); assert.equal(report.referenceComparison.length, 13);
}
const failures = reports.map((report) => report.calibration.rows.filter((row) => Math.abs(row.changePercent) > report.calibration.budgetPercent).length);
const text = ['# Resultados del primer protocolo XML', '',
  `A/A falló en ${failures[0]}/13 filas en Node 22 y ${failures[1]}/13 en Node 24. Se conservaron 128 muestras por etiqueta y fila; no se ejecutó A/B ni se aceptó el gate de rendimiento.`, '',
  'La tabla conserva todas las filas. A/A compara el mismo binario anterior; sus cambios son ruido/variación observada, no regresiones del candidato. Rust/jsdom es el cociente descriptivo de tiempos medianos de las llamadas públicas completas sobre DOMs preparados y reutilizados: mayor que 1 significa más lento. La diferencia de motores es grande en este corpus; el controlador nuevo no se presenta como una mejora de rendimiento.', '',
  '| Tarea | Rows | A/A Node 22 | A/A Node 24 | Rust/jsdom Node 22 | Rust/jsdom Node 24 |',
  '| --- | ---: | ---: | ---: | ---: | ---: |'];
for (let index = 0; index < 13; index++) {
  const before = reports[0].calibration.rows[index], after = reports[1].calibration.rows[index];
  assert.equal(`${before.name}/${before.size}`, `${after.name}/${after.size}`);
  const ratios = reports.map((report) => { const row = report.referenceComparison[index]; return (row.candidateMs / row.baselineMs).toFixed(2) + '×'; });
  text.push(`| ${before.name} | ${before.size} | ${before.changePercent.toFixed(2)}% | ${after.changePercent.toFixed(2)}% | ${ratios[0]} | ${ratios[1]} |`);
}
text.push('', 'Los JSON por Node conservan todas las muestras de warmup y medición, hashes de salida, fuentes, hardware, procesos y deriva por mitades. El primer harness tiene sourceHash `'+reports[0].sourceIdentity.sourceHash+'`. Su fuente exacta está en `../../validation/xml-serializer-controller/sources-mixed-rows/`.', '',
  'El diagnóstico siguiente está predeclarado en `row-isolated-protocol.md`. Los ejecutores archivados son one-off sobre copias frescas de fuentes sin resultados anteriores: no ejecutarlos sobre estos directorios históricos ni sobrescribir sus archivos; usar una nueva carpeta de ejecución.', '');
fs.writeFileSync(`${directory}/mixed-row-results.md`, text.join('\n'));
console.log(JSON.stringify({ failures, nativeNodes: reports.map((report) => Object.fromEntries(Object.entries(report.runs[0].observations.statistics).filter(([, value]) => typeof value === 'number'))) }));
