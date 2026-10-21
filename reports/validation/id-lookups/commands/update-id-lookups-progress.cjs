'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');
const [root, primary] = process.argv.slice(2);
const evidence = JSON.parse(fs.readFileSync(root + '/reports/validation/id-lookups/evidence.json'));
const merged = JSON.parse(fs.readFileSync(primary + '/.cache/pr75-merged.json'));
assert.equal(merged.state, 'MERGED'); assert.equal(merged.treeMatchesReviewedHead, true);
assert.equal(merged.mergeCommit.oid, '60f7cb6e925310fce3e16676ebae93debd2faca7');
assert.equal(merged.tag, 'checkpoint-063-fragment-id');
const validation = evidence.validation;
const wpt = validation.wptReports[0];
const handoffPath = root + '/reports/progress/HANDOFF.md';
const originalHandoff = fs.readFileSync(handoffPath, 'utf8');
const historyStart = originalHandoff.indexOf('## Actualización del 20 de octubre de 2026');
assert.ok(historyStart > 0);
const header = `# Continuar rustdom en otra máquina

## Estado actual: índice de IDs de Document y búsquedas SVG

La base estable es main, commit \`${merged.mergeCommit.oid}\`, tag
\`checkpoint-063-fragment-id\`. El PR 75 está mergeado: ocho checks aprobados,
revisión limpia de \`859c111\`, árbol del squash idéntico al head revisado y
rama integrada eliminada. Incluye DocumentFragment.getElementById, template.content
y ShadowRoot nativos. Los cuatro fallos originales de DOMParser están resueltos
desde PR 70/checkpoint 58; el registro antiguo de abajo es histórico.

El siguiente hito es \`feature/native-id-lookups\`. El índice y selección de
Document.getElementById conservan en Rust orden de registro, duplicados y aliases,
filtrando por la raíz física actual. SVGSVGElement.getElementById recorre en Rust
en orden físico, incluye el root y acepta un atributo ID vacío explícito.
WebIDL, factories y efectos generales conservan el host; el runtime sigue híbrido.
Verificar el PR y su SHA revisado antes de asumir que este hito está integrado.

Una suite general detectó que quitar la lectura interna getAttributeNS durante
alta/baja cambiaba las trazas de FormData. Se restauró la invocación observable,
manteniendo el índice en Rust. Dieciséis regresiones nuevas cubren orden, aliases,
excepciones y mutaciones durante el getter; se conservan el fallo y su corrección.
No reintroducir la lectura directa del Attr como sustituto de ese hook observable.

La validación local final pasó ${validation.rustTestsPerVersion} tests Rust en 1.98.1/1.99.1,
${validation.fullNodeTestsPerVersion} contratos Node por versión 22.12.0/24.14.1, Jest 21, Vitest 32
y VM 32. Pasaron ${validation.baselineDifferentialTestsPerVersion} diferenciales del baseline, ${validation.focusedNodeTestsPerVersion} focales finales,
${validation.focusedIntegrationTestsPerVersion} integrados y 94 contratos de harness por Node. Cada runtime pasó
62 escenarios nuevos de GC, además de 78 de fragmentos y 52 de colecciones.
Aprobaron HTML5, Memcheck y cuarenta controles del mismo paquete instalado.
Cada Node ejecutó un comando WPT completo: ${wpt.fixtures} fixtures, ${wpt.assertions} resultados
y ${wpt.sharedStandardsFailures} fallos de estándar compartidos; complete=false. La paridad no
certifica conformidad completa. El corpus y sus exclusiones no se redujeron.

Los ocho reportes de benchmark conservan ambos órdenes y 36 muestras por
fila/motor/etapa/runtime. Se miden siete tareas migradas y dos controles sobre
100/1.000 Element, con hash de todo el scope. Registro mide una única inserción
del subárbol preparado; las otras filas consumen cien consultas o setters.
Se publican también regresiones y costos del puente:

- [Validación y fuentes](../validation/id-lookups.md).
- [Benchmarks](../benchmarks/id-lookups/README.md).
- [Memoria](../memory/id-lookups/README.md).

El índice global sigue en 45,8% por áreas; no mide APIs ni compatibilidad completa.
Queda optimizar las lecturas, ausencias, registros y cambios de IDs de Document:
las muestras registran mayor duración frente al checkpoint 63. Reducir esos
costos sin volver al índice JavaScript, preservando getters, aliases, orden y GC.
El informe de benchmarks conserva ambos órdenes y los controles de ruido.
Las factories, WebIDL y los algoritmos generales de Node/Document/Element y demás
familias de plataforma siguen pendientes. El objetivo integral permanece abierto.

Prompt para retomar:

\`\`\`text
Retomá rustdom desde feature/native-id-lookups; si fue mergeada, partí de main.
Leé AGENTS.md, reports/progress/HANDOFF.md, ROADMAP.md y
reports/validation/id-lookups.md. Verificá el estado remoto, los checks y el SHA
revisado de cada PR antes de dar por integrada una rama.

Los cuatro fallos originales de DOMParser están resueltos desde checkpoint 58.
Terminá los checks/reviews pendientes del hito de IDs y continuá con los
algoritmos de Node/Document/Element y las APIs aún delegadas en ROADMAP.md.
Document usa orden de registro y aliases, no orden físico; SVG incluye el root
y admite atributo ID vacío. Conservá la llamada observable getAttributeNS en
el lifecycle de alta/baja: quitarla rompió los contratos reales de FormData.
Preservá namespaces, UTF-16, identidades, errores y efectos parciales.

El objetivo sigue siendo 100% de implementación Rust y compatibilidad
verificable con jsdom; la versión híbrida es intermedia. Instalá lo necesario
sin preguntar. Validá Node 22 y 24, guardá benchmarks y análisis de memoria,
observando Document y Window por separado. Publicá cada hito bien probado con
commit, push y checkpoint. Aplicá codex-autofix-loop en cada PR, verificá
revisión del SHA actual y CI antes del merge y eliminá las ramas integradas.
No publiques paquetes npm automáticamente.
\`\`\`

`;
fs.writeFileSync(handoffPath, header + originalHandoff.slice(historyStart));
const migrationPath = root + '/reports/progress/native-migration.md';
const migration = fs.readFileSync(migrationPath, 'utf8');
const indicator = migration.indexOf('**2 áreas implementadas, 7 parciales y 3 delegadas: índice 45,8%.**');
assert.ok(indicator > 0);
const migrationHeader = `# Indicador provisional de migración a Rust

Estado actualizado el ${new Date().toISOString().slice(0, 10)} UTC. Main contiene \`60f7cb6e925310fce3e16676ebae93debd2faca7\`,
checkpoint-063-fragment-id (PR 75), con DocumentFragment/template/ShadowRoot IDs
nativos. El siguiente hito, feature/native-id-lookups, migra el índice de IDs de
Document y el recorrido SVG. Comprobar su PR antes de asumir integración.
WebIDL, factories y otras APIs siguen pendientes; el runtime continúa híbrido.

El hito de IDs pasó ${validation.rustTestsPerVersion} tests Rust en 1.98.1/1.99.1, ${validation.fullNodeTestsPerVersion} contratos
Node por versión, runners, corpus, 62 escenarios nuevos de GC por Node y los
78 de fragmentos/52 de colecciones, Memcheck y cuarenta controles instalados.
WPT ejecutó los 240 fixtures en un comando por Node, con paridad, exclusiones
y fallos de estándar compartidos. Los ocho reportes de rendimiento conservan
36 muestras por fila/motor/etapa/runtime, siete tareas y dos controles, junto
con todas las regresiones. Ver reports/validation/id-lookups.md.
Profundizar un área parcial no incrementa automáticamente el índice global.

`;
fs.writeFileSync(migrationPath, migrationHeader + migration.slice(indicator));
const roadmapPath = root + '/ROADMAP.md';
let roadmap = fs.readFileSync(roadmapPath, 'utf8');
const historicalStart = roadmap.indexOf('El hito feature/native-fragment-id migra');
const fragmentStart = historicalStart >= 0 ? historicalStart : roadmap.indexOf('DocumentFragment.getElementById, incluidos template.content y ShadowRoot, está integrado por el PR 75');
const fragmentEnd = roadmap.indexOf('\n- Todos los selectores, XPath', fragmentStart);
assert.ok(fragmentStart > 0 && fragmentEnd > fragmentStart);
roadmap = roadmap.slice(0, fragmentStart) + 'DocumentFragment.getElementById, incluidos template.content y ShadowRoot, está integrado por el PR 75 en checkpoint-063-fragment-id; ver reports/validation/fragment-id.md. El hito feature/native-id-lookups agrega el índice y selección de Document.getElementById en Rust, conservando orden de registro y aliases, y la búsqueda de SVGSVGElement con root inclusivo y atributo ID vacío. Mantiene las lecturas observables getAttributeNS del lifecycle; suprimirlas rompió contratos de FormData y quedó cubierto por regresiones. Su validación, memoria y benchmarks están en reports/validation/id-lookups.md, con integración sujeta al PR. Siguen pendientes factories, WebIDL y algoritmos generales de Document/Element y Node.' + roadmap.slice(fragmentEnd);
roadmap = roadmap.replace('\n- Todos los selectores, XPath', '\n- Optimizar lecturas, ausencias, registros y cambios de IDs de Document sin volver al índice JavaScript. Los benchmarks del hito registran mayor duración frente al checkpoint 63; conservar las regresiones, ambos órdenes y controles de ruido, junto con getters observables, aliases, orden y liberación. Ver reports/benchmarks/id-lookups/README.md.\n- Todos los selectores, XPath');
fs.writeFileSync(roadmapPath, roadmap);
console.log(JSON.stringify({ main: merged.mergeCommit.oid, checkpoint: merged.tag, rustTests: validation.rustTestsPerVersion,
  nodeTests: validation.fullNodeTestsPerVersion, indexUnchanged: '45,8%' }));
