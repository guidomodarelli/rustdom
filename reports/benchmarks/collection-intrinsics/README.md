# Factory intrínseco de colecciones

Comparación reproducible del head `b7b1cf2`, el fix y jsdom 27.4.0. Ambos paquetes Rust usan exactamente el addon `7f24a7e9…`; cambia el binding JavaScript.

Ejecutar `node --expose-gc benchmarks/collection-intrinsics.cjs <baseline-root>` en Node 22.12.0 y 24.14.1, con `<baseline-root>/dist` construido desde `b7b1cf2`. Dos procesos por stage en orden balanceado; 3 warmup y 9 muestras medidas por worker: 18 muestras agrupadas por stage/fila. Cada muestra consume 100 lecturas públicas de length/item/namedItem; live incluye invalidación y refresco. Setup, GC, validación, cierre e importación quedan fuera del timer.

`children` y `form.elements` ejercen snapshots genéricos y el factory; `document.forms` usa el query nativo y es control. Se validan identidades, todos los elementos, nombres, contadores de actividad y SHA-256 del resultado después de cada muestra. No mide pico de memoria ni costo de creación del realm al importar.

| Node | Colección | Modo | Tamaño | Antes ms | Después ms | Cambio | jsdom ms |
|---|---|---|---:|---:|---:|---:|---:|
| v24.14.1 | children | live | 100 | 4.382 | 4.548 | 3.80% | 1.603 |
| v24.14.1 | children | live | 1000 | 38.643 | 41.607 | 7.67% | 24.001 |
| v24.14.1 | children | cached | 100 | 2.213 | 2.282 | 3.09% | 0.906 |
| v24.14.1 | children | cached | 1000 | 23.362 | 24.491 | 4.83% | 17.513 |
| v24.14.1 | controls | live | 100 | 76.335 | 78.466 | 2.79% | 3.650 |
| v24.14.1 | controls | live | 1000 | 808.223 | 829.434 | 2.62% | 36.931 |
| v24.14.1 | controls | cached | 100 | 68.230 | 65.250 | -4.37% | 2.304 |
| v24.14.1 | controls | cached | 1000 | 739.657 | 704.488 | -4.75% | 23.000 |
| v24.14.1 | forms | live | 100 | 6.045 | 5.663 | -6.32% | 2.385 |
| v24.14.1 | forms | live | 1000 | 51.470 | 48.411 | -5.94% | 30.851 |
| v24.14.1 | forms | cached | 100 | 2.537 | 2.503 | -1.35% | 0.954 |
| v24.14.1 | forms | cached | 1000 | 31.280 | 28.944 | -7.47% | 20.571 |
| v22.12.0 | children | live | 100 | 5.081 | 4.865 | -4.26% | 1.907 |
| v22.12.0 | children | live | 1000 | 42.022 | 41.268 | -1.80% | 25.900 |
| v22.12.0 | children | cached | 100 | 2.429 | 2.395 | -1.41% | 0.969 |
| v22.12.0 | children | cached | 1000 | 24.647 | 24.758 | 0.45% | 19.749 |
| v22.12.0 | controls | live | 100 | 84.080 | 81.765 | -2.75% | 3.893 |
| v22.12.0 | controls | live | 1000 | 880.232 | 884.447 | 0.48% | 39.362 |
| v22.12.0 | controls | cached | 100 | 67.846 | 67.190 | -0.97% | 1.876 |
| v22.12.0 | controls | cached | 1000 | 745.207 | 756.265 | 1.48% | 24.790 |
| v22.12.0 | forms | live | 100 | 6.185 | 5.765 | -6.78% | 2.329 |
| v22.12.0 | forms | live | 1000 | 50.503 | 50.612 | 0.22% | 29.991 |
| v22.12.0 | forms | cached | 100 | 2.474 | 2.582 | 4.35% | 1.027 |
| v22.12.0 | forms | cached | 1000 | 29.107 | 29.918 | 2.79% | 21.311 |

Un cambio positivo indica mayor duración. Se conservan todas las regresiones y muestras crudas; una medición sintética finita no demuestra una mejora general. Los JSON incluyen hardware, versiones, código medido, artefactos y órdenes de proceso. `manifest.json` registra compresión sin pérdida y SHA-256.
