# Contratos nativos Range por ESM

El subpath `@rustdom/rustdom/native` declaraba en TypeScript nombres Range que su entrypoint ESM no exportaba. El consumidor instalado compilaba y después fallaba durante la carga de `NativeRange`. El [reporte previo al fix](../distribution/2026-09-12T13-42-42.989Z-linux-x64.json) conserva el fallo de Node, junto con los gates previos de npm que sí pasaban.

`src/native.mjs` ahora reexporta los mismos objetos nativos `NativeRange`, `RangePointRelation`, `RangeBoundaryMode`, `RangeBoundaryAction`, `RangeComparison`, `RangeDeletionKind` y `RangeSurroundStatus`. Las interfaces de TypeScript permanecen tipos. No se duplican clases, valores de enums ni algoritmos DOM. Los aliases conservan la identidad del export por defecto.

El consumidor ESM instalado usa los siete nombres en operaciones reales: configuración y copia de extremos, extracción de texto, relación con puntos, planes de selección y borrado, comparación, preflight válido e inválido de surround, ausencia de mutación por las consultas y liberación de handles. No se comprueba el texto de los fuentes ni se usa un test que solo importe el módulo.

La [validación completa](native-esm/latest.json) pasa formato, Clippy, 96 tests Rust, 293 contratos Node, 7 Jest, 11 Vitest, 4 VM y 1.784 casos comparables HTML5. Los [43.708 casos WPT ejecutables](../compatibility/2026-09-12T13-46-44.488Z-linux-wpt.json) mantienen la paridad; 1.030 fallos compartidos y el bootstrap bloqueado siguen declarados. Esto no demuestra compatibilidad universal ni finaliza la migración.

La [prueba específica de memoria](../memory/2026-09-12T13-47-00Z-native-esm-ranges.json) mantiene ambos imports ESM cargados durante cinco lotes de 200 pares de estados/copias. Los 2.001 estados nativos creados, incluyendo un control retenido, terminan destruidos; no sobreviven las referencias débiles de los cinco árboles. Cada lote libera primero sus handles y luego exige dos muestras claras de GC con contadores nativos en el baseline. El control deliberadamente retenido impide aceptar el endpoint hasta soltarlo. También corre en la suite Node como regresión permanente. Los aliases exportados no crean instancias ni raíces que posean nodos; las mediciones son finitas y no prueban ausencia absoluta de fugas.

Los [fingerprints](native-esm/inputs.json) identifican código, addon y lockfiles. Los logs están separados de los reportes genéricos para conservar el historial del fix sin sobrescribir la validación de fases posteriores.


El [benchmark aislado](../benchmarks/2026-09-12T13-54-49.137Z-linux-x64.json) volvió a ejecutar la operación pública completa con 18 muestras por motor y tamaño, en cuatro procesos y con orden alternado. Los hashes de salida coinciden entre motores. No había tests, builds, paquetes ni comprobaciones de memoria concurrentes.

| Filas | jsdom mediana (ms) | rustdom mediana (ms) | jsdom/rustdom |
|---|---:|---:|---:|
| 250 | 5,094 | 9,204 | 0,55× |
| 1.000 | 18,963 | 35,725 | 0,53× |

Rustdom sigue aproximadamente 1,8–1,9 veces más lento que jsdom en este escenario. La medición excluye carga de módulos y no pretende atribuir una mejora o regresión a las reexportaciones ESM, que no cambian el algoritmo ni el puente de la operación. Se conserva la limitación de rendimiento observada antes del fix.


El mismo paquete corregido pasó los 18 gates de npm/pnpm en [Node 24.14.1](../distribution/2026-09-12T13-55-51.137Z-linux-x64.json) y [Node 22.12.0](../distribution/2026-09-12T13-57-07.000Z-linux-x64.json): instalación aislada, tipos, CommonJS, Unicode, ESM/VM, workers, Jest y ambas configuraciones Vitest. SHA-256 del archivo: 34a4b429f19fedb7b16ea4693b5cc78d4fe51dfce338093e5ef9a3261fbc220a.

La [repetición del GC ESM en Node 22](../memory/2026-09-12T13-55-00Z-native-esm-node22-ranges.json) también liberó los 2.001 estados y los cinco árboles observados, detectando primero el control retenido. El cambio no modifica código Rust ni ownership del addon; el análisis se concentra en aliases de módulo e instancias reales de V8.
