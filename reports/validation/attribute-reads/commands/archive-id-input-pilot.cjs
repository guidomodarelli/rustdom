'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { gzipSync } = require('node:zlib');
const prototype = '/home/guido/rustdom-id-inputs-2pX7dZ';
const destination = process.argv[2] + '/reports/benchmarks/utf16-input-pilot';
fs.mkdirSync(destination + '/raw', { recursive: true });
const checksum = (data) => createHash('sha256').update(data).digest('hex');
const files = [];
function archive(relative, source) {
  const data = fs.readFileSync(source); const compressed = gzipSync(data);
  const target = path.join(destination, relative + '.gz'); fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, compressed); files.push({ path: relative + '.gz', originalBytes: data.length,
    originalSha256: checksum(data), gzipSha256: checksum(compressed) });
}
const inputs = fs.readdirSync(prototype + '/reports/benchmarks').filter((name) => name.endsWith('.json')).sort();
assert.equal(inputs.length, 4);
const reports = inputs.map((name) => JSON.parse(fs.readFileSync(prototype + '/reports/benchmarks/' + name)));
const summary = { disposition: 'rejected', reason: 'No consistent improvement across both Node versions; no production source from this prototype was adopted.',
  capturedAt: new Date().toISOString(), baseline: { commit: 'baa87fa3eb1a62ec6477013bb305b2a79a0c3bb6',
    reviewedHead: 'be90ba1ac6b7404c585a8e1905e7808d883b512b', checkpoint: 'checkpoint-064-id-lookups',
    sourceHash: '95f641ef6dd84ddac7bbd70119121ece19669c125d5bb3c70d9693c9770a19b1',
    nativeBinarySha256: 'cc8852f6ba6e3755fbe8805948c8fb71bd140323b08b86d091727aacc8ed6753' },
  prototype: { sourceHash: '59ea3fe29dd58ba5bbbd9413513d46f925318fc4f2e59329e355a100f63059f0',
    nativeBinarySha256: 'b2c3f9e97745eff0b4b744309ce28a25ca1c95c23c57cab256a2e9f85a4a6b2e' },
  methodology: 'Diagnostic only: baseline then candidate, one report per stage/runtime, four alternating-engine workers/report and 18 samples/row/engine/stage/runtime. No reverse stage order; not final balanced evidence. The pilot overlapped Git metadata/merge operations. Initial CPU profiles include profiler overhead and are not controlled timing comparisons.',
  limits: 'Only short inputs were timed. Long fallback cost was not benchmarked. Rust 1.99, focused Node contracts and static review passed, but full release gates, memory and package validation were not completed for the rejected prototype. V8 native frame labels do not isolate conversion from lookup or binding overhead.',
  rows: [], files };
for (let index = 0; index < reports.length; index += 2) {
  const before = reports[index], after = reports[index + 1];
  assert.equal(before.node, after.node); assert.equal(before.complete, true); assert.equal(after.complete, true);
  assert.equal(before.nativeBinarySha256, summary.baseline.nativeBinarySha256);
  assert.equal(after.nativeBinarySha256, summary.prototype.nativeBinarySha256);
  assert.equal(before.comparisons.length, 10); assert.equal(after.comparisons.length, 10);
  for (let row = 0; row < before.comparisons.length; row++) {
    const left = before.comparisons[row], right = after.comparisons[row];
    assert.equal(left.workload, right.workload); assert.equal(left.rows, right.rows);
    for (const engine of ['jsdom', 'rustdom']) assert.equal(left[engine].samples, 18);
    summary.rows.push({ node: before.node, workload: left.workload, size: left.rows,
      baselineMedianMs: left.rustdom.medianMs, prototypeMedianMs: right.rustdom.medianMs,
      rustdomDurationChangePercent: (right.rustdom.medianMs / left.rustdom.medianMs - 1) * 100,
      jsdomControlChangePercent: (right.jsdom.medianMs / left.jsdom.medianMs - 1) * 100 });
  }
}
for (const name of inputs) archive('raw/' + name, prototype + '/reports/benchmarks/' + name);
for (const file of ['src/dom/constants.rs', 'src/dom/napi_string.rs', 'src/dom/tree.rs', 'tests/id-inputs.spec.cjs']) archive('rejected-source/' + file.replaceAll('/', '-'), prototype + '/' + file);
for (const file of ['baseline.json', 'prototype-source.json', 'pilot.log', 'clippy.log', 'rust-tests.log',
  'focal-v22.12.0.log', 'focal-v24.14.1.log']) archive('validation/' + file, prototype + '/reports/validation/id-inputs/' + file);
for (const file of fs.readdirSync(prototype + '/reports/validation/id-inputs/initial-profiles')) archive('profiles/' + file, prototype + '/reports/validation/id-inputs/initial-profiles/' + file);
fs.writeFileSync(destination + '/comparison.json', JSON.stringify(summary, null, 2) + '\n');
const rows = summary.rows.map((row) => `| ${row.node} | ${row.workload} | ${row.size} | ${row.rustdomDurationChangePercent.toFixed(2)}% | ${row.jsdomControlChangePercent.toFixed(2)}% |`);
fs.writeFileSync(destination + '/README.md', '# Piloto descartado: conversión de inputs UTF-16\n\n' +
  'La conversión inline de strings cortos no mostró una mejora consistente en Node 22.12.0 y 24.14.1. No se incorporó su código al runtime. La base corresponde al PR 76 integrado en checkpoint-064-id-lookups; el prototipo usa el addon indicado en comparison.json.\n\n' +
  'Estas son mediciones de diagnóstico: un orden baseline → prototipo, cuatro workers alternando motores por reporte y dieciocho muestras por fila/motor/etapa/runtime. Faltó el orden inverso; hubo operaciones Git de integración durante el piloto. No constituyen evidencia final balanceada ni una mejora general. Un valor positivo indica mayor duración.\n\n' +
  '| Node | Tarea | Element | Cambio rustdom | Cambio del control jsdom |\n|---|---|---:|---:|---:|\n' + rows.join('\n') + '\n\n' +
  'Se preservan muestras crudas, hashes originales y comprimidos, perfiles iniciales, fuentes descartadas y validaciones focales. No se ejecutaron gates completos, Memcheck ni instalación del prototipo; tampoco se midió el fallback de strings largos. Los perfiles incluyen overhead del profiler y el nombre compartido del thunk nativo no identifica por sí solo el costo de conversión. Esta reserva evita presentar una hipótesis como un hallazgo de rendimiento.\n');
console.log(JSON.stringify({ disposition: summary.disposition, rows: summary.rows.length, archivedFiles: files.length }));
