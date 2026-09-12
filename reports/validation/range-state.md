# Estado canónico de Range en Rust

`Range` y `StaticRange` usan una instancia `NativeRange` para sus handles y
offsets. La estructura Rust tiene tamaño fijo y no posee nodos, ventanas ni
referencias JavaScript. El binding conserva las referencias fuertes a nodos
necesarias para que V8 vea el grafo de ownership. Al recolectar la instancia,
Node-API ejecuta su destructor Rust; los contadores son números atómicos y no
un registro de objetos.

`_start` y `_end` proporcionan snapshots con el valor previo preservado cuando
un consumidor lo guarda antes de un ajuste. Los getters públicos de offsets
y `collapsed` leen Rust. Las consultas/plans nativos consumen el estado en
una sola llamada, evitando reconstruir sus argumentos en JS.

Los offsets internos conservan los valores Number, incluidos -0 y NaN. Las
consultas que antes recibían argumentos Node-API u32 mantienen esa conversión.
Los handles se validan numéricamente al almacenarlos; la clase no está ligada
a un bosque y no posee los nodos. Las operaciones de NativeTree deben recibir
handles del bosque correspondiente y verifican su existencia al consumirlos.

El orden de referencias débiles de rangos vivos permanece en el binding.
Los constructores/algoritmos restantes de Range, StaticRange y Selection,
incluidos ajustes por mutaciones y operaciones de contenidos, aún tienen
responsabilidades JavaScript. Este hito no completa la migración integral.

Pasaron 81 tests Rust y los contratos focales de estado, snapshots, Range,
StaticRange, Selection, CharacterData y errores. Los argumentos de clase
incorrecta o prototipos falsos se rechazan antes del préstamo Rust usando el
type tag de Node-API 8. Un receptor de método incorrecto produce TypeError
en V8; los argumentos de estado incorrectos producen InvalidArg.

El [corpus focal](../compatibility/2026-09-12T10-08-36.881Z-linux-wpt.json)
registra 5.715 casos en paridad, 5.713 aprobados contra el estándar y dos fallos
compartidos de CDATA en cloneRange. El harness conserva la URL de las variantes
de WPT al leer el mismo archivo original: los casos shadow se ejecutan con
`mode=closed` y `mode=open`, no con el parámetro ausente.

La validación conjunta con el preflight de handles pasó **83 tests Rust,
274 contratos Node, 7 Jest, 11 Vitest, 4 VM y 1.784 casos HTML5**. El
[corpus completo](../compatibility/2026-09-12T10-26-52.357Z-linux-wpt.json)
mantiene 43.708 casos en paridad, 42.678 aprobados contra el estándar y
1.030 fallos compartidos. La limpieza adicional descrita abajo se revalida
también antes del checkpoint.

## Ciclo de vida y entradas débiles

El [baseline](../memory/2026-09-12T10-29-00Z-range-slots-baseline.json) mostró
que un documento vivo acumulaba 1.000, 2.000, 3.000 y 4.000 entradas débiles
aunque todas las cajas Rust de esos rangos ya estaban destruidas. El
[jsdom independiente](../memory/2026-09-12T10-29-00Z-range-slots-jsdom.json)
presenta el mismo crecimiento. La entrada expirada seguía en el Set hasta
que otra operación recorriera los rangos vivos o se recolectara el documento.

Un FinalizationRegistry elimina ahora la referencia expirada de ambos nodos
actuales. Sus holdings contienen únicamente IDs y el WeakRef del rango: no
incluyen nodos, ventanas, el Range ni su caja NativeRange. Los IDs se actualizan
al mover extremos. La limpieza conserva las entradas de rangos todavía vivos.

La [regresión roja con scope terminado](../memory/2026-09-12T10-39-00Z-range-slots-red-scope.log)
demostró 1.250 entradas adicionales en el primer lote. El primer intento del
fixture también conservaba el último Range local en el frame async; se aisló
su creación en una función síncrona antes de evaluar el GC, sin cambiar el
criterio de liberación.

El [informe posterior al fix](../memory/2026-09-12T10-43-00Z-range-state-gc-slots.json)
mantiene los slots `[0, 1, 0, 0]` en los cuatro lotes: el único slot pertenece
al Range retenido deliberadamente. Tras soltarlo vuelven al baseline nativo.
En total se crean y destruyen 4.014 cajas, se conservan 12 snapshots numéricos
y terminan en cero los supervivientes de documentos, ventanas, rangos y cajas.

El [Memcheck del estado Rust](../memory/2026-09-12T10-25-18Z-range-state-valgrind.log)
pasó sus tres tests sin errores ni pérdidas definitivas/indirectas. Se conservan
48 bytes posibles y 544 alcanzables de std/libtest, sin supresiones. Su alcance
es el ejecutable Rust; los escenarios V8/Node-API se verifican por separado
mediante GC real. Son pruebas finitas, no una garantía absoluta de ausencia
de toda fuga posible.

La [validación completa posterior a la limpieza](../compatibility/2026-09-12T10-53-32.309Z-linux-wpt.json)
volvió a aprobar formato, Clippy, 83 tests Rust, 274 Node, los runners y el
corpus HTML5. Conserva los 43.708 casos WPT en paridad y los 1.030 fallos
compartidos documentados.

El [estrés completo de cinco modos](../memory/2026-09-12T10-58-32.853Z-linux-x64.json)
pasó: jsdom/rustdom liberaron 882 documentos y 882 ventanas; Vitest normal
y VM liberaron 440 de cada tipo por modo. Rustdom terminó con cero estados
NativeRange vivos y nodos/datos liberados. Conserva heap +2,07 MiB y RSS
+19,89 MiB tras GC; se registra también esa variación de RSS, sin confundirla
con memoria pico ni atribuirla por sí sola a una fuga. El proceso de parsing
Rust registró RSS +0,75 MiB y los dos modos Vitest +1,86/+0,87 MiB.

El paquete pasó 18 controles con [Node 24](../distribution/2026-09-12T10-58-15.445Z-linux-x64.json)
y otros 18 con [Node 22.12](../distribution/2026-09-12T11-00-48.142Z-linux-x64.json),
incluidas instalaciones npm/pnpm, tipos, CJS/ESM, workers y runners reales.
El artefacto incorpora `range-state.cjs` y contratos de NativeRange y de
Range/StaticRange dentro de una VM. Su SHA-256 es
`4e0b610e320f4f86ea627347eb351435cf472e7713ada6c0c2a9e11370c6437f`.

El [estrés ampliado de entornos](../memory/2026-09-12T11-03-07.459Z-linux-x64.json)
crea Range, cloneRange y StaticRange en cada sesión, modifica texto y conserva
solo WeakRefs antes del teardown. En cada modo se observan y recolectan 1.320
rangos/cajas nativas y 440 documentos/ventanas. Los contadores NativeRange
terminan en cero; las diferencias heap/RSS fueron +0,81/+1,83 MiB en modo
normal y +0,43/−0,05 MiB en VM. Las muestras anteriores sin esa carga también
se conservan para distinguir su alcance.

## Rendimiento

El [benchmark aislado](../benchmarks/2026-09-12T11-07-34.580Z-linux-x64.md)
conserva las muestras completas, preparación/validación fuera del reloj y
cuatro procesos alternados. Las lecturas y el ciclo de vida muestran un costo
del estado nativo que todavía requiere optimización:

| Operación | Filas | jsdom | rustdom | Ratio |
| --- | ---: | ---: | ---: | ---: |
| 1.000 lecturas de extremos/colapsado | 250 | 0,238 ms | 1,016 ms | 0,23× |
| 1.000 lecturas de extremos/colapsado | 1.000 | 0,184 ms | 0,799 ms | 0,23× |
| 1.000 ciclos Range/clone/StaticRange | 250 | 4,677 ms | 19,472 ms | 0,24× |
| 1.000 ciclos Range/clone/StaticRange | 1.000 | 4,905 ms | 19,406 ms | 0,25× |
| 100 conjuntos de setters/selecciones | 250 | 12,072 ms | 2,285 ms | 5,28× |
| 100 conjuntos de setters/selecciones | 1.000 | 72,225 ms | 2,246 ms | 32,16× |

Las consultas de puntos quedan entre 1,61× y 1,84×. Stringificar una selección
completa mide 66,786/0,382 ms en 250 filas y 1.481,526/1,443 ms en 1.000 filas.
Son cargas sintéticas; no se extrapolan a una suite completa. No se ocultan
las lecturas y construcciones aproximadamente cuatro veces más lentas, ni se
declara alcanzado el objetivo integral de rendimiento.
