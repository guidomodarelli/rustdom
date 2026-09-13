# Estado nativo de nombres asignables a slots

Rust conserva los nombres no vacíos de Element/Text en un mapa compacto con
IDs numéricos. El nombre vacío es implícito y no agrega almacenamiento por
nodo. Los hooks originales mantienen su orden; `_slotableName` consulta y
actualiza Rust. La búsqueda usa directamente ese estado sin copiar el nombre
de ida y vuelta por JavaScript.

Se evita activar nodos durante la inicialización temprana del mixin, que
ocurre antes de completar metadata en Element y Text. Las escrituras reales
se validan después de inicializar el nodo. Un nombre no vacío impide cambiar
su metadata a un tipo no asignable; limpiar el nombre retira esa restricción.
Liberar un nodo elimina su entrada y compacta el mapa, incluida capacidad
cero cuando no quedan nombres. `slotableNames` expone conteos y capacidad;
el endpoint de memoria compara el conteo con su baseline.

La comparación de nombres y namespaces de slots usa directamente strings
UTF-8 cuando están disponibles y conserva la comparación por unidades UTF-16
para la representación lossless. No cambia normalización, mayúsculas ni
namespaces. La ruta raw `findSlot(root, name)` sigue disponible; la ruta del
runtime usa `findSlotFor(root, slotable)`.

Se preserva también la herencia de CDATASection desde Text del jsdom fijado.
Al adoptar CDATA desde XML en un host HTML, assignedSlot encuentra el slot
predeterminado aunque la lista cacheada de assignedNodes siga vacía hasta
una reasignación. assignedNodes con flatten realiza la búsqueda actual. La
restricción inicial de tipo excluía CDATA; la diferencia reproducida está en
`../compatibility/2026-09-13T02-22-06Z-cdata-slot-state.json` y una regresión
pública exige exactamente el comportamiento del oráculo. El helper general
isSlotable conserva su definición original; se distingue del soporte del
estado heredado de nombres.

## Pruebas focales

Pasaron siete tests Rust de slots/nombres, Clippy, build y nueve contratos
Node. Cubren nombres vacíos y surrogates, metadatos UTF-16, entradas inválidas,
rechazo atómico, liberación de 1.000 nombres con otro nodo vivo, búsquedas
nativas, parsing HTML nativo/con posiciones/con scripts, namespaces,
clonación, splitText y adopción. El atributo con surrogates del test raw usa
el transporte JSON lossless existente; el inicializador rápido UTF-8 no sirve
para preparar ese fixture.

Memcheck ejecutó los siete tests del módulo sin errores ni pérdidas definitivas
o indirectas. Se conservan 48 bytes posibles y 544 alcanzables de std/libtest,
sin supresiones, en `../memory/2026-09-13T02-08-57.198Z-slotable-valgrind.log`,
junto a la salida de tests y el hash del ejecutable.

El estrés de cinco modos pasó en
`../memory/2026-09-13T02-09-58.495Z-linux-x64.json`. Los escenarios mantienen
nombres no vacíos hasta teardown; al finalizar, namedNodes y capacity son cero
en rustdom y ambos modos Vitest. Rustdom liberó 1.322 documentos y 882 ventanas;
cada Vitest liberó 1.320 documentos y 880 ventanas. Los deltas de heap/RSS fueron
2,71/18,77 MiB rustdom, 4,01/109,42 MiB Vitest y 3,64/99,03 MiB VM. RSS incluye
retención del allocator; estos controles finitos no prueban ausencia absoluta
de fugas ni representan memoria pico.

La validación integral pasó **145 tests Rust, 491 contratos Node, 7 Jest,
18 Vitest y 26 VM**, además de 1.784 casos HTML5 comparables. El informe WPT
`../compatibility/2026-09-13T02-15-03.481Z-linux-wpt.json` conserva los 43.708
casos ejecutables en paridad, con 42.678 aprobaciones de estándar y 1.030
fallos compartidos. El bootstrap bloqueado de Range-deleteContents sigue
declarado; no se afirma compatibilidad integral a partir de estos resultados.

## Mediciones conservadas

La primera medición está en
`../benchmarks/2026-09-13T02-02-39.185Z-linux-x64.json`: construcción con
25/250/1.000 filas dio 1,01×/0,81×/0,71×; creación de hosts, 0,97×; lecturas
de slots, 1,17×/1,08× y reasignaciones, 0,90×/0,87×. Estos últimos resultados
motivaron reducir la comparación repetida de metadata.

La medición posterior, con la comparación directa de strings ordinarios,
está en `../benchmarks/2026-09-13T02-07-27.681Z-linux-x64.json`. Conserva
18 muestras por motor y caso, sin otros runners locales simultáneos:

| Operación | Tamaño | jsdom ms | rustdom ms | Ratio |
|---|---:|---:|---:|---:|
| 1.000 lecturas de assignedSlot | 25 slots | 4,116 | 1,787 | 2,30× |
| 100 reasignaciones y lecturas | 25 slots | 1,964 | 1,579 | 1,24× |
| 1.000 lecturas de assignedSlot | 100 slots | 11,688 | 4,932 | 2,37× |
| 100 reasignaciones y lecturas | 100 slots | 3,765 | 2,121 | 1,78× |

Ratio = mediana jsdom / mediana rustdom. Ambos informes comprueban identidades,
listas assignedNodes y hashes de documento/ShadowRoot. El segundo también
verifica que existe estado nativo de nombres durante la prueba. Los perfiles
seleccionados difieren y hay variación de tiempos en el oráculo; no se trata
de una comparación causal A/B ni de una mejora universal de runners.

La enumeración de asignados, el aplanado y las notificaciones conservan sus
drivers JS. La migración integral continúa pendiente.

## Cierre con la herencia CDATA corregida

Los diez contratos focales pasaron después de incluir CDATA en el soporte de
nombres heredado de Text. Se repitieron las mediciones y Memcheck sobre el
binario corregido, sin otras cargas locales durante el benchmark.

`../benchmarks/2026-09-13T02-29-08.793Z-linux-x64.json` conserva las muestras
finales y las comprobaciones de identidad, listas y hashes:

| Operación | Tamaño | jsdom ms | rustdom ms | Ratio |
|---|---:|---:|---:|---:|
| 1.000 lecturas de assignedSlot | 25 slots | 3,870 | 1,779 | 2,18× |
| 100 reasignaciones y lecturas | 25 slots | 1,896 | 1,576 | 1,20× |
| 1.000 lecturas de assignedSlot | 100 slots | 12,423 | 4,952 | 2,51× |
| 100 reasignaciones y lecturas | 100 slots | 3,736 | 2,160 | 1,73× |

El Memcheck final está en
`../memory/2026-09-13T02-29-08.839Z-slotable-valgrind.log`: siete tests PASS,
cero errores/pérdidas definitivas o indirectas, 48 bytes posibles y 544
alcanzables, sin supresiones. El estrés final de cinco modos pasó en
`../memory/2026-09-13T02-30-10.086Z-linux-x64.json`; heap/RSS:
2,68/20,27 MiB rustdom, 3,99/43,16 MiB Vitest y 3,64/99,00 MiB VM.

La primera validación integral de 491 contratos y los paquetes con SHA
`40c3861998809adf5590417f2d7440b42726666af31a945f2d5502b09b280aa4`
preceden a la regresión añadida de CDATA. Permanecen como evidencia histórica;
el cierre requiere la validación y el paquete posteriores a esa corrección.

La validación posterior a la corrección pasó **145 tests Rust, 492 contratos
Node, 7 Jest, 18 Vitest y 26 VM**, junto a 1.784 casos HTML5 comparables.
El informe WPT final es
`../compatibility/2026-09-13T02-35-30.801Z-linux-wpt.json`, con la misma
paridad y el bloqueo declarado de Range-deleteContents. Ese bloqueo es de
clonación durante el bootstrap y es distinto del caso de asignación de CDATA
corregido aquí.

El paquete final con SHA-256
`783c5a2ee3e7f6703889ec6d01b33bfb7fd7daad0b6509e7f70154964c5efb4f`
pasó **18 controles en Node 24.14.1 y 18 en Node 22.12.0**, mediante npm y
pnpm fuera del checkout. Los consumidores CJS/ESM ejercen nombres nativos y
CDATA en hosts HTML, además de los runners reales. Informes finales:
`../distribution/2026-09-13T02-38-20.550Z-linux-x64.json` y
`../distribution/2026-09-13T02-40-08.183Z-linux-x64.json`.
