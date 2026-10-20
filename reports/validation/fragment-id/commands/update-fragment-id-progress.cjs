'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');
const root = process.argv[2];
const primary = process.argv[3];
const evidence = JSON.parse(fs.readFileSync(root + '/reports/validation/fragment-id/evidence.json'));
const merged = JSON.parse(fs.readFileSync(primary + '/.cache/pr74-merged.json'));
assert.equal(merged.state, 'MERGED'); assert.equal(merged.treeMatchesReviewedHead, true);
assert.equal(evidence.validation.fullNodeTestsPerVersion, 3506);
const wpt = evidence.validation.wptReports[0];
const originalHandoff = fs.readFileSync(root + '/reports/progress/HANDOFF.md', 'utf8');
const historyStart = originalHandoff.indexOf('## Actualización del 20 de octubre de 2026');
assert.ok(historyStart > 0);
const header = `# Continuar rustdom en otra máquina

## Estado actual: getElementById de fragmentos

La base estable es main, commit \`${merged.mergeCommit.oid}\`, tag
\`checkpoint-062-name-queries\`. El PR 74 está mergeado: ocho checks
aprobados y revisión limpia de \`645f2ec\`; su rama integrada fue eliminada.
Incluye el recorrido y filtro de Document.getElementsByName en Rust, junto con
los hitos anteriores de colecciones e hijos/hermanos Element. Los cuatro fallos
originales de DOMParser están resueltos desde PR 70/checkpoint 58; el registro
antiguo de abajo es histórico.

El siguiente hito es \`feature/native-fragment-id\`: DocumentFragment.getElementById,
incluidos template.content y ShadowRoot, busca el primer ID no vacío en Rust.
Conserva orden físico, atributos sin namespace, UTF-16, identidades y adopción.
Para en el primer match y no crea caches ni listas intermedias. WebIDL, factories
y owners conservan el host; el runtime continúa siendo híbrido. Verificar el PR
y sus checks antes de asumir que este hito está integrado.

La validación local pasó 291 tests Rust en 1.98.1/1.99.1, 3.506 contratos Node
por versión 22.12.0/24.14.1, Jest 21, Vitest 32 y VM 32. Pasaron 87 focales
finales, 80 contratos del harness y 78 escenarios nuevos de GC por Node, además
de los 52 previos de colecciones. Aprobaron HTML5, Memcheck y 40 controles del
mismo paquete instalado. Cada Node ejecutó un comando WPT completo de
${wpt.fixtures} fixtures, ${wpt.assertions} resultados y ${wpt.sharedStandardsFailures} fallos de estándar compartidos;
la paridad no certifica conformidad completa.

Los ocho reportes de benchmark conservan ambos órdenes y 36 muestras por
fila/motor/etapa/runtime. El hash incluye el contenido del scope separado,
además del documento. Se publican todas las filas, controles y regresiones:

- [Validación y fuentes](../validation/fragment-id.md).
- [Benchmarks](../benchmarks/fragment-id/README.md).
- [Memoria](../memory/fragment-id/README.md).

El índice global sigue en 45,8% por áreas: no mide compatibilidad completa ni
APIs terminadas. Los siguientes bloques identificados son el índice y selección
de Document.getElementById, que siguen en JavaScript, y SVGSVGElement.getElementById.
SVG tiene reglas distintas: incluye el propio root y puede encontrar un atributo
ID vacío. Las factories, WebIDL y otras familias siguen pendientes.
La [observación diferencial](../validation/fragment-id/pending-id-contracts.json)
conserva también el cambio de orden de candidatos de Document al reasignar un ID.

Prompt para retomar:

\`\`\`text
Retomá rustdom desde feature/native-fragment-id; si fue mergeada, partí de main.
Leé AGENTS.md, reports/progress/HANDOFF.md, ROADMAP.md y
reports/validation/fragment-id.md. Verificá el estado remoto y el SHA revisado
de cada PR antes de dar por integrada una rama.

Los cuatro fallos originales de DOMParser están resueltos. Terminá los checks
o reviews pendientes de este hito y continuá con las APIs aún delegadas.
Los siguientes bloques son el índice de IDs de Document y la búsqueda de SVG;
preservá el orden de registro de candidatos de jsdom y las reglas propias de
SVG para root inclusivo e ID vacío. Conservá namespaces, UTF-16, identidades,
mutaciones, errores y liberación de Document/Window observados por separado.

El objetivo sigue siendo 100% de implementación Rust y compatibilidad
verificable con jsdom; la versión híbrida es intermedia. Instalá lo necesario
sin pedir permiso. Validá Node 22 y 24, guardá benchmarks y análisis de memoria,
y publicá cada hito probado con commit, push y checkpoint. Aplicá
codex-autofix-loop en cada PR; no publiques paquetes npm automáticamente.
\`\`\`

`;
fs.writeFileSync(root + '/reports/progress/HANDOFF.md', header + originalHandoff.slice(historyStart));
let roadmap = fs.readFileSync(root + '/ROADMAP.md', 'utf8');
const oldMilestone = 'El hito feature/native-name-queries migra el recorrido y filtro de Document.getElementsByName a Rust, conservando NodeList viva, UTF-16, namespaces y owners. Su validación local, benchmarks y memoria están en reports/validation/name-queries.md; la integración depende del PR y sus checks. Quedan factories, WebIDL y algoritmos generales de Document/Element y Node.';
const newMilestone = 'Document.getElementsByName está integrado por el PR 74 en checkpoint-062-name-queries, con filtro y recorrido Rust y NodeList viva; ver reports/validation/name-queries.md. El hito feature/native-fragment-id migra DocumentFragment.getElementById, incluidos template.content y ShadowRoot, con retorno temprano, ID no vacío, UTF-16 y orden físico; su validación local, benchmarks y memoria están en reports/validation/fragment-id.md, con integración sujeta al PR. Siguen pendientes el índice/selección de Document.getElementById y la búsqueda de SVGSVGElement, que incluye el root y admite atributo ID vacío, junto con factories, WebIDL y algoritmos generales de Document/Element y Node.';
assert.ok(roadmap.includes(oldMilestone) || roadmap.includes(newMilestone));
roadmap = roadmap.replace(oldMilestone, newMilestone);
fs.writeFileSync(root + '/ROADMAP.md', roadmap);
let progress = fs.readFileSync(root + '/reports/progress/native-migration.md', 'utf8');
const detailsStart = progress.indexOf('Es un indicador de planificación');
assert.ok(detailsStart > 0);
progress = `# Indicador provisional de migración a Rust

Estado actualizado el 20/10/2026 UTC. Main contiene \`${merged.mergeCommit.oid}\`,
checkpoint-062-name-queries (PR 74), con Document.getElementsByName nativo.
El siguiente hito, feature/native-fragment-id, migra getElementById de fragmentos,
template.content y ShadowRoot; comprobar su PR antes de asumir integración.
El índice de Document, la búsqueda SVG, WebIDL, factories y otras APIs siguen
pendientes; el runtime continúa siendo híbrido.

**2 áreas implementadas, 7 parciales y 3 delegadas: índice 45,8%.**

El hito de fragmentos pasó 291 tests Rust en 1.98.1/1.99.1, 3.506 contratos Node
por versión, runners, corpus, 78 escenarios nuevos de GC por Node, los 52 previos
de colecciones, Memcheck y 40 controles instalados. WPT ejecutó los 240 fixtures
en un comando por Node, con paridad, exclusiones y fallos de estándar compartidos.
Los ocho reportes de rendimiento conservan 36 muestras por
fila/motor/etapa/runtime y todas las regresiones. Ver reports/validation/fragment-id.md.
Profundizar un área parcial no incrementa automáticamente el índice global.

` + progress.slice(detailsStart);
fs.writeFileSync(root + '/reports/progress/native-migration.md', progress);
console.log(JSON.stringify({ updated: true, main: merged.mergeCommit.oid, index: 45.8 }));
