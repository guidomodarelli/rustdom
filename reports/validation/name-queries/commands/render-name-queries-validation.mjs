import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';

const root = process.argv[2];
const evidence = JSON.parse(await readFile(`${root}/reports/validation/name-queries/evidence.json`));
const comparison = JSON.parse(await readFile(`${root}/reports/benchmarks/name-queries/comparison.json`));
const loadRaw = async (entry) => {
  const bytes = await readFile(`${root}/${entry.path}`);
  return entry.compression === 'gzip' ? gunzipSync(bytes).toString() : bytes.toString();
};
const generalEntry = evidence.files.find((entry) => /^reports\/memory\/name-queries\/history\/\d.*linux-x64\.json/.test(entry.path));
assert.ok(generalEntry);
const general = JSON.parse(await loadRaw(generalEntry));
assert.equal(general.pass, true);
assert.equal(general.results.length, 5);
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
  const log = await loadRaw(entry);
  const field = (pattern) => Number(log.match(pattern)?.[1].replaceAll(',', ''));
  const summary = { errors: field(/ERROR SUMMARY: ([\d,]+) errors/), definite: field(/definitely lost:\s+([\d,]+) bytes/),
    indirect: field(/indirectly lost:\s+([\d,]+) bytes/), possible: field(/possibly lost:\s+([\d,]+) bytes/), reachable: field(/still reachable:\s+([\d,]+) bytes/) };
  assert.equal(summary.errors, 0);
  assert.equal(summary.definite, 0);
  assert.equal(summary.indirect, 0);
  summaries.push(summary);
}
const range = (field) => `${Math.min(...summaries.map((entry) => entry[field]))}–${Math.max(...summaries.map((entry) => entry[field]))}`;
const percent = (value) => `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
const deltas = comparison.comparisons.map((entry) => entry.deltaPercent);
const nameDeltas = comparison.comparisons.filter((entry) => entry.workload.startsWith('document-name-')).map((entry) => entry.deltaPercent);

await writeFile(`${root}/reports/memory/name-queries/README.md`, [
  '# Memoria de Document.getElementsByName', '',
  'Los 52 escenarios focales aprobaron por separado en Node 22.12.0 y 24.14.1, comparando jsdom 27.4.0 y rustdom default/VM. Se conservan los 44 escenarios previos y se agregan ocho para NodeList por nombre.', '',
  '- Ciclos de creación, mutación, consulta, cierre y liberación; Document y Window se observan por separado.',
  '- Una NodeList por nombre retenida conserva sus owners; al soltarla se exige cero supervivientes y contadores de vida nativos de vuelta al baseline.',
  '- Un miembro removido se recolecta mientras la lista, su documento y su padre siguen retenidos. Se lee la lista para refrescar su invalidación perezosa antes de observar GC.',
  '- El fixture de retención vive en head: Window.close limpia body en HTML/quirks. Seis contratos públicos independientes comparan ese cierre con jsdom; XML conserva el contenido observado por su lista.',
  '- Los controles anteriores de children, form.elements, resultados numéricos y factories alterados siguen activos.', '',
  'Rust devuelve identificadores numéricos y presta los valores de atributos canónicos durante el filtro. No agrega caches, referencias persistentes N-API ni owners nativos. El puente proyecta los IDs sobre las implementaciones originales y la NodeList conserva sus referencias visibles a V8. A diferencia de HTMLCollection, esta ruta no retiene un transporte numérico auxiliar.', '',
  'Estrés general en procesos separados de Node 24, después de warmup y GC:', '',
  '| Modo | Document supervivientes | Window supervivientes | Δ heap MiB | Δ RSS MiB |',
  '|---|---:|---:|---:|---:|', ...memoryRows, '',
  `Memcheck ejecutó ${evidence.validation.rustMemcheckTests} tests Rust en ${native.runs.length} lotes: cero errores y cero bytes perdidos definitiva/indirectamente. Se conservan ${range('possible')} bytes posibles y ${range('reachable')} bytes alcanzables por proceso.`, '',
  'Los stacks residuales corresponden a std::thread/current, el contexto mpmc del harness y stack_overflow/thread_info. Los mismos 48/548 bytes aparecen en los nueve procesos del control anterior de 281 tests. La comparación de inventarios, hashes y duraciones está en ../../validation/name-queries/native-memory-baseline-comparison.json. Cambia la composición de los lotes: sus tiempos son diagnóstico, no muestras equivalentes de rendimiento.', '',
  'Memcheck cubre el ejecutable Rust; GC ejerce el addon real dentro de Node. Heap, external y RSS son muestras después de GC, no memoria pico. El allocator puede conservar RSS. Las pruebas finitas no demuestran ausencia absoluta de fugas ni auditan todas las dependencias.', '',
  '[Inventario y trazas originales](../../validation/name-queries/evidence.json).', '',
].join('\n'));

await writeFile(`${root}/reports/validation/name-queries.md`, [
  '# Document.getElementsByName en Rust', '',
  'El hito migra el recorrido físico de descendientes de Document y el filtro exacto del atributo name sin namespace a Rust. Reutiliza el recorrido acotado de colecciones y un lector prestado de atributos canónicos, compartido con clases y HTMLCollection. No hay wildcard ni normalización de mayúsculas; se conservan valores vacíos, UTF-16, namespaces extranjeros y el orden del árbol.', '',
  'El puente conserva identidades y WebIDL. NodeList, su owner y su invalidación perezosa siguen usando la integración actual; shadow roots y template.content conservan sus scopes físicos. El runtime continúa siendo híbrido: este hito no completa factories, WebIDL ni todas las APIs de Document.', '',
  'Base medida: checkpoint-061-element-relatives, main 55e2cb8, cuyo árbol es idéntico al head revisado 0921ab0 del PR 73. foundation/ conserva su integración, revisión limpia y ocho checks. Se reutiliza su addon f5ae22cf… como baseline. La rama actual es feature/native-name-queries; verificar el PR remoto antes de asumir integración.', '',
  '| Validación | Resultado |',
  '|---|---|',
  '| Rust 1.98.1 / 1.99.1 | Clippy y 285 tests por versión |',
  '| Node 22.12.0 / 24.14.1 | 3.419 contratos, Jest 21, Vitest 32 y VM 32 por versión |',
  '| Contratos de nombres | 54 diferenciales previos pasaron en el baseline; 61 finales por Node |',
  '| Focal final con GC | 62 tests por Node, con 52 escenarios de memoria |',
  '| Harness de benchmarks | 72 tests por Node; ocho nuevos sobre ambos motores reales |',
  '| CLI real del worker | Cuatro workers y ocho filas por Node, inputBytes 21 y resultados iguales |',
  '| Paquete instalado | 20 controles por Node con npm/pnpm, mismo archivo |',
  '| HTML5 | 1.784 comparables por Node; exclusiones conservadas |',
  ...evidence.validation.wptReports.map((entry) => `| WPT ${entry.node} | ${entry.fixtures} fixtures y ${entry.assertions} resultados en paridad; ${entry.sharedStandardsFailures} fallos de estándar compartidos |`), '',
  'El total WPT combina la ejecución de release de 221 fixtures con 15 fixtures suplementarios de nombres, sobre el mismo código de producto; no fue un único comando local de 236 fixtures. Los nuevos archivos upstream conservan sus bytes, Git blob y SHA-256 en el mismo revision fijado. Sus 43 resultados por Node incluyen dos fallos de namespaces compartidos con jsdom. El manifest preserva todos los hashes/suites/exclusiones anteriores y agrega la suite document-name-queries. WPT mantiene complete:false y el bootstrap bloqueado de Range-deleteContents; la paridad no certifica todos los estándares.', '',
  'Los diferenciales cubren HTML/quirks/XML, default/VM, valores literales y UTF-16, namespaces, adopción, Attr directo, mutaciones, identidad, coerciones WebIDL, listas vivas, fragmentos, templates, shadow roots y Window.close. Rust agrega cuatro tests sobre filtros, orden, mutaciones y liberación con resultados numéricos retenidos.', '',
  'La revisión estática aislada de Codex terminó sin hallazgos accionables sobre el código. Se corrigieron y volvieron a probar el fixture de GC afectado por el cierre de body, la validación del worker que esperaba un anchor del fixture anterior y su metadata de entrada. Sus logs fallidos quedan conservados. El CLI real pasó después de los fixes; los tiempos de esos smoke tests quedan excluidos del benchmark final.', '',
  'Un checkout limpio también expuso ENOENT al escribir el reporte del test de memoria de abort runners. El writer ahora crea su directorio; el flujo real aprobó cinco tests por Node partiendo de la carpeta ausente y la validación completa volvió a pasar. No se cambiaron las aserciones de GC ni se usaron mocks.', '',
  `Ocho reportes de rendimiento conservan 32 workers y 36 muestras por fila/motor/etapa/runtime. Las consultas por nombre varían ${percent(Math.min(...nameDeltas))} a ${percent(Math.max(...nameDeltas))} frente al baseline; el total, incluidos tres controles compartidos, varía ${percent(Math.min(...deltas))} a ${percent(Math.max(...deltas))}. Todas las filas y regresiones quedan publicadas.`, '',
  'Las entradas de nombres preparan 100/1.000 Element y consumen cien operaciones públicas. inputBytes registra los 21 bytes del documento inicial, no el volumen del DOM preparado. Preparación, validación, cierre y GC quedan fuera del temporizador. Se alternan órdenes y motores; no se afirma velocidad universal ni mejora de suites completas.', '',
  `Fuente canónica: \`${evidence.sourceHash}\`.`,
  `Addon validado: \`${evidence.nativeBinarySha256}\`.`,
  `Paquete instalado: \`${evidence.packageReports[0].packageSha256}\`.`, '',
  '- [Inventario, comandos, fallos históricos y checksums](name-queries/evidence.json).',
  '- [Benchmarks completos](../benchmarks/name-queries/README.md).',
  '- [Memoria, ownership y límites](../memory/name-queries/README.md).', '',
  'Los datos grandes usan gzip sin pérdida; el inventario verifica bytes originales y publicados. Continúan pendientes factories, algoritmos DOM y APIs delegadas a JavaScript/jsdom.', '',
].join('\n'));
console.log(JSON.stringify({ rendered: true, generalMemory: general.results.map(({ mode, pass }) => ({ mode, pass })), nativeSummaries: summaries }));
