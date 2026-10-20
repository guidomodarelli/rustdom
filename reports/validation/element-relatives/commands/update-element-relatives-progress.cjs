'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');
const root = process.argv[2];
const primary = process.argv[3];
const evidence = JSON.parse(fs.readFileSync(root + '/reports/validation/element-relatives/evidence.json'));
const merged = JSON.parse(fs.readFileSync(primary + '/.cache/pr72-merged.json'));
assert.equal(merged.state, 'MERGED');
assert.equal(evidence.validation.fullNodeTestsPerVersion, 3358);
const originalHandoff = fs.readFileSync(root + '/reports/progress/HANDOFF.md', 'utf8');
const historyStart = originalHandoff.indexOf('## Actualización del 20 de octubre de 2026');
assert.ok(historyStart > 0);
const header = `# Continuar rustdom en otra máquina

## Estado actual: hijos y hermanos Element

La base estable es main, commit \`${merged.mergeCommit.oid}\`, tag
\`checkpoint-060-collection-members\`. El PR 72 está mergeado: ocho checks
aprobados y revisión limpia de \`2ae5f2c\`; la rama integrada fue eliminada.
Incluye namedItem/nombres soportados en Rust y el fix del factory Float64Array
desde un realm limpio. Los cuatro fallos originales de DOMParser ya están
resueltos desde el PR 70 y checkpoint 58; el registro antiguo de abajo es histórico.

El siguiente hito es \`feature/native-element-relatives\`: children,
firstElementChild, lastElementChild, nextElementSibling y previousElementSibling
recorren y filtran enlaces en Rust. childElementCount conserva children y su
invalidación; WebIDL, factories y owners siguen usando la integración actual.
El runtime continúa siendo híbrido. Verificar el PR y sus checks antes de asumir
que este hito ya está integrado en main.

La validación local pasó 281 tests Rust en 1.98.1/1.99.1, 3.358 contratos Node
por versión 22.12.0/24.14.1, Jest 21, Vitest 32 y VM 32. Pasaron también 613
focales, 64 contratos del harness y 44 escenarios de GC por Node, HTML5,
paridad WPT, nueve lotes de Memcheck y 40 controles del mismo paquete instalado.
Los ocho reportes de benchmark guardan ambos órdenes y 36 muestras por
fila/motor/etapa/runtime, con todas las regresiones. Consultar resultados y límites:

- [Validación y fuentes](../validation/element-relatives.md).
- [Benchmarks](../benchmarks/element-relatives/README.md).
- [Memoria](../memory/element-relatives/README.md).

El índice global sigue en 45,8% por áreas: no mide compatibilidad completa ni
APIs terminadas. Quedan muchas implementaciones en JavaScript/jsdom. El próximo
bloque identificado es Document.getElementsByName, cuyo filtro/recorrido aún usa
JavaScript y debe conservar una NodeList viva, UTF-16, namespaces y sus owners.

Prompt para retomar:

\`\`\`text
Retomá rustdom desde feature/native-element-relatives; si fue mergeada, partí
de main. Leé AGENTS.md, reports/progress/HANDOFF.md, ROADMAP.md y
reports/validation/element-relatives.md. Verificá el estado remoto y el SHA
revisado de cada PR antes de dar por integrada una rama.

Los cuatro fallos originales de DOMParser están resueltos. Terminá los checks
o reviews pendientes de este hito y continuá con las APIs aún delegadas,
empezando por Document.getElementsByName si sigue pendiente. Preservá NodeList
viva, identidad, namespaces, UTF-16, orden, mutaciones y liberación de owners.

El objetivo sigue siendo 100% de implementación Rust y compatibilidad
verificable con jsdom; la versión híbrida es intermedia. Instalá lo necesario
sin pedir permiso. Validá Node 22 y 24, guardá benchmarks y análisis de memoria,
y publicá cada hito probado con commit, push y checkpoint. Aplicá
codex-autofix-loop en cada PR; no publiques paquetes npm automáticamente.
\`\`\`

`;
fs.writeFileSync(root + '/reports/progress/HANDOFF.md', header + originalHandoff.slice(historyStart));
let roadmap = fs.readFileSync(root + '/ROADMAP.md', 'utf8');
roadmap = roadmap.replace('El siguiente hito, feature/native-collection-members, migra namedItem y supportedPropertyNames a Rust y evita cruces por atributo;', 'HTMLCollection.namedItem y supportedPropertyNames están integrados por el PR 72 en checkpoint-060-collection-members; evitan cruces por atributo y capturan el factory de transporte en un realm limpio;');
roadmap = roadmap.replace('El siguiente bloque de migración identificado es el recorrido físico de hijos y hermanos Element, preservando la actualización de children al leer childElementCount y su liberación de miembros obsoletos.', 'El hito feature/native-element-relatives ya migra el recorrido físico de hijos y hermanos Element, preservando children, childElementCount y la liberación de miembros obsoletos; tiene validación local completa en reports/validation/element-relatives.md, con integración sujeta al PR y checks. El siguiente bloque identificado es Document.getElementsByName: su filtro/recorrido JavaScript y NodeList viva todavía requieren migración.');
fs.writeFileSync(root + '/ROADMAP.md', roadmap);
let progress = fs.readFileSync(root + '/reports/progress/native-migration.md', 'utf8');
const detailsStart = progress.indexOf('Es un indicador de planificación');
assert.ok(detailsStart > 0);
progress = `# Indicador provisional de migración a Rust

Estado actualizado el 20/10/2026 UTC. Main contiene \`${merged.mergeCommit.oid}\`,
checkpoint-060-collection-members (PR 72), con namedItem y nombres soportados
nativos y su fix de intrínsecos. El siguiente hito, feature/native-element-relatives,
migra el recorrido físico de hijos/hermanos Element; comprobar el PR remoto antes
de asumir integración. WebIDL, factories, invalidación y otras APIs conservan
trabajo pendiente; el runtime continúa siendo híbrido.

**2 áreas implementadas, 7 parciales y 3 delegadas: índice 45,8%.**

El hito de Element pasó 281 tests Rust en 1.98.1/1.99.1, 3.358 contratos Node
por versión, runners, corpus, 44 escenarios GC por Node, Memcheck y 40 controles
instalados. Sus ocho reportes de rendimiento conservan 36 muestras por
fila/motor/etapa/runtime y todas las regresiones. Ver reports/validation/element-relatives.md.
Profundizar un área parcial no incrementa automáticamente el índice global.

` + progress.slice(detailsStart);
fs.writeFileSync(root + '/reports/progress/native-migration.md', progress);
console.log(JSON.stringify({ updated: true, main: merged.mergeCommit.oid, index: 45.8 }));
