# Selection: estado final validado para publicación

La implementación local está basada en main 3c7213f7e636fa6c389f63988bc6bdcc9fdfad1f, checkpoint-055-form-data. El PR67 ya está mergeado. Selection todavía debe pasar su propio ciclo de PR/CI/revisión antes de integrarse en main.

Fuentes SHA-256: ab67daf73590d2c480da3f8a8321b7eb4a12a1e0ecbc06379ba3b9a00c0e4b9b.
Addon SHA-256: 57060976eb249c25e90ceac03e7c4a51311566fb80197858f5c12aba590a5a4f.
Runtime validado: /home/guido/rustdom-selection-on-f17-h79SCa.
selection-main55/context.json prueba que main tiene el mismo árbol que f17b683 y que los 729 archivos respaldados, incluidos fuentes y tipos, se restauraron sin cambios. La fuente resultante es idéntica a la validada; no se repitieron tests por el cambio exclusivo de ascendencia Git.

## Implementación y límites

Rust conserva dirección, decisiones y control de lecturas, asociación, collapse/extend, setBaseAndExtent, selección de hijos, borrado, pertenencia y stringificación. El adapter mantiene el Range compartido y su realm visibles a V8 y conecta factories, excepciones y entrega de selectionchange.

La ruta directa selectionOperationResult devuelve la identidad original dentro del scope N-API; la API anterior con callback sigue disponible. No persisten valores JavaScript en el estado nativo. Las llamadas no invocables a métodos de Range producen el diagnóstico intrínseco del motor sin volver a leer getters ni consultar un TypeError global reemplazado.

## Validación final

- Formato, Clippy y 253 tests Rust aprobados.
- Node24: 2.316 contratos Node; Jest 19, Vitest 30 y pools VM 30.
- Node22/24: 31 contratos focales por runtime, incluidas excepciones primitivas, getters, reentrada, identidades y métodos no invocables.
- HTML: 1.784 casos comparables y 8 excluidos.
- WPT: 216 fixtures, 82.304 resultados en paridad, 81.104 estándares aprobados y 1.200 fallos compartidos. Incluye 35 fixtures Selection con 33.492 resultados y tres fallos compartidos.
- GC: 14 escenarios por runtime. Document y Window se observan por separado; la prueba mantiene el estado escalar nativo vivo mientras exige liberar los owners DOM. Estrés de 1.000 ciclos y 8.000 operaciones, con supervivientes y operaciones activas en cero.
- El mismo paquete pasó 20 controles por runtime en Node22.12/24.20 con npm/pnpm: tipos, CJS/ESM, Workers, assets y runners reales.

Paquete: rustdom-rustdom-0.1.0-alpha.0-linux-x64-glibc-2026-09-16T01-14-12.337Z.tgz.
SHA-256: 469d80665fa1f5d7b737a050fa4313e7f38bc42e637bbe5bb084648d3dc17b17.
Reportes: reports/distribution/2026-09-16T01-14-15.300Z-linux-x64.json y 2026-09-16T01-15-38.052Z-linux-x64.json.
Los gates y logs están en selection-on-f17/. GC final: reports/memory/2026-09-16T01-07-43.062Z-selection.json y 01-07-45.258Z-selection.json.

## Rendimiento observado

La medición final usa la misma fuente y binario, Node24.20/jsdom27.4, dos procesos por motor, tres warmups y 18 muestras por fila. El setup, la validación y el cleanup quedan fuera del intervalo; memoria registrada después de GC, no pico.

| Operación, 1.000 filas | jsdom (ms) | rustdom (ms) | Costo relativo rustdom |
| --- | ---: | ---: | ---: |
| Lecturas | 0,787 | 6,387 | 8,1× |
| Asociación | 3,323 | 16,648 | 5,0× |
| Stringificación | 0,282 | 1,198 | 4,2× |

Se conservan también los resultados de 100 filas, todas las muestras y controles en reports/benchmarks/2026-09-16T01-19-30.367Z-linux-x64.json y su resumen Markdown. El objetivo de rendimiento sigue abierto. Los experimentos anteriores de retorno directo y guard de llamadas conservan sus propios baselines; no se suman sus porcentajes ni se presenta esta migración como una mejora global.

El WPT final se archivó sin pérdidas: 59.944.195 bytes originales y 858.658 bytes gzip, con hashes/roundtrip en selection-on-f17/archive-manifest.json. Las versiones históricas y sus fallos se conservan. Paridad de un corpus y pruebas finitas de GC no acreditan compatibilidad universal ni ausencia absoluta de fugas; persisten los bloqueos/exclusiones documentados y trabajo de migración general.
