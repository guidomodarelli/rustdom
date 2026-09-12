# Geometría compartida de nodos en Rust

Los helpers originales de nodeRoot, nodeLength e isInclusiveAncestor ahora
consultan la topología Rust. isFollowing conserva su superficie interna con
orden estricto de árbol, sin utilizar el orden especial de propietarios Attr.
El comparador de puntos de Range ya tenía su propia ruta nativa; no se presenta
ese helper de compatibilidad como una nueva ruta pública de DOM.

Las raíces simples no cruzan hosts ShadowRoot ni contenido de templates.
getRootNode compuesto conserva el driver que atraviesa hosts. La longitud
mantiene UTF-16 y la exclusión de CDATA del nodeLength del jsdom fijado.

Pasaron **3 tests Rust focales**, Clippy/build y **13 contratos Node** de
geometría, namespaces y árbol. La matriz de helpers reales compara todos los
pares de 23 nodos antes y después de mover/adoptar una rama. También cubre
raíces públicas, hosts desconectados, templates, Attr y entradas nativas inválidas.

La primera matriz detectó una suposición incorrecta sobre inputs vacíos:
nodeRoot(null/undefined) lanza el TypeError de acceso a parent en jsdom. El
puente ahora conserva ese error mediante el accessor original, sin devolver
silenciosamente un sentinel. La repetición completa del foco pasó.

El [Memcheck de operaciones Node](../memory/2026-09-12T18-31-00Z-node-geometry-valgrind.log)
pasó **13 tests**, con cero errores y cero pérdidas definitivas o indirectas.
Los 48 bytes posibles y 544 alcanzables de std/libtest permanecen visibles
sin supresión. La suite Rust completa también pasó sus **118 tests**.

La validación integral pasó **321 contratos Node, 7 tests Jest, 11 Vitest y
4 en pools VM**, además de 1.784 casos HTML5 comparables. El [reporte WPT](../compatibility/2026-09-12T18-36-17.060Z-linux-wpt.json)
conserva 43.708 casos en paridad, con 42.678 aprobados por el estándar y
1.030 fallos compartidos. El bootstrap bloqueado de Range-deleteContents
permanece declarado y no se cuenta como una aprobación.

El [estrés de memoria en cinco modos](../memory/2026-09-12T18-42-00.082Z-linux-x64.json)
pasó. rustdom liberó los 882 documentos, 882 ventanas, 6.500 nodos observados
y 1.500 rangos; cada modo Vitest terminó con cero supervivientes de sus
440 documentos/ventanas, 3.520 nodos y 1.760 rangos. Las consultas adicionales
comprueban raíces de texto conectado, clones desconectados y texto eliminado.
El crecimiento final de rustdom fue 2,45 MiB de heap y 15,37 MiB de RSS;
el reporte conserva contadores nativos y muestras, sin equiparar retención
del allocator con una fuga ni afirmar ausencia absoluta de fugas.

El paquete con SHA-256
`fd717cc2350fa2f30c8165a99c7e7fe0897a1815c863e9c8842ba5c8c857a038`
pasó sus **18 controles** tanto en [Node 24](../distribution/2026-09-12T18-44-00.239Z-linux-x64.json)
como en [Node 22.12](../distribution/2026-09-12T18-46-41.590Z-linux-x64.json).
Son instalaciones npm/pnpm fuera del checkout, con consumidores tipados,
CJS/ESM, Unicode del host, workers, Jest, Vitest y pools VM reales.

## Rendimiento

El [benchmark completo](../benchmarks/2026-09-12T19-02-37.045Z-linux-x64.json)
se ejecutó después de terminar builds, tests, memoria y empaquetado de ambas
tareas locales. Los procesos alternan motores y conservan todas las muestras.
El ratio es tiempo jsdom dividido por tiempo rustdom; mayor que 1 favorece Rust.

| Operación | Tamaño | jsdom ms | rustdom ms | Ratio |
|---|---:|---:|---:|---:|
| Construcción nativa elegible | 25 filas | 9,364 | 8,674 | 1,08× |
| Construcción nativa elegible | 250 filas | 25,882 | 30,766 | 0,84× |
| Construcción nativa elegible | 1.000 filas | 66,058 | 90,247 | 0,73× |
| 1.000 consultas raíz/conectividad, poca profundidad | 250 filas | 0,714 | 1,052 | 0,68× |
| 1.000 consultas raíz/conectividad, cadena profunda | 250 niveles | 15,229 | 5,645 | 2,70× |
| 1.000 consultas raíz/conectividad, poca profundidad | 1.000 filas | 0,652 | 0,987 | 0,66× |
| 1.000 consultas raíz/conectividad, cadena profunda | 1.000 niveles | 59,475 | 24,579 | 2,42× |

Los recorridos profundos mejoran en esta comparación, mientras las consultas
cortas pagan el puente nativo y la construcción grande sigue siendo más lenta.
El contraste es contra jsdom independiente, no una medición causal del cambio
contra el commit anterior. Estas cifras no demuestran una mejora universal ni
cierran el objetivo de rendimiento. La preparación de nodos y las verificaciones
de identidad, conectividad y hashes quedan fuera del tiempo medido.
