import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
const root = process.argv[2];
const evidence = JSON.parse(await readFile(`${root}/reports/validation/element-relatives/evidence.json`));
const comparison = JSON.parse(await readFile(`${root}/reports/benchmarks/element-relatives/comparison.json`));
const loadRaw = async (entry) => {
  const bytes = await readFile(`${root}/${entry.path}`);
  return entry.compression === 'gzip' ? gunzipSync(bytes).toString() : bytes.toString();
};
const generalEntry = evidence.files.find((entry) => /^reports\/memory\/element-relatives\/history\/\d.*linux-x64\.json/.test(entry.path));
assert.ok(generalEntry);
const general = JSON.parse(await loadRaw(generalEntry));
assert.equal(general.pass, true); assert.equal(general.results.length, 5);
const memoryRows = general.results.map((result) => `| ${result.mode} | ${result.survivingDocuments}/${result.observedDocuments} | ${result.survivingWindows}/${result.observedWindows} | ${(result.growth.heapUsed / 1024 ** 2).toFixed(2)} | ${(result.growth.rss / 1024 ** 2).toFixed(2)} |`);
const nativeEntry = evidence.files.find((entry) => /history\/\d.*-valgrind\.json/.test(entry.path));
assert.ok(nativeEntry);
const native = JSON.parse(await loadRaw(nativeEntry));
assert.equal(native.pass, true);
const summaries = [];
for (const run of native.runs) {
  const name = run.logPath.split('/').at(-1);
  const entry = evidence.files.find((file) => file.path.endsWith('/' + name) || file.path.endsWith('/' + name + '.gz'));
  assert.ok(entry);
  const text = await loadRaw(entry);
  const field = (pattern) => Number(text.match(pattern)?.[1].replaceAll(',', ''));
  const summary = { errors: field(/ERROR SUMMARY: ([\d,]+) errors/), definite: field(/definitely lost:\s+([\d,]+) bytes/),
    indirect: field(/indirectly lost:\s+([\d,]+) bytes/), possible: field(/possibly lost:\s+([\d,]+) bytes/), reachable: field(/still reachable:\s+([\d,]+) bytes/) };
  assert.equal(summary.errors, 0); assert.equal(summary.definite, 0); assert.equal(summary.indirect, 0);
  summaries.push(summary);
}
const range = (field) => `${Math.min(...summaries.map((entry) => entry[field]))}–${Math.max(...summaries.map((entry) => entry[field]))}`;
const percent = (value) => `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
const deltas = comparison.comparisons.map((entry) => entry.deltaPercent);
await writeFile(`${root}/reports/memory/element-relatives/README.md`, [
  '# Memoria de hijos y hermanos Element', '',
  'Los 44 escenarios focales aprobaron en Node 22.12.0 y 24.14.1, comparando jsdom 27.4.0 y rustdom en default/VM. Se conserva el historial de 30/40 escenarios.', '',
  '- Ciclos de creación, mutación, consulta, cierre y liberación; Document y Window se observan por separado.',
  '- Una colección children retenida conserva sus owners; después de soltarla se exige cero supervivientes.',
  '- Un hijo removido se recolecta mientras la colección y su padre/documento siguen retenidos.',
  '- Retener solo IDs/nombres de descendientes, children y form.elements permite recolectar todos los owners DOM. Se conservan los controles con Float64Array.from alterado.',
  '- Los contadores nativos de vida vuelven al baseline; los acumulativos de operaciones son diagnóstico.', '',
  'El núcleo recorre enlaces y metadatos existentes. No agrega caches, refs persistentes N-API ni owners nativos. Los resultados numéricos no retienen nodos. La lista viva conserva sus referencias visibles a V8; la invalidación existente puede refrescar children durante la mutación. childElementCount continúa observando esa lista.', '',
  'Estrés general en procesos separados de Node 24, después de warmup y GC:', '',
  '| Modo | Document supervivientes | Window supervivientes | Δ heap MiB | Δ RSS MiB |',
  '|---|---:|---:|---:|---:|', ...memoryRows, '',
  `Memcheck ejecutó ${evidence.validation.rustMemcheckTests} tests Rust en ${native.runs.length} lotes: cero errores y cero bytes perdidos definitiva/indirectamente. Los logs conservan ${range('possible')} bytes posibles y ${range('reachable')} bytes alcanzables por proceso; sus stacks siguen visibles.`, '',
  'Los stacks residuales corresponden a std::thread/current, el contexto mpmc del harness y stack_overflow/thread_info. Los mismos 48/548 bytes aparecen en los nueve procesos del control anterior de 275 tests; la comparación de ambos inventarios y duraciones se conserva en native-memory-baseline-comparison.json. Los lotes cambiaron de miembros y sus tiempos son diagnóstico, no un benchmark equivalente.', '',
  'Memcheck cubre el ejecutable Rust; GC ejerce el addon real dentro de Node. Heap, external y RSS son muestras después de GC, no picos. RSS puede conservar memoria del allocator. Las pruebas finitas no demuestran ausencia absoluta de fugas ni auditan todas las dependencias.', '',
  '[Inventario y trazas originales](../../validation/element-relatives/evidence.json).', '',
].join('\n'));
await writeFile(`${root}/reports/validation/element-relatives.md`, [
  '# Hijos y hermanos Element en Rust', '',
  'El hito migra el recorrido físico y filtrado de children, firstElementChild, lastElementChild, nextElementSibling y previousElementSibling a Rust. Reutiliza enlaces y node_kind canónicos; no entra en descendientes, hosts shadow ni template.content. El puente devuelve las identidades originales.', '',
  'WebIDL, factories, la lista viva y su invalidación conservan la integración actual. childElementCount sigue leyendo children: las mutaciones pueden refrescar su caché antes de la siguiente lectura. El runtime continúa siendo híbrido y el objetivo integral sigue abierto.', '',
  'Base medida: PR 72 corregido (`2ae5f2c`), cuyos 567 archivos de dist se cotejaron antes de medir. foundation/ conserva su integración en main y checkpoint 60. La rama de este hito es feature/native-element-relatives; verificar el PR remoto antes de asumir integración.', '',
  '| Validación | Resultado |',
  '|---|---|',
  '| Rust 1.98.1 / 1.99.1 | Clippy y 281 tests por versión |',
  '| Node 22.12.0 / 24.14.1 | 3.358 contratos, Jest 21, Vitest 32 y VM 32 por versión |',
  '| Focales integrados | 613 por Node; incluyen 55 de Element y regresiones previas de colecciones |',
  '| Harness de benchmarks | 64 por Node, 12 nuevos sobre motores reales |',
  '| GC focal | 44 escenarios por Node |',
  '| Paquete instalado | 20 controles por Node con npm/pnpm, mismo archivo |',
  '| HTML5 | 1.784 comparables por Node; exclusiones conservadas |',
  ...evidence.validation.wptReports.map((entry) => `| WPT ${entry.node} | ${entry.fixtures} fixtures y ${entry.assertions} resultados en paridad; ${entry.sharedStandardsFailures} fallos de estándar compartidos |`), '',
  'WPT mantiene complete:false, exclusiones y el bootstrap bloqueado de Range-deleteContents; la paridad no certifica todos los estándares.', '',
  'Las comparaciones diferenciales cubren HTML/quirks/XML, default/VM, Text/Comment/PI/CDATA, namespaces, Document/fragmentos, identidades, adopción, mutaciones, templates y scopes shadow. Las seis regresiones de Array.from fallaban antes de sustituir el mapeo del puente por un bucle de identidades; el recorrido y filtrado permanecen en Rust.', '',
  'El reviewer Codex aislado terminó sin hallazgos accionables sobre el diff actualizado. Fue una revisión estática; las ejecuciones corresponden a los gates registrados. Los fallos históricos de nombre interno y expectativa del contador se conservan sin debilitar los contratos diferenciales.', '',
  `Ocho reportes de rendimiento conservan 32 workers y 36 muestras por fila/motor/etapa/runtime. La variación frente al baseline es ${percent(Math.min(...deltas))} a ${percent(Math.max(...deltas))}; se conservan todas las filas y regresiones.`,
  'Las entradas mezclan 100/1.000 nodos físicos y consumen cien operaciones públicas. Preparación, validación, cierre y GC quedan fuera del temporizador. No se afirma velocidad universal ni un resultado sobre suites completas.', '',
  `Fuente canónica: \`${evidence.sourceHash}\`.`,
  `Addon validado: \`${evidence.nativeBinarySha256}\`.`,
  `Paquete instalado: \`${evidence.packageReports[0].packageSha256}\`.`, '',
  '- [Inventario, comandos, fallos históricos y checksums](element-relatives/evidence.json).',
  '- [Benchmarks completos](../benchmarks/element-relatives/README.md).',
  '- [Memoria, ownership y límites](../memory/element-relatives/README.md).', '',
  'Los datos grandes usan gzip sin pérdida; el inventario verifica bytes originales y publicados. Continúan pendientes factories, algoritmos DOM y APIs delegadas a JavaScript/jsdom.', '',
].join('\n'));
console.log(JSON.stringify({ rendered: true, generalMemory: general.results.map(({ mode, pass }) => ({ mode, pass })), nativeSummaries: summaries }));
