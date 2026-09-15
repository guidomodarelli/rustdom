# Unión del guard de slots con main

La rama del PR43 se actualiza sobre main
`13f638bcade01fd80679236ccab4e7f891c78937`, conservando el guard publicado
en `5f36a2e8e7bd7010535d06836ecf36e0d0e649f9` y el ajuste de npm de
`99f75acb9c6484ed32d91c5f55d9e5cda2ace7eb`.

El único conflicto estaba en los campos iniciales de TreeStore. La resolución
conserva la identidad débil del driver de asignación, la identidad independiente
de entrega de observadores y el registro de observadores de main. Cada driver
comprueba su propio token; no se elimina ningún campo ni algoritmo de main.

La validación ejecutada sobre la unión pasó los siete gates de
`npm run validate`: formato, Clippy, 238 tests Rust, build, 1658 contratos
Node, Jest/Vitest/VM, corpus HTML5 y WPT. El corpus HTML compara 1784 casos y
conserva ocho exclusiones script-on. El reporte del gate guarda exit codes,
señales y duración en `slot-main-union/validation.json`.

La ejecución adicional de
`node --test tests/slot-assignment-driver.spec.cjs tests/mutation-observer-delivery.spec.cjs`
pasó 11 casos de uso real y GC. Incluye reanudación en otro bosque, retención
del driver con el origen liberado y el control de entrega de observadores.
Se conserva su salida en `slot-main-union/ownership.log`.

Las muestras del benchmark anterior del guard pertenecen a su base original;
no se presentan como mediciones de esta unión. Los resultados del benchmark de la unión se detallan a continuación. Las pruebas finitas de GC
no prueban ausencia universal de fugas.

## Evidencia final de la unión

WPT pasó 144/144 fixtures en paridad: 48.349 resultados, de los cuales
47.279 aprueban el estándar y 1.070 son fallos compartidos. Permanece el
bloqueo histórico del bootstrap Range-deleteContents de jsdom. El JSON
crudo se conserva sin pérdida en
`reports/compatibility/2026-09-15T14-59-32.968Z-linux-wpt.json.gz`;
`slot-main-union/wpt-summary.json` registra hashes, tamaños, límites y
verificación de descompresión idéntica. El original local pasó a .cache.

Benchmark de esta unión:
`reports/benchmarks/2026-09-15T15-06-55.619Z-linux-x64.json`.
Cuatro procesos alternados y 18 muestras por motor/caso, después del
warmup; los outputs equivalentes se verifican fuera del intervalo medido.
El addon coincide con el validado:
`fc9c7d4a59bd6fb5dd0464e678749ea6592002d29dd98554cf16077fbde8433d`.

| Carga | Tamaño | jsdom mediana (ms) | rustdom mediana (ms) | Ratio jsdom/rustdom |
| --- | ---: | ---: | ---: | ---: |
| slot-reassign-100 | 25 | 1,850 | 2,464 | 0,75 |
| slot-reassign-100 | 100 | 3,935 | 3,053 | 1,29 |
| slot-dense-reassign-100 | 25 | 14,171 | 2,885 | 4,91 |
| slot-dense-reassign-100 | 100 | 188,501 | 3,917 | 48,12 |

Se mantiene la regresión de la carga pequeña. Estas mediciones comparan
esta unión con jsdom, no aíslan causalmente el costo del guard. El SHA de
sourceCommit del reporte corresponde al padre anterior a cerrar el merge;
sourceHash/sourceChanges y el hash del addon identifican el contenido
realmente medido de la unión.
