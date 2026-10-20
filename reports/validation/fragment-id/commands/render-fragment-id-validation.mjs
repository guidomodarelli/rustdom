import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
const root = process.argv[2];
const evidence = JSON.parse(await readFile(`${root}/reports/validation/fragment-id/evidence.json`));
const comparison = JSON.parse(await readFile(`${root}/reports/benchmarks/fragment-id/comparison.json`));
const loadRaw = async (entry) => {
  const bytes = await readFile(`${root}/${entry.path}`);
  return entry.compression === 'gzip' ? gunzipSync(bytes).toString() : bytes.toString();
};
const generalEntry = evidence.files.find((entry) => /^reports\/memory\/fragment-id\/history\/\d.*linux-x64\.json/.test(entry.path));
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
  const log = await loadRaw(entry);
  const field = (pattern) => Number(log.match(pattern)?.[1].replaceAll(',', ''));
  const summary = { errors: field(/ERROR SUMMARY: ([\d,]+) errors/), definite: field(/definitely lost:\s+([\d,]+) bytes/),
    indirect: field(/indirectly lost:\s+([\d,]+) bytes/), possible: field(/possibly lost:\s+([\d,]+) bytes/), reachable: field(/still reachable:\s+([\d,]+) bytes/) };
  assert.equal(summary.errors, 0); assert.equal(summary.definite, 0); assert.equal(summary.indirect, 0);
  summaries.push(summary);
}
const range = (field) => `${Math.min(...summaries.map((entry) => entry[field]))}–${Math.max(...summaries.map((entry) => entry[field]))}`;
const percent = (value) => `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
const deltas = comparison.comparisons.map((entry) => entry.deltaPercent);
await writeFile(`${root}/reports/memory/fragment-id/README.md`, [
  '# Memoria de búsquedas por ID en fragmentos', '',
  'Los 78 escenarios focales aprobaron por separado en Node 22.12.0 y 24.14.1, con jsdom 27.4.0 y rustdom default/VM. Los 52 escenarios previos de colecciones también siguen pasando.', '',
  '- DocumentFragment separado, template.content y ShadowRoot separado; una vuelta de warmup y tres lotes medidos por combinación, con doce Windows, veinticuatro Element y cuarenta ciclos de mutación/movimiento/consulta por Window.',
  '- Retener el Element encontrado conserva su scope y owner Document. Se observa el Document original y el owner de template.content por separado, junto con Window, host y todos los Element.',
  '- Un miembro removido debe recolectarse mientras su scope sigue retenido; las consultas posteriores no conservan una entrada obsoleta.',
  '- Los casos exclusivos de rustdom retienen solo un ID numérico de la arena real y exigen liberar todos los owners DOM.',
  '- Después de soltar el owner, cada grupo débil y todos los contadores nativos de vida vuelven al baseline en dos muestras claras de GC.', '',
  'La búsqueda lee enlaces y atributos canónicos prestados. No crea un índice, cache, lista de resultados ni referencias persistentes N-API. Solo devuelve un número; el puente resuelve la implementación original. Los scopes del test están separados de body, cuya limpieza durante Window.close no altera el escenario de retención. La supervivencia de Window se registra separadamente y no se deduce de la de Document.', '',
  'Estrés general en procesos separados de Node 24, después de warmup y GC:', '',
  '| Modo | Document supervivientes | Window supervivientes | Δ heap MiB | Δ RSS MiB |',
  '|---|---:|---:|---:|---:|', ...memoryRows, '',
  `Memcheck ejecutó ${evidence.validation.rustMemcheckTests} tests Rust en ${native.runs.length} lotes: cero errores y cero bytes perdidos definitiva/indirectamente. Conserva ${range('possible')} bytes posibles y ${range('reachable')} bytes alcanzables por proceso.`, '',
  'Los stacks residuales de std::thread/current, el contexto mpmc del harness y stack_overflow/thread_info permanecen visibles. El control anterior de 285 tests en nueve procesos conserva los mismos 48/548 bytes. La comparación de hashes, inventarios y duraciones está en ../../validation/fragment-id/native-memory-baseline-comparison.json. Los seis tests nuevos cambian la composición y añaden un lote: sus tiempos son diagnóstico, no muestras equivalentes de rendimiento.', '',
  'Memcheck cubre el ejecutable Rust; GC usa el addon real en Node. Heap, external y RSS se miden después de GC y no representan picos. El allocator puede conservar RSS. Las pruebas finitas no demuestran ausencia absoluta de fugas ni auditan todas las dependencias.', '',
  '[Inventario y trazas originales](../../validation/fragment-id/evidence.json).', '',
].join('\n'));
await writeFile(`${root}/reports/validation/fragment-id.md`, [
  '# getElementById de DocumentFragment en Rust', '',
  'DocumentFragment.getElementById, incluido ShadowRoot y template.content, ejecuta el recorrido y filtro exacto del atributo id sin namespace en Rust. Para en el primer match físico, excluye el root y otros árboles y devuelve null para ID vacío. Conserva UTF-16, orden, identidades, mutaciones y adopción. Reutiliza el lector prestado de atributos y following_within; no agrega caches ni listas intermedias.', '',
  'WebIDL, factories y owners siguen en el host actual. Document.getElementById mantiene su índice JavaScript y SVGSVGElement.getElementById conserva su implementación separada: sus reglas incluyen el propio root y permiten un atributo ID vacío. El runtime continúa siendo híbrido y el objetivo integral permanece abierto.', '',
  'Base: checkpoint-062-name-queries, main e5a2daa, árbol idéntico al head revisado 645f2ec del PR 74. foundation/ conserva merge, ocho checks y revisión limpia; el addon ca4c8081… es el baseline real. La rama del hito es feature/native-fragment-id; comprobar el estado remoto antes de asumir integración.', '',
  '| Validación | Resultado |', '|---|---|',
  '| Rust 1.98.1 / 1.99.1 | Clippy y 291 tests por versión |',
  '| Node 22.12.0 / 24.14.1 | 3.506 contratos, Jest 21, Vitest 32 y VM 32 por versión |',
  '| Baseline diferencial | 84 contratos por Node antes de migrar |',
  '| Focales integrados | 760 por Node antes de añadir el test separado de GC |',
  '| Focal final | 87 por Node: 84 diferenciales, dos de uso nativo y un proceso GC |',
  '| Memoria focal | 78 escenarios de fragmentos y 52 anteriores de colecciones por Node |',
  '| Harness de benchmarks | 80 tests por Node; ocho nuevos en ambos motores reales |',
  '| CLI real | Cuatro workers y ocho filas por Node; inputBytes 21 y hashes iguales |',
  '| Paquete instalado | 20 controles por Node con npm/pnpm, mismo archivo |',
  '| HTML5 | 1.784 comparables por Node; exclusiones conservadas |',
  ...evidence.validation.wptReports.map((entry) => `| WPT ${entry.node} | ${entry.fixtures} fixtures y ${entry.assertions} resultados en paridad; ${entry.sharedStandardsFailures} fallos de estándar compartidos |`), '',
  'Cada Node ejecutó el corpus WPT completo de 240 fixtures en un único comando. Incluye los quince fixtures de nombres previos y cuatro nuevos de Document/DocumentFragment y ShadowRoot dinámico. Estos últimos conservan bytes, Git blob y SHA-256 de la revisión upstream fijada. Se mantienen todos los hashes, suites y exclusiones anteriores. complete:false y el bootstrap bloqueado de Range-deleteContents siguen visibles; paridad con jsdom no certifica conformidad completa.', '',
  'Los diferenciales cubren HTML/XML, default/VM, fragmentos, template.content, ShadowRoot, namespaces, ID vacío, literal *, NUL, surrogates, duplicados, árbol físico, Attr directo, reemplazos, movimientos, clonación, remoción, adopción, WebIDL y errores. Los seis tests Rust cubren filtros, orden y retorno temprano, valores, atributos canónicos, scopes/ownership y handles inválidos sin activar nodos reservados.', '',
  'La revisión estática aislada de Codex terminó sin hallazgos accionables sobre los catorce paths de código, bindings, tests y benchmarks. Sus observaciones y los gates reales se conservan por separado; no se atribuyen ejecuciones independientes al reviewer.', '',
  `Los ocho reportes de rendimiento guardan 32 workers y 36 muestras por fila/motor/etapa/runtime. La variación frente al baseline va de ${percent(Math.min(...deltas))} a ${percent(Math.max(...deltas))}; todas las filas, controles y regresiones se conservan.`,
  'El benchmark consume cien operaciones públicas en 100/1.000 Element y valida también la serialización completa del scope separado. Preparación, validación, cierre y GC quedan fuera del tiempo. Los smoke tests del CLI solo validan corrección y se excluyen de estas mediciones finales. No se extrapola a suites completas.', '',
  `Fuente canónica: \`${evidence.sourceHash}\`.`, `Addon: \`${evidence.nativeBinarySha256}\`.`,
  `Paquete instalado: \`${evidence.packageReports[0].packageSha256}\`.`, '',
  '- [Inventario, comandos y checksums](fragment-id/evidence.json).',
  '- [Benchmarks](../benchmarks/fragment-id/README.md).',
  '- [Memoria y límites](../memory/fragment-id/README.md).', '',
  'Los datos grandes usan gzip sin pérdida y se verifican sus bytes originales. Quedan el índice de Document, la búsqueda SVG, factories, WebIDL y otras APIs delegadas a JavaScript/jsdom.', '',
].join('\n'));
console.log(JSON.stringify({ rendered: true, nativeBatches: summaries.length, generalMemory: general.results.map(({ mode, pass }) => ({ mode, pass })) }));
