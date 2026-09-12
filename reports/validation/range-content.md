# Consultas de contenido de Range en Rust

`cloneContents` y `extractContents` usan la misma selección Rust para obtener
el ancestro común, los hijos parcialmente contenidos y los hijos completos,
en orden. La geometría de contención y colapso también se comparte con
deleteContents. El cálculo no muta nodos ni mantiene referencias persistentes.

La selección se captura antes de crear clones o entregar mutaciones. Las
longitudes de los subrangos se siguen leyendo en su momento original, después
de los callbacks de construcción que pueden alterar el árbol. Un custom
element real agrega texto a la rama parcial, mueve un nodo contenido y
antepone otro nodo; ambos motores conservan el mismo fragmento y resultado.

El driver mantiene creación de nodos, recursión y hooks en JavaScript. No se
presenta este hito como migración completa de cloneContents/extractContents
ni del objetivo integral.

Pasaron formato, Clippy, **93 tests Rust y 14 contratos focales Node** de
contenido, eliminación y estado. La cobertura incluye fragmentos HTML/XML,
identidad de nodos extraídos, copias independientes, MutationObserver,
doctype rechazado en el realm del Range, reentrancia y errores de handles.
El bloqueo WPT de clonación de CDATA adoptada por HTML permanece explícito
en el manifiesto y no se cuenta como cobertura aprobada.

La validación completa pasó **93 tests Rust, 287 contratos Node, 7 Jest,
11 Vitest, 4 VM y 1.784 casos comparables HTML5**. El
[informe WPT](../compatibility/2026-09-12T12-47-40.603Z-linux-wpt.json)
mantiene 43.708 casos ejecutables en paridad, 42.678 aprobados contra el
estándar y 1.030 fallos compartidos. El fixture bloqueado conserva su marca
separada y `complete: false`.

El [Memcheck conjunto](../memory/2026-09-12T12-45-48Z-range-content-valgrind.log)
pasó 25 tests de Range y geometría sin errores ni pérdidas definitivas o
indirectas. Se mantienen visibles 48 bytes posibles y 544 alcanzables del
runtime, sin supresiones; el alcance es el ejecutable Rust.

El [estrés real de cinco modos](../memory/2026-09-12T12-47-41.517Z-linux-x64.json)
libera 4.000 nodos/fragmentos y 1.500 rangos observados en rustdom, con 3.500
estados nativos creados y destruidos. Cada modo Vitest libera 1.320 nodos/
fragmentos y 1.760 rangos observados, con 3.520 estados nativos creados y
destruidos. No sobreviven los documentos/ventanas observados. Rustdom registra
heap +2,26 MiB y RSS +17,11 MiB tras GC; se conservan muestras y límites,
sin interpretar RSS como memoria pico ni afirmar ausencia absoluta de fugas.

El paquete pasó 18 controles con [Node 24](../distribution/2026-09-12T12-49-50.658Z-linux-x64.json)
y 18 con [Node 22.12](../distribution/2026-09-12T12-52-02.087Z-linux-x64.json),
incluidas instalaciones npm/pnpm, tipos, CJS/ESM, workers y runners reales.
Los consumidores comprueban la selección nativa y fragmentos clonados y
extraídos dentro de una VM. SHA-256 del artefacto:
`ec0d427957251d6b1fd72d317df43e283625e7f33bb2c5da236382a0d4f7c1ed`.

El [benchmark aislado](../benchmarks/2026-09-12T12-58-20.369Z-linux-x64.md)
verifica texto, número de filas, mutación del documento y un hash que incluye
también el fragmento serializado para clonación/extracción:

| Operación | Filas | jsdom | rustdom | Ratio |
| --- | ---: | ---: | ---: | ---: |
| deleteContents | 250 | 191,560 ms | 4,919 ms | 38,94× |
| cloneContents | 250 | 24,792 ms | 20,598 ms | 1,20× |
| extractContents | 250 | 20,850 ms | 5,959 ms | 3,50× |
| deleteContents | 1.000 | 4.303,137 ms | 18,041 ms | 238,52× |
| cloneContents | 1.000 | 407,111 ms | 75,035 ms | 5,43× |
| extractContents | 1.000 | 384,448 ms | 21,956 ms | 17,51× |

Se conservan las muestras completas y los costos de los drivers JS. Son
cargas sintéticas y no equivalen a esos factores sobre una suite entera.
