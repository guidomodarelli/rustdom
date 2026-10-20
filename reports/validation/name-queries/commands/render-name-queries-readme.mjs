import { readFile, writeFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
const root = process.argv[2];
const comparison = JSON.parse(await readFile(`${root}/reports/benchmarks/name-queries/comparison.json`));
const raw = await readFile(`${root}/${comparison.rawReports[0].path}`);
const first = JSON.parse(comparison.rawReports[0].path.endsWith('.gz') ? gunzipSync(raw) : raw);
const percent = (value) => `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
const rows = comparison.comparisons.map((entry) => `| ${entry.node} | ${entry.workload} | ${entry.size} | ${entry.baseline.medianMs.toFixed(3)} | ${entry.candidate.medianMs.toFixed(3)} | ${percent(entry.deltaPercent)} | ${entry.candidateSpeedup.toFixed(2)}× |`);
const nameRows = comparison.comparisons.filter((entry) => entry.workload.startsWith('document-name-'));
const deltas = comparison.comparisons.map((entry) => entry.deltaPercent);
const controls = comparison.comparisons.map((entry) => entry.jsdomControlDeltaPercent);
const lines = [
  '# Document.getElementsByName: mediciones antes y después', '',
  'Baseline: checkpoint-061-element-relatives, main `55e2cb8`, árbol idéntico al',
  'head revisado `0921ab0`. Se reutiliza su dist validado y addon `f5ae22cf…`.',
  'Ambos motores Rust usan Rust 1.99.1 release con thin LTO. En el baseline el',
  'recorrido y filtro de nombres todavía ejecutan JavaScript y lecturas N-API',
  'por elemento; el candidato compara los atributos canónicos prestados en Rust.',
  'Referencia independiente: jsdom 27.4.0. WebIDL, NodeList y su invalidación',
  'conservan el host actual; el runtime continúa siendo híbrido.', '',
  `Máquina: ${first.machine.cpu}; ${first.machine.logicalCpus} CPUs lógicas; ${first.machine.release}.`, '',
  'Cada muestra consume cien operaciones públicas. Los cuatro workloads de nombre',
  'preparan 100/1.000 Element HTML y de namespace extranjero, con la mitad de los',
  'name sin namespace seleccionados. Un atributo p:name con el valor de búsqueda',
  'ausente debe ignorarse. create/miss incluyen una NodeList nueva por llamada;',
  'live invalida un atributo antes de leer la lista retenida; cached no invalida.',
  'El documento inicial está vacío: inputBytes registra sus 21 bytes de HTML,',
  'no los bytes del DOM preparado. El tamaño de fila cuenta los Element añadidos.', '',
  'Los tres controles —clases live/cached y refresco de children— conservan sus',
  'fixtures previas y comprueban los helpers compartidos de atributos/proyección.',
  'Se verifican contadores nativos antes de las lecturas auxiliares, identidades,',
  'todos los atributos/resultados y el hash completo fuera del temporizador.',
  'Preparación, importación, validación, cierre y GC quedan fuera del tiempo medido.', '',
  'Ocho reportes, 32 workers y 36 muestras por fila/motor/etapa/runtime. Cada',
  'proceso hace tres warmups y nueve muestras medidas. Se alternan etapas y motores.',
  'Se conservan todas las filas, outliers, percentiles y muestras posteriores al GC.',
  'Los smoke tests anteriores validaron el CLI bajo otros gates en ejecución;',
  'sus tiempos están archivados como diagnóstico y excluidos de esta comparación.', '',
  '| Node | Operación | Tamaño | Antes ms | Después ms | Variación | jsdom/rustdom final |',
  '|---|---|---:|---:|---:|---:|---:|', ...rows, '',
  `Variación global: ${percent(Math.min(...deltas))} a ${percent(Math.max(...deltas))}.`,
  `Variación de consultas por nombre: ${percent(Math.min(...nameRows.map((entry) => entry.deltaPercent)))} a ${percent(Math.max(...nameRows.map((entry) => entry.deltaPercent)))}.`,
  `Variación del control jsdom: ${percent(Math.min(...controls))} a ${percent(Math.max(...controls))}.`,
  'Un cambio positivo indica mayor duración; ratio mayor que 1 favorece rustdom.',
  'La CPU WSL2 se comparte con el host. No atribuir variaciones pequeñas al motor',
  'sin considerar el control y ambos órdenes. No se afirma velocidad universal,',
  'equivalencia estadística, mejora de suites completas ni memoria pico.', '',
  '- [Muestras agrupadas, percentiles y ambos órdenes](comparison.json).',
  '- [Validación y límites](../../validation/name-queries.md).',
  '- [Inventario y checksums](../../validation/name-queries/evidence.json).',
  ...comparison.rawReports.map((entry) => `- ${entry.node}, ${entry.stage}: [reporte crudo](./${entry.path.split('/').at(-1)}).`), '',
  'Gzip preserva sin pérdida los datos grandes. sourceHash identifica código y',
  'harness; runtimeSource y el SHA del addon identifican el motor cargado, incluido',
  'el baseline histórico. El inventario verifica también los bytes descomprimidos.', '',
];
await writeFile(`${root}/reports/benchmarks/name-queries/README.md`, lines.join('\n'));
console.log(JSON.stringify({ rows: rows.length, deltaRange: [Math.min(...deltas), Math.max(...deltas)], controlRange: [Math.min(...controls), Math.max(...controls)] }));
