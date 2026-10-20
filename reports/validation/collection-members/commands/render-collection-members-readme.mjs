import { readFile, writeFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
const root = process.argv[2];
const comparison = JSON.parse(await readFile(`${root}/reports/benchmarks/collection-members/comparison.json`));
const raw = await readFile(`${root}/${comparison.rawReports[0].path}`);
const first = JSON.parse(comparison.rawReports[0].path.endsWith('.gz') ? gunzipSync(raw) : raw);
const percent = (value) => `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
const rows = comparison.comparisons.map((entry) => `| ${entry.node} | ${entry.workload} | ${entry.size} | ${entry.baseline.medianMs.toFixed(3)} | ${entry.candidate.medianMs.toFixed(3)} | ${percent(entry.deltaPercent)} | ${entry.candidateSpeedup.toFixed(2)}× |`);
const deltas = comparison.comparisons.map((entry) => entry.deltaPercent);
const controls = comparison.comparisons.map((entry) => entry.jsdomControlDeltaPercent);
const cached = comparison.comparisons.filter((entry) => entry.workload === 'collection-class-cached');
const direct = comparison.comparisons.filter((entry) => ['collection-named-hit', 'collection-named-miss', 'collection-property-names'].includes(entry.workload));
const profile = await Promise.all(['before', 'after'].map(async (stage) => JSON.parse(await readFile(`${root}/reports/benchmarks/collection-members/profile-${stage}.json`))));
const lines = [
  '# HTMLCollection: mediciones antes y después', '',
  'Baseline: checkpoint-059-collection-queries (`a155685`, árbol equivalente a',
  '`02f7b7d`). Ambos addons usan Rust 1.99.1 en release con thin LTO. Los filtros',
  'getElementsBy* ya usan Rust en las dos etapas; en el baseline, namedItem y los',
  'nombres soportados todavía recorren atributos mediante JavaScript/N-API.',
  'El candidato ejecuta esos algoritmos en Rust y prepara las comparaciones de',
  'metadatos sin perder UTF-16. Referencia independiente: jsdom 27.4.0.', '',
  `Máquina: ${first.machine.cpu}; ${first.machine.logicalCpus} CPUs lógicas; ${first.machine.release}.`, '',
  '## Operaciones medidas', '',
  '- Seis workloads previos: refresco de clases/tag/namespace, creación tras',
  '  invalidación, consulta con dieciséis clases y lectura estable desde caché.',
  '  Cada muestra realiza cien operaciones públicas con 100/1.000 descendientes.',
  '- namedItem hit/miss: cien búsquedas públicas del último miembro o un nombre',
  '  ausente sobre una colección estable de 100/1.000 elementos.',
  '- Nombres: diez llamadas completas a Object.getOwnPropertyNames, consumiendo',
  '  longitud y último nombre, sobre colecciones con IDs y namespaces mezclados.',
  '- Preparación, comprobación independiente de todas las identidades/nombres,',
  '  cleanup y GC están fuera del temporizador. Las rutas estables exigen cero',
  '  recálculos; el contador propio se comprueba antes de las lecturas auxiliares.',
  '- Se incluye el puente, Proxy, copia de resultados y costo público completo.',
  '  Se preserva el host WebIDL y el runtime híbrido en ambas etapas.', '',
  '## Muestras y límites', '',
  'Ocho reportes y 32 workers aislados. Por Node se ejecutan las etapas baseline',
  '→ candidato y candidato → baseline; cada reporte invierte también el orden',
  'jsdom/rustdom. Cada fila reúne **36 muestras por motor y etapa**, con tres',
  'warmups y nueve muestras medidas por proceso. Se conservan todos los valores,',
  'outliers, percentiles, muestras de memoria, ambos órdenes y resultados crudos.', '',
  'La CPU WSL2 se comparte con el host. Estas entradas sintéticas no certifican',
  'velocidad de suites completas ni equivalencia estadística. Los valores de',
  'memoria posteriores al GC no representan memoria pico.', '',
  '## Medianas agrupadas', '',
  '| Node | Operación | Miembros/descendientes | Antes (ms) | Después (ms) | Variación | jsdom/rustdom final |',
  '|---|---|---:|---:|---:|---:|---:|', ...rows, '',
  `Variación frente al baseline: ${percent(Math.min(...deltas))} a ${percent(Math.max(...deltas))}.`,
  `Variación del control jsdom: ${percent(Math.min(...controls))} a ${percent(Math.max(...controls))}.`,
  `Las operaciones directas varían de ${percent(Math.min(...direct.map((entry) => entry.deltaPercent)))} a ${percent(Math.max(...direct.map((entry) => entry.deltaPercent)))}.`,
  'Ratio mayor que 1 favorece rustdom; menor que 1 conserva un costo frente a',
  'jsdom. Ninguna fila o variación adversa se excluye de la comparación.', '',
  'La ruta estable que motivó el perfil conserva estos resultados completos:', '',
  ...cached.map((entry) => `- ${entry.node}, ${entry.size}: ${entry.baseline.medianMs.toFixed(3)} → ${entry.candidate.medianMs.toFixed(3)} ms por cien lecturas, frente a ${entry.jsdomAfter.medianMs.toFixed(3)} ms en jsdom.`), '',
  '## Diagnóstico de CPU separado', '',
  'Los perfiles capturan 1.000 lecturas públicas preparadas de length/item.',
  'Antes predominaban el puente y attributeByNamespace/namedItem. Un frame',
  'nativo compartido aparece con un nombre de serialización, pero sus ancestros',
  'JavaScript muestran la búsqueda de nombres: ese nombre por sí solo no prueba',
  'que se ejecutara serialización XML en el bucle.', '',
  ...profile.map((entry) => `- ${entry.label}: ${entry.samples} muestras, ${entry.elapsedProfilerUs} µs bajo instrumentación; [resumen](profile-${entry.label}.json) y perfil crudo en el inventario.`), '',
  'El overhead del profiler impide convertir esos tiempos en una aceleración',
  'sin instrumentación. Las medianas de arriba proceden de procesos separados.', '',
  '## Evidencia reproducible', '',
  '- [Comparación, percentiles y repeticiones](comparison.json).',
  '- [Validación y ownership](../../validation/collection-members.md).',
  '- [Inventario, fuentes y checksums](../../validation/collection-members/evidence.json).',
  ...comparison.rawReports.map((entry) => `- ${entry.node}, ${entry.stage}: [reporte crudo](./${entry.path.split('/').at(-1)}).`), '',
  'Los datos grandes usan gzip sin pérdida. sourceHash identifica el harness y',
  'las fuentes del candidato; runtimeSource y el SHA del addon identifican el',
  'motor cargado, incluido el baseline histórico. El inventario verifica también',
  'el contenido original descomprimido y el paquete instalado en ambos Node.', '',
];
await writeFile(`${root}/reports/benchmarks/collection-members/README.md`, lines.join('\n'));
console.log(JSON.stringify({ deltaRange: [Math.min(...deltas), Math.max(...deltas)], controlRange: [Math.min(...controls), Math.max(...controls)] }));
