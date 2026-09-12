# Contexto de Range.createContextualFragment en Rust

Rust selecciona el elemento de contexto y decide cuándo hace falta el body
sintético. Conserva los casos Document/Fragment, Element, Text/Comment y los
errores del resto de tipos. El modo HTML y la comparación exacta de localName
y namespace evitan confundir HTML con XML o con elementos de otro namespace.
Los datos pueden estar representados como UTF-8 o unidades UTF-16.

El bridge crea el mismo Error del host para tipos de inicio inválidos; la
creación del body y parseFragment mantienen sus implementaciones actuales.
No se mutan rangos ni se guardan referencias adicionales al elegir el contexto.

Pasaron **3 tests Rust focales**, Clippy, build y **4 contratos Node**. Incluyen
105 combinaciones de contexto/markup HTML, SVG, tablas, select, templates,
ShadowRoot y nodos desconectados; namespaces XML, tipos inválidos, scripts
inertes antes de insertar, adopción entre documentos y validación de handles
sin consumir reservas ni modificar estado.

El [Memcheck de Range](../memory/2026-09-12T15-29-00Z-range-context-valgrind.log)
pasó **40 tests**, con cero errores y cero pérdidas definitivas o indirectas.
Los 48 bytes posibles y 544 alcanzables de std/libtest permanecen visibles
sin supresión. Esta consulta devuelve solo un ID y no retiene nodos, estados
de Range ni documentos. Los controles de ciclo de vida se registran aparte.

La validación completa pasó **108 tests Rust, 309 contratos Node, 7 Jest,
11 Vitest, 4 VM y 1.784 casos HTML5 comparables**. El
[WPT ejecutable](../compatibility/2026-09-12T15-38-18.797Z-linux-wpt.json)
conserva 43.708 casos en paridad, con los 1.030 fallos compartidos y el
bootstrap CDATA bloqueado separados de la cobertura aprobada.

El [estrés de cinco modos](../memory/2026-09-12T15-42-20.489Z-linux-x64.json)
libera todos los nodos y fragmentos observados: 6.500 en rustdom y 3.520 en
cada modo Vitest. Rustdom libera los 3.500 estados nativos creados y cada
modo Vitest libera 3.520. No sobreviven los rangos, documentos ni ventanas
observados. Tras GC, rustdom registra heap +2,44 MiB y RSS +17,21 MiB;
estas medidas no son memoria pico ni una garantía universal de ausencia de fugas.

La distribución pasa 18 gates npm/pnpm en
[Node 24](../distribution/2026-09-12T15-43-25.023Z-linux-x64.json) y en
[Node 22](../distribution/2026-09-12T15-45-52.135Z-linux-x64.json). Los consumidores
CommonJS/ESM ejercen el nuevo contexto y el fragmento resultante, además de
workers y runners. Ambos usan el mismo archivo SHA-256
`9622987fd1b59193eb9b2bae90c907ce054636c79a839ff9f225d43ecc3fbc51`.

El [benchmark aislado](../benchmarks/2026-09-12T15-50-28.235Z-linux-x64.json)
prepara el markup y un Range sobre tbody fuera del timer. Mide la llamada
pública completa, verifica filas/texto/ownerDocument, extremos intactos y
uso real del parser HTML nativo. El digest incluye documento fuente y
fragmento serializado; coincide entre motores. Se conservan 18 muestras
por motor y tamaño.

| Filas | jsdom mediana (ms) | rustdom mediana (ms) | jsdom/rustdom |
|---|---:|---:|---:|
| 250 | 22,670 | 21,926 | 1,03× |
| 1.000 | 72,928 | 80,045 | 0,91× |

El caso pequeño queda cerca de paridad, sin una mejora clara; en 1.000 filas
rustdom tarda aproximadamente un 10% más. La medición incluye parsing y
creación de nodos, y no aísla el costo del selector de contexto frente al
checkpoint anterior. El rendimiento integral sigue abierto.
