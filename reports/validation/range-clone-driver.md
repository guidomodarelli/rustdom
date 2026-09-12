# Control de cloneContents en Rust

Rust controla la selección, el orden de efectos y la pila de subclonaciones
de Range.cloneContents. El puente ejecuta las factories, el helper clone,
substringData y appendChild existentes después de que termina cada préstamo
Rust. Las longitudes que pueden cambiar por callbacks se consultan en la
misma etapa que antes; el controlador conserva los IDs seleccionados.

La pila contiene números y snapshots de extremos, sin referencias a V8 ni
ownership del árbol. El wrapper nativo mantiene raíces JavaScript mediante
un Symbol durante la operación síncrona; las libera en finally, tanto al
terminar como ante errores. Complete/cancel liberan inmediatamente los
buffers de frames. Los subrangos internos del control ahora son frames Rust;
la copia concreta de nodos y sus cloningSteps permanecen en el helper existente.

Los nuevos contadores rangeClones permiten comprobar recolección de los
controladores, incluso cuando no se observan directamente con WeakRef.

Pasaron **4 tests Rust focales**, Clippy/build y **19 contratos existentes** de
contenidos, contexto, inserción y surround. Las pruebas nuevas de protocolo,
clonación parcial a 180 niveles, clases/entradas inválidas y GC pasaron junto
con los contratos de contenido (**9 tests Node**).

El control de GC mantiene un controlador mientras exige liberar su árbol y
estado originales. Después lo libera y ejecuta cinco lotes con 100 clones
públicos y 20 rechazos por doctype cada uno. Los 601 controladores terminan
liberados y no sobreviven documentos, ventanas, rangos ni fragmentos observados.
Son controles finitos de retención, no una garantía universal ni memoria pico.

El [Memcheck nativo](../memory/2026-09-12T16-44-00Z-range-clone-valgrind.log)
pasó **44 tests Range**, con cero errores y cero pérdidas definitivas o
indirectas. Los 48 bytes posibles y 544 alcanzables de std/libtest siguen
visibles sin supresión. La suite Rust completa también pasó sus 112 tests.

La validación completa pasó **112 Rust, 313 Node, 7 Jest, 11 Vitest, 4 VM y
1.784 casos HTML5 comparables**. El
[WPT ejecutable](../compatibility/2026-09-12T16-51-24.535Z-linux-wpt.json)
conserva los 43.708 casos en paridad, incluidos los fallos compartidos ya
declarados; el bootstrap CDATA bloqueado sigue separado y la cobertura no
se presenta como completa.

El [estrés de cinco modos](../memory/2026-09-12T17-00-14.689Z-linux-x64.json)
pasó con los nuevos contadores. Rustdom libera los 2.500 estados Range y
500 controladores creados, junto con los 6.500 nodos/fragmentos observados.
Cada modo Vitest libera 2.640 estados Range y 440 controladores, con 3.520
nodos/fragmentos observados. No sobreviven documentos, ventanas ni rangos.
El escenario equivalente anterior creaba 3.500 estados Range en rustdom;
la pila nativa reemplaza los subrangos internos de clonación.

Tras GC, rustdom registra heap +2,44 MiB y RSS +16,65 MiB; son medidas de
retención del proceso y no permiten inferir memoria pico ni una mejora
causal de RSS a partir de variaciones pequeñas entre corridas.

La [primera instalación del paquete](../distribution/2026-09-12T17-01-35.981Z-linux-x64.json)
detectó que el manifiesto explícito de runtime omitía range-clone-driver.cjs
y range-errors.cjs, aunque ambos estaban generados por el build. Se agregaron
a esa lista y se conserva el fallo original. No fue un error de los algoritmos
DOM ni se sustituyeron sus imports para ocultarlo.

El archivo corregido pasa 18 gates npm/pnpm en
[Node 24](../distribution/2026-09-12T17-04-39.539Z-linux-x64.json) y en
[Node 22](../distribution/2026-09-12T17-06-43.876Z-linux-x64.json). Incluyen
consumidores CommonJS/ESM que ejecutan las nuevas instrucciones y cancelación,
además de workers, Jest y Vitest. SHA-256:
`d39af79de1895294a1728ddce6027870e3f7aa12d09ca9e4bc17ecb1db01631c`.

Los controles completos de GC en
[Node 24](../memory/2026-09-12T17-00-00Z-range-clone-node24.json) y
[Node 22](../memory/2026-09-12T17-00-00Z-range-clone-node22.json) liberan los
601 controladores y todos los resultados observados. En el control retenido,
el árbol y el estado originales se recolectan mientras el controlador sigue
vivo, demostrando que sus números no poseen esas instancias.

El [benchmark aislado](../benchmarks/2026-09-12T17-10-50.331Z-linux-x64.json)
reutiliza el escenario público de cloneContents con extremos parciales,
comprobación del fragmento, fuente intacta y digest de ambos árboles. Se
conservan 18 muestras por motor y tamaño, con cuatro procesos alternados.

| Filas | jsdom mediana (ms) | rustdom mediana (ms) | jsdom/rustdom |
|---|---:|---:|---:|
| 250 | 26,250 | 21,081 | 1,25× |
| 1.000 | 381,031 | 76,549 | 4,98× |

Este workload favorece a rustdom. Las cifras comparan motores completos en
ese escenario y no aíslan el efecto del nuevo controlador respecto del
checkpoint anterior. No equivalen a velocidad global de Jest/Vitest ni a
una afirmación de que todas las operaciones sean más rápidas.
