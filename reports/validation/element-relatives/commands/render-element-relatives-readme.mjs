import { readFile, writeFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
const root = process.argv[2];
const comparison = JSON.parse(await readFile(`${root}/reports/benchmarks/element-relatives/comparison.json`));
const raw = await readFile(`${root}/${comparison.rawReports[0].path}`);
const first = JSON.parse(comparison.rawReports[0].path.endsWith('.gz') ? gunzipSync(raw) : raw);
const percent = (value) => `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
const rows = comparison.comparisons.map((entry) => `| ${entry.node} | ${entry.workload} | ${entry.size} | ${entry.baseline.medianMs.toFixed(3)} | ${entry.candidate.medianMs.toFixed(3)} | ${percent(entry.deltaPercent)} | ${entry.candidateSpeedup.toFixed(2)}× |`);
const deltas = comparison.comparisons.map((entry) => entry.deltaPercent);
const controls = comparison.comparisons.map((entry) => entry.jsdomControlDeltaPercent);
const lines = [
  '# Hijos y hermanos Element: mediciones antes y después', '',
  'Baseline: PR 72 corregido (`2ae5f2c`), addon `7f24a7e9…`. Se verificaron los',
  '567 archivos del dist validado antes de trasladarlo al baseline. Ambos addons',
  'usan Rust 1.99.1 release con thin LTO; el baseline recorre estos enlaces y',
  'filtra Element en JavaScript, y el candidato ejecuta ambos algoritmos en Rust.',
  'Referencia independiente: jsdom 27.4.0. Las factories, WebIDL e invalidación',
  'mantienen su integración actual; el runtime continúa siendo híbrido.', '',
  `Máquina: ${first.machine.cpu}; ${first.machine.logicalCpus} CPUs lógicas; ${first.machine.release}.`, '',
  'Cada entrada contiene 100 o 1.000 nodos físicos. children alterna Element de',
  'namespaces distintos y Text/Comment; las lecturas escalares colocan un Element',
  'al otro extremo de una cadena de nodos no Element, o dos Element a sus extremos.',
  'Cada muestra consume cien lecturas públicas. El refresco incluye invalidar un',
  'atributo y leer length/item de la colección retenida; el modo cached no invalida.',
  'Se comprueba el contador propio antes de las lecturas auxiliares, todas las',
  'identidades físicas, resultados y el hash completo fuera del temporizador.',
  'Preparación, importación, validación, cierre y GC quedan fuera del tiempo medido.', '',
  'Ocho reportes, 32 workers aislados y 36 muestras por fila/motor/etapa/runtime.',
  'Cada proceso hace tres warmups y nueve muestras medidas. Se invierten tanto las',
  'etapas baseline/candidato como el orden de motores. Se guardan todas las filas,',
  'muestras, percentiles, memoria posterior al GC y ambas repeticiones. La CPU WSL2',
  'se comparte con el host; estos patrones no miden suites completas ni memoria pico.', '',
  '| Node | Operación | Nodos físicos | Antes (ms) | Después (ms) | Variación | jsdom/rustdom final |',
  '|---|---|---:|---:|---:|---:|---:|', ...rows, '',
  `Variación frente al baseline: ${percent(Math.min(...deltas))} a ${percent(Math.max(...deltas))}.`,
  `Variación del control jsdom: ${percent(Math.min(...controls))} a ${percent(Math.max(...controls))}.`,
  'Un cambio positivo indica mayor duración. Ratio mayor que 1 favorece rustdom.',
  'No se excluyen regresiones ni se afirma una mejora universal.', '',
  '- [Comparación, percentiles y repeticiones](comparison.json).',
  '- [Validación y límites](../../validation/element-relatives.md).',
  '- [Inventario, fuentes y checksums](../../validation/element-relatives/evidence.json).',
  ...comparison.rawReports.map((entry) => `- ${entry.node}, ${entry.stage}: [reporte crudo](./${entry.path.split('/').at(-1)}).`), '',
  'Los datos grandes se comprimen con gzip sin pérdida. sourceHash identifica el',
  'harness y las fuentes medidas del candidato; runtimeSource y el SHA del addon',
  'identifican el motor cargado. El inventario conserva también el dist del baseline,',
  'los hashes del contenido original y el paquete instalado en ambos Node.', '',
];
await writeFile(`${root}/reports/benchmarks/element-relatives/README.md`, lines.join('\n'));
console.log(JSON.stringify({ deltaRange: [Math.min(...deltas), Math.max(...deltas)], controlRange: [Math.min(...controls), Math.max(...controls)] }));
