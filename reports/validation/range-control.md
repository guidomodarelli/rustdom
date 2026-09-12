# Comparación, colapso y copia de Range en Rust

`compareBoundaryPoints` resuelve el modo, raíces y selección de extremos en
Rust. Conserva el orden de validación pública, el realm del receptor para
DOMException y la diferencia entre raíces distintas de los rangos y una
inconsistencia interna del par seleccionado. La API nativa valida la topología
de los cuatro handles antes de devolver cualquier resultado del modo.

`NativeRange.copy()` copia valores independientes sin reconstruir objetos de
extremos en JS. El constructor del clone reutiliza esa copia y registra sus
propias referencias débiles y su limpieza; no vuelve a escribir los valores
nativos ya copiados. `collapse` recibe el extremo y la actualización decididos
en Rust, y el binding entrega esa actualización al enlace de ownership.

Los getters escalares todavía cruzan Node-API, y esta etapa no afirma haber
resuelto todos los costos de lectura y creación registrados en el hito anterior.
Siguen pendientes operaciones de contenidos, ajustes por otras mutaciones
y Selection.

Pasaron formato, Clippy, **87 tests Rust y 18 contratos focales Node** de
control, estado, puntos y CharacterData. La cobertura incluye los cuatro
modos de comparación, precedencia de errores, realms, copias independientes,
colapso, mutaciones posteriores y rechazo de cada extremo no asignado.
La prueba de slots en documentos persistentes ahora crea también clones y
los colapsa antes de observar su recolección.

El [Memcheck conjunto de Range](../memory/2026-09-12T11-27-19Z-range-control-valgrind.log)
pasó 19 tests del ejecutable Rust: cero errores y cero pérdidas definitivas o
indirectas. Los 48 bytes posibles y 544 alcanzables del runtime se conservan
sin supresiones. Este alcance no equivale a inspeccionar V8 bajo Memcheck;
el addon y sus referencias se ejercitan por separado con GC real.

La validación completa pasó **87 tests Rust, 277 contratos Node, 7 Jest,
11 Vitest, 4 VM y 1.784 casos comparables HTML5**. El
[informe WPT](../compatibility/2026-09-12T11-28-39.372Z-linux-wpt.json)
conserva los 43.708 casos en paridad, 42.678 aprobados contra el estándar y
1.030 fallos compartidos ya documentados.

El [GC con clones en documentos persistentes](../memory/2026-09-12T11-30-00Z-range-control-gc.json)
crea y destruye 4.814 estados nativos, conserva 12 snapshots y mantiene los
slots `[0, 1, 0, 0]` mientras se retiene un único Range vivo. Al liberar los
dueños, documentos, ventanas, rangos y estados vuelven a cero.

El [estrés de cinco modos](../memory/2026-09-12T11-30-47.974Z-linux-x64.json)
también pasó. Rustdom libera 882 Document/Window y 1.000 rangos; Vitest normal
y VM liberan 440 Document/Window y 1.320 rangos cada uno. Rustdom registra
heap +2,07 MiB y RSS +14,23 MiB después de GC. Se conservan las muestras y
sus límites; estos deltas no representan memoria pico ni una prueba absoluta
de ausencia de todas las fugas posibles.

El paquete pasó 18 controles con [Node 24](../distribution/2026-09-12T11-30-06.021Z-linux-x64.json)
y 18 con [Node 22.12](../distribution/2026-09-12T11-32-44.457Z-linux-x64.json),
incluidas instalación npm/pnpm, tipos, CJS/ESM, workers, Jest, Vitest y pools VM.
Los consumidores verifican copia nativa, planes de colapso y comparación,
además de la independencia de los rangos públicos. SHA-256 del artefacto:
`86d204b49fc376d99a25f416cd23472afc69923aa5461c9ef3fa65b8c36004c0`.

El [benchmark aislado](../benchmarks/2026-09-12T11-36-04.409Z-linux-x64.md)
conserva todos los procesos y muestras:

| Operación | Filas | jsdom | rustdom | Ratio |
| --- | ---: | ---: | ---: | ---: |
| Comparar rangos, 1.000 pares | 250 | 36,696 ms | 2,322 ms | 15,81× |
| Comparar rangos, 1.000 pares | 1.000 | 163,350 ms | 2,434 ms | 67,12× |
| Crear/copiar Range y StaticRange, 1.000 ciclos | 250 | 4,947 ms | 19,397 ms | 0,26× |
| Crear/copiar Range y StaticRange, 1.000 ciclos | 1.000 | 5,397 ms | 18,005 ms | 0,30× |
| Copiar, colapsar y comparar, 1.000 veces | 250 | 2,094 ms | 4,904 ms | 0,43× |
| Copiar, colapsar y comparar, 1.000 veces | 1.000 | 2,047 ms | 5,034 ms | 0,41× |

La copia nativa conserva un costo apreciable de construcción y bindings.
Estas mediciones no demuestran que ese costo incremental haya desaparecido;
se mantiene como trabajo pendiente junto con los getters escalares. Tampoco
se extrapolan los ratios favorables de comparación al tiempo de suites completas.
