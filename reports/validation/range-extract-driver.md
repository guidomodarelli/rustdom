# Control de extractContents en Rust

La pila de contenidos se comparte entre cloneContents y extractContents.
Rust ordena la creación de fragmentos y clones parciales, las modificaciones
de CharacterData y el movimiento de los nodos contenidos. El punto de colapso
final se captura antes de los efectos y se aplica solo al Range raíz; el caso
de un solo CharacterData conserva el ajuste producido por replaceData.

Las longitudes del primer extremo se consultan nuevamente después del append,
en la misma etapa del driver anterior. La entrega de efectos conserva factories,
cloningSteps, appendChild, replaceData y setters de rangos vivos. Las raíces
JavaScript permanecen en el wrapper durante la operación y se limpian en finally.

NativeRangeClone mantiene sus exports y protocolos. NativeRangeExtract añade
su propio controlador, instrucciones y contadores rangeExtracts, incluidos
en los controles de finalización. No hay ownership de nodos o árboles en la
pila Rust; complete/cancel liberan sus buffers.

Pasaron los **7 tests del núcleo compartido** y Clippy. Los **13 contratos Node**
de clonación/extracción/contenidos cubren profundidad, identidades, movimientos,
colapso, callbacks, protocolo, clases incorrectas y GC. El control de extracción
libera 601 controladores en cinco lotes de éxitos y errores; no sobreviven
documentos, ventanas, rangos ni fragmentos observados. El control retenido
demuestra primero que el árbol y el estado originales pueden liberarse mientras
el controlador sigue vivo. Son pruebas finitas, no memoria pico ni garantía universal.

El [Memcheck de Range](../memory/2026-09-12T17-44-00Z-range-extract-valgrind.log)
pasó **47 tests**, con cero errores y cero pérdidas definitivas o indirectas.
Los 48 bytes posibles y 544 alcanzables de std/libtest permanecen visibles,
sin supresión. La suite Rust completa pasó **115 tests**.

La validación completa pasó **115 Rust, 317 Node, 7 Jest, 11 Vitest, 4 VM y
1.784 casos HTML5 comparables**. El
[WPT ejecutable](../compatibility/2026-09-12T17-47-56.780Z-linux-wpt.json)
conserva los 43.708 casos en paridad, con los 1.030 fallos compartidos y el
bootstrap CDATA bloqueado explícitos. No se consideran cobertura completa.

El [estrés de cinco modos](../memory/2026-09-12T17-52-00.090Z-linux-x64.json)
pasó. Rustdom libera 1.500 estados Range, 500 controladores de clonación y
1.000 de extracción; el escenario incluye extracción directa y la utilizada
por surroundContents. Cada modo Vitest libera 1.760 estados Range, 440
clonadores y 880 extractores. Los 6.500 nodos/fragmentos observados en rustdom
y los 3.520 en cada modo Vitest se recolectan, sin documentos ni ventanas
observados supervivientes.

Rustdom registra heap +2,42 MiB y RSS +16,08 MiB tras GC. Estas variaciones
de memoria del proceso no equivalen a memoria pico ni a garantía universal
de ausencia de fugas.

Los controles de extracción en
[Node 24](../memory/2026-09-12T17-51-00Z-range-extract-node24.json) y
[Node 22](../memory/2026-09-12T17-51-00Z-range-extract-node22.json) liberan los
601 controladores de cada corrida, y el
[control de clonación compartida](../memory/2026-09-12T17-51-00Z-range-shared-clone-node24.json)
también pasa. El árbol y el estado originales se recolectan incluso durante
el control que mantiene vivo al operador numérico.

El paquete pasa los 18 gates npm/pnpm en
[Node 24](../distribution/2026-09-12T17-53-25.219Z-linux-x64.json) y
[Node 22](../distribution/2026-09-12T17-56-50.596Z-linux-x64.json), incluidos
los nuevos exports CJS/ESM y los runners instalados. SHA-256 del mismo archivo:
`672dfd1d3111a491308990d09311addd1875b98be23402cbc23f2caa0b94c84d`.

El [benchmark aislado compartido](../benchmarks/2026-09-12T18-02-22.123Z-linux-x64.json)
ejecuta cloneContents y extractContents con los escenarios existentes de
extremos parciales. Se verifican identidades, texto, fuente, colapso y digest
de documento/fragmento; hay 18 muestras por motor y tamaño.

| Operación | Filas | jsdom mediana (ms) | rustdom mediana (ms) | jsdom/rustdom |
|---|---:|---:|---:|---:|
| cloneContents | 250 | 23,234 | 18,609 | 1,25× |
| extractContents | 250 | 18,798 | 5,474 | 3,43× |
| cloneContents | 1.000 | 350,550 | 70,673 | 4,96× |
| extractContents | 1.000 | 340,152 | 20,843 | 16,32× |

Ambos workloads favorecen a rustdom. Son comparaciones entre motores para
estas operaciones completas; no aíslan el efecto del refactor respecto del
checkpoint anterior ni demuestran velocidad global de las suites o todas las APIs.
