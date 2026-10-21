/** Archive provenance and publish every hosted row after independent raw-data verification. */
'use strict';
const fs = require('node:fs'), path = require('node:path');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const directory = path.resolve('reports/benchmarks/xml-serializer-controller/hosted/39613158016');
const report = JSON.parse(fs.readFileSync(path.join(directory, 'experiment.json')));
const verification = JSON.parse(fs.readFileSync(path.join(directory, 'verification.json')));
assert.equal(verification.performanceAcceptanceComplete, true);
assert.equal(report.runs.length, 468);
for (const filename of ['README.md', 'provenance.json', 'manifest.json']) assert.ok(!fs.existsSync(path.join(directory, filename)));
const maximumAA = Math.max(...report.calibration.rows.map((row) => Math.abs(row.changePercent)));
const maximumAB = Math.max(...report.comparisons.map((row) => row.changePercent));
const referenceRatios = report.referenceComparison.map((row) => row.candidateMs / row.baselineMs);
const provenance = { runId: 39613158016, jobId: 119267080556, artifactId: 12354526133,
  artifactSha256: '2e63cf64d5c1fad02670144185ec7e4ebc7fb6172ef27e316132356d6ff23958',
  requestedHead: report.requestedHead, measuredCommit: report.sourceIdentity.sourceCommit,
  measuredTree: '80c9cf8bedb2ed6e4e4dd53e070ad113a6233e6b', candidateTree: '80c9cf8bedb2ed6e4e4dd53e070ad113a6233e6b',
  sourceHash: report.sourceIdentity.sourceHash, baselineSourceHash: report.baselineSourceIdentity.sourceHash,
  candidateBinary: report.candidateBinary, baselineBinary: report.baselineBinary,
  maximumAbsoluteCalibrationPercent: maximumAA, maximumCandidateChangePercent: maximumAB,
  scope: 'Prepared public XML workloads on this hosted Linux runner; no universal performance or memory claim' };
fs.writeFileSync(path.join(directory, 'provenance.json'), JSON.stringify(provenance, null, 2) + '\n');
const lines = ['# Node 24: resultados verificados del runner Linux', '',
  '[Run 39613158016](https://github.com/guidomodarelli/rustdom/actions/runs/39613158016), Node 24.14.1 y Rust 1.99.1, Ubuntu 22.04, AMD EPYC 7763 y afinidad CPU 0.', '',
  `Se verificaron los 468 procesos: 208 A/A, 208 A/B y 52 descriptivos contra jsdom. Las trece filas calibraron dentro de ±2% (máximo absoluto ${maximumAA.toFixed(3)}%). A/B quedó dentro del presupuesto +5% en todas las filas (máximo +${maximumAB.toFixed(3)}%). Cada etiqueta conserva 256 muestras por fila de A/A y A/B; la referencia descriptiva tiene 64.`, '',
  'La verificación independiente recalcula medianas y gates, contrasta cada stdout con el índice, comprueba hashes de salida entre etapas/motores, tamaños de warmup, orden de procesos, contadores de la ruta nativa y referencias temporales liberadas. También verifica fuentes del baseline/candidato y el head solicitado. El ZIP descargado coincide con el digest SHA-256 de GitHub.', '',
  'La aceptación se limita a este host y protocolo. Los fallos locales de Node 24 y los protocolos anteriores permanecen publicados. Junto con la aceptación local de Node 22, completa el control predeclarado de este hito; no demuestra rendimiento universal ni una aceleración global.', '',
  `La referencia descriptiva conserva costes Rust entre ${Math.min(...referenceRatios).toFixed(2)}× y ${Math.max(...referenceRatios).toFixed(2)}× los de jsdom en estas filas. Migrar este control no resuelve esa desventaja.`, '',
  '| Tarea | Tamaño | A/A | A/B | Coste Rust/jsdom |', '| --- | ---: | ---: | ---: | ---: |'];
for (let index = 0; index < report.comparisons.length; index++) {
  const row = report.comparisons[index];
  lines.push(`| ${row.name} | ${row.size} | ${report.calibration.rows[index].changePercent.toFixed(2)}% | ${row.changePercent.toFixed(2)}% | ${referenceRatios[index].toFixed(2)}× |`);
}
lines.push('', 'Las muestras crudas y la variación por proceso/mitad siguen en los JSON; no se filtraron outliers ni se compensaron filas.', '',
  `Fuente candidata: \`${report.sourceIdentity.sourceHash}\`. Fuente de referencia: \`${report.baselineSourceIdentity.sourceHash}\`.`, '',
  'El commit de merge temporal de GitHub y el head revisado tienen el mismo árbol; provenance.json registra ambos y los binarios. verify-and-report.cjs reproduce la comprobación sobre los datos archivados:', '',
  '```sh', 'node reports/benchmarks/xml-serializer-controller/hosted/39613158016/verify-and-report.cjs \\',
  '  reports/benchmarks/xml-serializer-controller/hosted/39613158016 \\', '  62cf726cc0ed0d1487db9dfa2100a78568638108', '```', '');
fs.writeFileSync(path.join(directory, 'README.md'), lines.join('\n'));
fs.copyFileSync(__filename, path.join(directory, 'publish-report.cjs'));
const files = fs.readdirSync(directory).sort().map((filename) => ({ path: filename, bytes: fs.statSync(path.join(directory, filename)).size,
  sha256: createHash('sha256').update(fs.readFileSync(path.join(directory, filename))).digest('hex') }));
fs.writeFileSync(path.join(directory, 'manifest.json'), JSON.stringify({ files }, null, 2) + '\n');
console.log(JSON.stringify({ files: files.length, maximumAA, maximumAB, performanceAcceptanceComplete: true }));
