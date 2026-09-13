# Aplanado nativo de slots

Rust expande las listas asignadas mediante una pila explícita y conserva el
orden de resultados. Si no hay asignados, usa hijos Element/Text como fallback;
CDATA asignado se conserva, pero CDATA fallback se excluye como en jsdom.
Los slots fuera de un árbol shadow se emiten como nodos ordinarios cuando son
candidatos, y una consulta inicial fuera de ShadowRoot devuelve una lista vacía.

Un conjunto activo por camino rechaza ciclos de grafos raw sin deduplicar
globalmente los resultados. Pila, conjunto y vectores son temporales y contienen
IDs, sin nuevos owners o caches persistentes. Los errores conservan la operación
y el nodo implicado; el árbol permanece intacto y puede repararse después.

El bridge resuelve primero la WeakRef del slot de entrada. Esto conserva el
ancla mientras se ejecuta la consulta nativa y se convierten sus IDs en objetos,
según [WeakRefDeref de ECMAScript](https://tc39.es/ecma262/multipage/managing-memory.html#sec-weakrefderef).
No se agrega una referencia persistente; la recolección posterior se verifica
en turnos de GC separados.

## Contratos y lifetime

Pasaron cuatro tests Rust nuevos y Clippy: CDATA asignado/fallback, 1.024 niveles
de fallback sin recursión de control, ciclo raw con reparación y rechazo atómico
de inputs/snapshots. Dieciséis contratos DOM existentes y nuevos pasaron sobre
el addon; el archivo de aplanado terminó con cinco contratos aprobados después
de agregar la API raw y el control de GC.

Las pruebas públicas comparan 8 y 60 niveles de relay, roots abiertos/cerrados,
fallback anidado, snapshots independientes, adopción, light DOM, templates y
CDATA con los dos motores reales. Los mismos tres contratos pasaron antes de
modificar el algoritmo, como referencia.

El [control focal de memoria](../memory/2026-09-13T04-27-22.095Z-slot-flatten.json)
ejerció cinco ciclos. Un snapshot retenido mantiene nodos vivos; al soltarlo
se liberan. Los arrays vacíos retenidos no mantienen árboles tras el job, y
los contadores nativos vuelven al baseline. Es evidencia finita, no una prueba
absoluta de ausencia de toda fuga.

El Memcheck focal ejecutó catorce tests de slots sin errores ni pérdidas
definitivas o indirectas. Conserva 48 bytes posibles y 544 alcanzables de
std/libtest, sin supresiones, en
`../memory/2026-09-13T04-33-08.736Z-slot-flatten-valgrind.log`, junto a salida
de tests y hash del ejecutable.

El estrés ampliado con un relay real pasó en cinco modos:
`../memory/2026-09-13T04-34-48.885Z-linux-x64.json`. Rustdom liberó 1.322
documentos y 882 ventanas; cada Vitest liberó 1.320 documentos y 880 ventanas.
Heap/RSS:2,72/18,95 MiB rustdom,4,01/40,15 MiB Vitest y3,66/102,16 MiB VM.
Se comprueba recolección después de turnos asíncronos; no se interpreta RSS
como memoria pico ni como prueba aislada de fugas.

La validación integral aprobó **152 tests Rust, 500 contratos Node, 7 Jest,
18 Vitest y 26 VM**, además de 1.784 casos HTML5 comparables. El informe WPT
`../compatibility/2026-09-13T04-41-49.290Z-linux-wpt.json` conserva 43.708 casos
ejecutables en paridad, con 42.678 aprobados por estándar y 1.030 fallos
compartidos. El bootstrap bloqueado de Range-deleteContents sigue declarado.

## Benchmarks

`../benchmarks/2026-09-13T04-30-37.189Z-linux-x64.json` conserva 18 muestras
por motor/caso sin otros runners locales simultáneos. La cadena prepara
10/100 relays y dos hojas antes del timer; consulta el slot terminal 100 veces
y consume identidades/longitudes. Los hashes incluyen todas las raíces shadow.

| Operación | Tamaño | jsdom ms | rustdom ms | Ratio |
|---|---:|---:|---:|---:|
| 1.000 lecturas assignedSlot | 25 slots | 5,101 | 1,840 | 2,77× |
| 100 reasignaciones, un candidato | 25 slots | 2,142 | 1,350 | 1,59× |
| 1.000 lecturas assignedSlot | 100 slots | 13,007 | 5,535 | 2,35× |
| 100 reasignaciones, un candidato | 100 slots | 3,449 | 2,022 | 1,71× |
| 100 consultas de asignados, denso | 25 slots | 8,755 | 0,480 | 18,25× |
| 100 reasignaciones, denso | 25 slots | 17,028 | 1,704 | 9,99× |
| 100 consultas de asignados, denso | 100 slots | 105,740 | 1,045 | 101,17× |
| 100 reasignaciones, denso | 100 slots | 203,440 | 2,591 | 78,53× |
| 100 consultas de aplanado | 10 relays | 1,858 | 0,394 | 4,71× |
| 100 consultas de aplanado | 100 relays | 8,389 | 1,728 | 4,86× |

Ratio = mediana jsdom / mediana rustdom. Son patrones sintéticos, no tiempos
de suites completas ni una comparación causal A/B contra el commit anterior.
Las listas cacheadas y la entrega de señales mantienen sus drivers JS; el
objetivo integral de migración continúa pendiente.

El paquete con SHA-256
`ad2e3165033dc8ac380760ac9ef53b25d786f91e016a0de62f52bf3354d09867`
pasó **18 controles en Node 24.14.1 y 18 en Node 22.12.0**, con instalaciones
npm/pnpm fuera del checkout. Los consumidores CJS/ESM comprueban la API raw
y una cadena real de slots en VM, además de ejecutar los runners. Informes:
`../distribution/2026-09-13T04-45-30.677Z-linux-x64.json` y
`../distribution/2026-09-13T04-47-52.317Z-linux-x64.json`.
