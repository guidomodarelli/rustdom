import { readFile, writeFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
const root = process.argv[2];
const comparison = JSON.parse(await readFile(`${root}/reports/benchmarks/fragment-id/comparison.json`));
const raw = await readFile(`${root}/${comparison.rawReports[0].path}`);
const first = JSON.parse(comparison.rawReports[0].path.endsWith('.gz') ? gunzipSync(raw) : raw);
const percent = (value) => `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
const rows = comparison.comparisons.map((entry) => `| ${entry.node} | ${entry.workload} | ${entry.size} | ${entry.baseline.medianMs.toFixed(3)} | ${entry.candidate.medianMs.toFixed(3)} | ${percent(entry.deltaPercent)} | ${entry.candidateSpeedup.toFixed(2)}× |`);
const ids = comparison.comparisons.filter((entry) => entry.workload !== 'document-name-miss');
const deltas = comparison.comparisons.map((entry) => entry.deltaPercent);
const controls = comparison.comparisons.map((entry) => entry.jsdomControlDeltaPercent);
await writeFile(`${root}/reports/benchmarks/fragment-id/README.md`, [
  '# getElementById de fragmentos y ShadowRoot: antes y después', '',
  'Baseline: checkpoint-062-name-queries, main `e5a2daa`, árbol idéntico al',
  'head revisado `645f2ec`. Se reutiliza su dist validado y addon `ca4c8081…`.',
  'Ambos motores Rust usan Rust 1.99.1 release con thin LTO. El baseline recorre',
  'y filtra atributos en JavaScript; el candidato hace la búsqueda y comparación',
  'prestada en Rust y para en el primer match. La referencia es jsdom 27.4.0.',
  'WebIDL, factories y owners conservan el host actual; el runtime sigue híbrido.', '',
  `Máquina: ${first.machine.cpu}; ${first.machine.logicalCpus} CPUs lógicas; ${first.machine.release}.`, '',
  'Cada muestra consume cien consultas públicas sobre 100/1.000 Element de',
  'namespace HTML y extranjero. Se busca el primer miembro, el último, un ID',
  'ausente en DocumentFragment o el último miembro de ShadowRoot. Los atributos',
  'p:id con el valor ausente deben ignorarse. Document.getElementsByName miss',
  'conserva su recorrido nativo anterior y actúa como control sin cambios.', '',
  'Cada Element del fixture tiene tres atributos; estas filas no miden árboles',
  'con cientos de atributos por nodo.', '',
  'Los fragmentos están separados del documento; el host shadow se añade al body.',
  'inputBytes identifica el bootstrap HTML real de 21 bytes; el tamaño de fila',
  'cuenta los Element preparados y no representa bytes de asignación del DOM.',
  'La preparación, importación, validación, serialización del hash, cierre y GC',
  'quedan fuera del temporizador. Se comprueban contadores nativos antes de las',
  'lecturas auxiliares, todas las identidades/atributos y el resultado completo.',
  'El hash incluye la serialización XML íntegra del fragmento o shadow root,',
  'además del documento, de modo que los árboles separados también se comparan.', '',
  'Ocho reportes, 32 workers y 36 muestras por fila/motor/etapa/runtime. Cada',
  'proceso hace tres warmups y nueve muestras; se alternan etapas y motores.',
  'Se conservan todas las filas, outliers, percentiles y muestras después de GC.',
  'Los smoke tests previos validan el CLI; sus tiempos se archivan como',
  'diagnóstico y quedan excluidos de estas comparaciones finales.', '',
  '| Node | Operación | Tamaño | Antes ms | Después ms | Variación | jsdom/rustdom final |',
  '|---|---|---:|---:|---:|---:|---:|', ...rows, '',
  `Variación global: ${percent(Math.min(...deltas))} a ${percent(Math.max(...deltas))}.`,
  `Variación de consultas por ID: ${percent(Math.min(...ids.map((entry) => entry.deltaPercent)))} a ${percent(Math.max(...ids.map((entry) => entry.deltaPercent)))}.`,
  `Variación del control jsdom: ${percent(Math.min(...controls))} a ${percent(Math.max(...controls))}.`,
  'Un cambio positivo significa mayor duración; ratio mayor que 1 favorece rustdom.',
  'WSL2 comparte CPU con el host. No atribuir variaciones pequeñas al motor sin',
  'considerar ambos órdenes y controles. No se afirma velocidad universal,',
  'equivalencia estadística, mejora de suites completas ni memoria pico.', '',
  '- [Muestras, percentiles y ambos órdenes](comparison.json).',
  '- [Validación y límites](../../validation/fragment-id.md).',
  '- [Inventario y checksums](../../validation/fragment-id/evidence.json).',
  ...comparison.rawReports.map((entry) => `- ${entry.node}, ${entry.stage}: [reporte crudo](./${entry.path.split('/').at(-1)}).`), '',
  'Gzip conserva sin pérdida los datos grandes. sourceHash identifica código y',
  'harness; runtimeSource y el SHA del addon identifican el motor cargado.',
  'El inventario comprueba también los bytes originales descomprimidos.', '',
].join('\n'));
console.log(JSON.stringify({ rows: rows.length, range: [Math.min(...deltas), Math.max(...deltas)] }));
