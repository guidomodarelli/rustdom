# Planificación de deleteContents en Rust

Rust captura los extremos originales, distingue el caso CharacterData,
selecciona nodos completos y calcula el punto de colapso antes de ejecutar
mutaciones. El recorrido omite descendientes cubiertos por una eliminación
externa. La navegación iterativa se comparte con el stringifier.

El binding entrega los pasos a los hooks actuales: texto inicial, nodos en
orden, texto final y actualización de extremos. Los padres se consultan al
retirar cada nodo, porque un callback síncrono puede haberlo movido. Los planes
no almacenan referencias persistentes ni aplican mutaciones por sí mismos.

Pasaron 90 tests Rust y los contratos focales con 196 combinaciones de
extremos, UTF-16, MutationObserver, clones de rangos, XML/CDATA y errores de
handles. Un callback real de error CSS mueve un nodo a otro padre y agrega
otro antes del contenedor; se conserva el mismo resultado que jsdom.

## Fixture WPT bloqueado

El [intento original](../compatibility/2026-09-12T11-54-24.646Z-linux-wpt.json)
no pudo completar el bootstrap de `Range-deleteContents.html`. El fixture
clona el documento del iframe, que contiene CDATA adoptada desde un documento
XML. El helper de clonación de jsdom llama `document.createCDATASection`
usando el owner HTML y lanza NotSupportedError; después falta la raíz del
documento de referencia y las aserciones quedan pendientes.

La [reproducción independiente](../compatibility/2026-09-12T11-59-00Z-cdata-html-clone.json)
confirma el mismo fallo en jsdom y rustdom sin llamar a deleteContents.
También se conserva como test de contrato. No se modifica el fixture, el
tipo de documento ni la implementación de CDATA para hacer pasar el arnés.

`blockedSuites` deja el caso visible y reproducible con
`npm run test:wpt -- range-deletion`; la ejecución normal informa el bloqueo
y `complete: false`, y no cuenta ninguna aserción de ese archivo como
aprobada. Los tests directos de eliminación ejercen la operación real.
El bloqueo permanece como cobertura pendiente del objetivo integral.

El [Memcheck conjunto de Range](../memory/2026-09-12T12-08-23Z-range-deletion-valgrind.log)
pasó 22 tests, incluidos los planes de eliminación: cero errores y cero bytes
perdidos definitiva o indirectamente. Los 48 bytes posibles y 544 alcanzables
de std/libtest se conservan sin supresiones. La cobertura del ejecutable Rust
se complementa con el addon real y sus pruebas de GC; no se afirma ausencia
absoluta de todas las fugas posibles.

El [estrés de cinco modos](../memory/2026-09-12T12-12-20.281Z-linux-x64.json)
pasó, incluyendo observación de párrafos y Text retirados por deleteContents.
Rustdom registra 2.500 nodos comparados/retirados y 1.000 rangos, todos
recolectados, además de 882 Document/Window. Sus deltas posteriores a GC
fueron heap +2,12 MiB y RSS +17,51 MiB. Vitest normal/VM liberan sus 440
Document/Window y 1.320 rangos por modo. Los datos permanecen completos en
el informe; RSS no se interpreta como memoria pico ni como prueba aislada
de una fuga.

La validación general pasó formato, Clippy, **90 tests Rust, 282 contratos
Node, 7 Jest, 11 Vitest, 4 VM y 1.784 casos comparables HTML5**. El
[informe WPT final](../compatibility/2026-09-12T12-10-44.450Z-linux-wpt.json)
mantiene los 43.708 casos ejecutables en paridad, 42.678 aprobados contra el
estándar y 1.030 fallos compartidos. Reporta `complete: false` y el bootstrap
de eliminación bloqueado por separado, sin contarlo como caso aprobado.

El paquete pasó 18 controles con [Node 24](../distribution/2026-09-12T12-11-31.652Z-linux-x64.json)
y 18 con [Node 22.12](../distribution/2026-09-12T12-13-48.199Z-linux-x64.json),
incluidas instalaciones npm/pnpm, tipos, CJS/ESM, workers y runners reales.
Los consumidores ejercen el plan nativo sin mutación y deleteContents real
en una VM, con ajustes de otro Range y conservación de StaticRange.
SHA-256 del artefacto:
`814886f68e747b28762a719d072a7da3223c77b59c402a50ac17047de5b11030`.

El [benchmark aislado](../benchmarks/2026-09-12T12-20-49.286Z-linux-x64.md)
elimina extremos parciales y todas las filas intermedias, con preparación y
verificación fuera del reloj. Se comprueban las dos filas restantes, texto,
colapso y hash completo del DOM en ambos motores:

| Operación | Filas | jsdom | rustdom | Ratio |
| --- | ---: | ---: | ---: | ---: |
| deleteContents | 250 | 187,454 ms | 4,715 ms | 39,75× |
| deleteContents | 1.000 | 4.205,287 ms | 18,420 ms | 228,30× |
| Stringifier compartiendo recorrido | 250 | 63,803 ms | 0,386 ms | 165,13× |
| Stringifier compartiendo recorrido | 1.000 | 1.404,926 ms | 1,394 ms | 1.007,49× |

El [primer intento](../benchmarks/2026-09-12-range-deletion-fixture-failure.md)
detectó una expectativa genérica de filas incompatible con esta carga; se
corrigió el arnés sin modificar el DOM. Los resultados finales conservan
todas las muestras y no se extrapolan al tiempo de una suite completa.
