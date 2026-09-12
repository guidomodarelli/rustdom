# Comparación nativa de puntos de rango

El helper privado de comparación usa Rust para alinear profundidades, localizar
ancestros comunes y comparar índices de hijos. Reutiliza el árbol y sus índices
invalidables, sin guardar Range ni wrappers. Las raíces distintas producen una
señal nativa que el binding convierte en el diagnóstico interno de jsdom.

Las validaciones de las APIs públicas de Range continúan en sus wrappers y
métodos actuales. El comparador no modifica offsets ni decide su validez respecto
de la longitud del nodo. Attr conserva su raíz propia: ownership no equivale a
parentesco estructural. Los setters y otras operaciones de Range siguen pendientes
de migración completa.

Pasaron formato, Clippy, 68 tests Rust y tres contratos públicos. El
[foco WPT](../compatibility/2026-09-12T07-19-44.470Z-linux-wpt.json) registró
**22.988 casos en paridad y 22.066 aserciones de estándares aprobadas**.

Los 922 fallos compartidos se relacionan con la limitación de `nodeLength` de
jsdom 27.4.0 para CDATA: el helper considera su cantidad de hijos en vez de su
longitud de datos. `dom/common.js` crea rangos sobre los CDATA de `paras[5]` y
algunos setups fallan por offsets válidos según WPT. Eso deriva en 648 fallos
de creación de rangos en compareBoundaryPoints, 62 errores de offset en
comparePoint y 212 en isPointInRange (32 de offset y 180 por rangos no creados).
Las aserciones y fixtures permanecen intactos; se conserva la compatibilidad
con jsdom sin certificar esa conducta como normativa.

La validación completa pasó **68 tests Rust, 248 contratos Node, 7 Jest,
11 Vitest, 4 VM y 1.784 casos HTML5**. El
[informe completo](../compatibility/2026-09-12T07-43-27.338Z-linux-wpt.json)
registra **26.517 casos en paridad y 25.587 aserciones de estándares aprobadas**;
los 930 fallos compartidos incluyen los 922 anteriores y los ocho ya existentes.

El [benchmark público](../benchmarks/2026-09-12T07-46-52.297Z-linux-x64.md)
usa rangos reales preparados antes del reloj. Compara 1.000 pares en ambos
sentidos o ejecuta 1.000 conjuntos de consultas de punto/intersección, con
checksums que distinguen igualdad, orden y pertenencia. Se conservan cuatro
procesos alternados y todas las muestras.

| Carga | Filas | jsdom | rustdom | Ratio |
| --- | ---: | ---: | ---: | ---: |
| Comparación | 250 | 35,990 ms | 2,428 ms | 14,82× |
| Punto/intersección | 250 | 5,175 ms | 4,102 ms | 1,26× |
| Comparación | 1.000 | 163,257 ms | 2,793 ms | 58,45× |
| Punto/intersección | 1.000 | 5,373 ms | 4,491 ms | 1,20× |

La comparación evita el recorrido lineal de nodos siguientes del helper previo.
Los ratios corresponden a estas cargas sintéticas, no a suites completas.

El [estrés](../memory/2026-09-12T07-47-30.530Z-linux-x64.json) pasó en ambos
motores con **1.000 Range, 882 Document/Window y 1.500 nodos comparados**
recolectados. Rustdom registró heap +1,92 MiB y RSS +11,75 MiB. No se agregan
referencias persistentes de Range en Rust; los índices reutilizados se liberan
con sus nodos. El
[Memcheck focal](../memory/2026-09-12T07-49-15Z-boundary-points-valgrind.log)
pasó las tres pruebas nativas sin errores ni pérdidas definitivas/indirectas.
Los 48 bytes posibles y 544 alcanzables del runtime quedan visibles sin
supresiones; esa prueba focal no equivale a un análisis completo de V8.

El [paquete instalado](../distribution/2026-09-12T07-48-37.378Z-linux-x64.json)
pasó los 18 controles con npm y pnpm, incluidos los métodos nativos y las
consultas públicas de Range desde VM. El SHA-256 del archivo es
`d8bfcf19a07ef8f3f50b4f9dc79e6333b3807044cffeb133a44be99161b47203`.
