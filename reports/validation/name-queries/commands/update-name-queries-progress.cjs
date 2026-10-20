'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');
const root = process.argv[2];
const primary = process.argv[3];
const evidence = JSON.parse(fs.readFileSync(root + '/reports/validation/name-queries/evidence.json'));
const merged = JSON.parse(fs.readFileSync(primary + '/.cache/pr73-merged.json'));
assert.equal(merged.state, 'MERGED');
assert.equal(merged.treeMatchesReviewedHead, true);
assert.equal(evidence.validation.fullNodeTestsPerVersion, 3419);
const originalHandoff = fs.readFileSync(root + '/reports/progress/HANDOFF.md', 'utf8');
const historyStart = originalHandoff.indexOf('## Actualización del 20 de octubre de 2026');
assert.ok(historyStart > 0);
const header = `# Continuar rustdom en otra máquina

## Estado actual: Document.getElementsByName

La base estable es main, commit \`${merged.mergeCommit.oid}\`, tag
\`checkpoint-061-element-relatives\`. El PR 73 está mergeado: ocho checks
aprobados y revisión limpia de \`0921ab0\`; la rama integrada fue eliminada.
Incluye el recorrido físico de hijos y hermanos Element en Rust. children y
childElementCount conservan la invalidación y liberación de miembros obsoletos.
Los cuatro fallos originales de DOMParser están resueltos desde el PR 70 y
checkpoint 58; el registro antiguo de abajo es histórico.

El siguiente hito es \`feature/native-name-queries\`: Document.getElementsByName
recorre y filtra atributos canónicos en Rust, preservando valores UTF-16,
namespaces, orden e identidades. WebIDL, factories, NodeList viva y su
invalidación conservan el host actual. El runtime continúa siendo híbrido.
Verificar el PR y sus checks antes de asumir que este hito está integrado.

La validación local pasó 285 tests Rust en 1.98.1/1.99.1, 3.419 contratos Node
por versión 22.12.0/24.14.1, Jest 21, Vitest 32 y VM 32. Pasaron 61 contratos
de nombres, 72 del harness y 52 escenarios de GC por Node, HTML5, nueve lotes
de Memcheck y 40 controles del mismo paquete instalado. WPT conserva paridad:
221 fixtures de release más 15 suplementarios de nombres, con 82.982 resultados
y 1.202 fallos de estándar compartidos por Node; no certifica conformidad total.

Los ocho reportes de benchmark guardan ambos órdenes y 36 muestras por
fila/motor/etapa/runtime, con todas las regresiones. Consultar resultados y límites:

- [Validación y fuentes](../validation/name-queries.md).
- [Benchmarks](../benchmarks/name-queries/README.md).
- [Memoria](../memory/name-queries/README.md).

El índice global sigue en 45,8% por áreas: no mide compatibilidad completa ni
APIs terminadas. Quedan implementaciones en JavaScript/jsdom. Después de cerrar
este PR, identificar el siguiente algoritmo delegado en Document/Element o Node,
manteniendo los contratos existentes y pruebas diferenciales reales.

Prompt para retomar:

\`\`\`text
Retomá rustdom desde feature/native-name-queries; si fue mergeada, partí de main.
Leé AGENTS.md, reports/progress/HANDOFF.md, ROADMAP.md y
reports/validation/name-queries.md. Verificá el estado remoto y el SHA revisado
de cada PR antes de dar por integrada una rama.

Los cuatro fallos originales de DOMParser están resueltos. Terminá los checks
o reviews pendientes de este hito y continuá con las APIs aún delegadas.
Preservá listas vivas, identidades, namespaces, UTF-16, orden, errores,
mutaciones y liberación de Document y Window observados por separado.

El objetivo sigue siendo 100% de implementación Rust y compatibilidad
verificable con jsdom; la versión híbrida es intermedia. Instalá lo necesario
sin pedir permiso. Validá Node 22 y 24, guardá benchmarks y análisis de memoria,
y publicá cada hito probado con commit, push y checkpoint. Aplicá
codex-autofix-loop en cada PR; no publiques paquetes npm automáticamente.
\`\`\`

`;
fs.writeFileSync(root + '/reports/progress/HANDOFF.md', header + originalHandoff.slice(historyStart));
let roadmap = fs.readFileSync(root + '/ROADMAP.md', 'utf8');
const oldMilestone = 'El hito feature/native-element-relatives ya migra el recorrido físico de hijos y hermanos Element, preservando children, childElementCount y la liberación de miembros obsoletos; tiene validación local completa en reports/validation/element-relatives.md, con integración sujeta al PR y checks. El siguiente bloque identificado es Document.getElementsByName: su filtro/recorrido JavaScript y NodeList viva todavía requieren migración.';
const newMilestone = 'El recorrido físico de hijos y hermanos Element está integrado por el PR 73 en checkpoint-061-element-relatives, preservando children, childElementCount y la liberación de miembros obsoletos; ver reports/validation/element-relatives.md. El hito feature/native-name-queries migra el recorrido y filtro de Document.getElementsByName a Rust, conservando NodeList viva, UTF-16, namespaces y owners. Su validación local, benchmarks y memoria están en reports/validation/name-queries.md; la integración depende del PR y sus checks. Quedan factories, WebIDL y algoritmos generales de Document/Element y Node.';
assert.ok(roadmap.includes(oldMilestone) || roadmap.includes(newMilestone));
roadmap = roadmap.replace(oldMilestone, newMilestone);
fs.writeFileSync(root + '/ROADMAP.md', roadmap);
let progress = fs.readFileSync(root + '/reports/progress/native-migration.md', 'utf8');
const detailsStart = progress.indexOf('Es un indicador de planificación');
assert.ok(detailsStart > 0);
progress = `# Indicador provisional de migración a Rust

Estado actualizado el 20/10/2026 UTC. Main contiene \`${merged.mergeCommit.oid}\`,
checkpoint-061-element-relatives (PR 73), con hijos y hermanos Element nativos.
El siguiente hito, feature/native-name-queries, migra el recorrido y filtro de
Document.getElementsByName; comprobar el PR remoto antes de asumir integración.
WebIDL, factories, invalidación y otras APIs conservan trabajo pendiente;
el runtime continúa siendo híbrido.

**2 áreas implementadas, 7 parciales y 3 delegadas: índice 45,8%.**

El hito de nombres pasó 285 tests Rust en 1.98.1/1.99.1, 3.419 contratos Node
por versión, runners, corpus, 52 escenarios GC por Node, Memcheck y 40 controles
instalados. WPT combina 221 fixtures de release y 15 suplementarios con paridad,
manteniendo exclusiones y fallos de estándar compartidos. Sus ocho reportes de
rendimiento conservan 36 muestras por fila/motor/etapa/runtime y todas las
regresiones. Ver reports/validation/name-queries.md.
Profundizar un área parcial no incrementa automáticamente el índice global.

` + progress.slice(detailsStart);
fs.writeFileSync(root + '/reports/progress/native-migration.md', progress);
console.log(JSON.stringify({ updated: true, main: merged.mergeCommit.oid, index: 45.8 }));
