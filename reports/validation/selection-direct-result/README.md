# Selection: devolución directa de resultados, validación

La candidata elimina el callback receptor y el array vacío por lectura en el
adapter JavaScript. `selectionOperationResult` devuelve el valor original con
un lifetime ligado a `&Env`; el generador N-API mantiene ese Env hasta convertir
el retorno. No hay nuevos bloques unsafe ni referencias persistentes.
El controlador compartido conserva la API con callback y su retorno undefined.

Base Git: `66865bcb991b77b82ecb979feddc100366b502c9` con Selection local.
Baseline: fuentes `2b6eb990f1b0f7dfc339ee26e7cef47868fcf79a4a5f4041cd59c6d5985d80de`,
addon `792e1c2dafb6eac8d70232daf892d3b62e3e968689d6a24e1ade08fde372c0b2`.
Candidata: fuentes `ce6cb4818a88d97b1ead597892c6f987e255f5f7b8524f153e11f338980916b3`,
addon `b3b47e8ff6bb04a13f4ccbeac2d40cff17100920437d98b6a36e3c4b786c7df4`.

## Contratos y distribución

La validación general pasó formato, Clippy, 251 tests Rust, build, 2.162 contratos Node y los
runners reales, HTML5 y WPT. WPT conserva 216 fixtures y 82.304 resultados en
paridad con jsdom, con 81.104 aprobados de estándar y 1.200 fallos compartidos.
Las exclusiones previas siguen vigentes. `validation.json` y `full.log` guardan
la ejecución; `wpt-summary.json` identifica el archivo comprimido sin pérdida.

Los 27 contratos focales pasaron en Node 22 y 24: Selection diferencial,
identidad de retornos nativos, compatibilidad del callback previo, errores
primitivos, reentrada y liberación del registro de constructores en Workers.
Los 14 escenarios de GC de Selection pasaron en ambos Node. El estrés nativo
pasó 1.000 ciclos / 8.000 llamadas, con Window, Document, Selection y Range
observados en cero, un estado creado y liberado, active y cleanupErrors en cero.

Paquete `rustdom-rustdom-0.1.0-alpha.0-linux-x64-glibc-2026-09-15T21-06-31.543Z.tgz`,
SHA-256 `8b9648e466682e3184117e53da2c336dd8a51182d6fb421c57f676c503f19f76`.
Pasaron 20 gates por versión: 40 entre Node 22.12.0 y 24.20.0 con npm 11.19.0,
instalación npm y pnpm aislada, tipos, CJS/ESM, assets, Workers y runners.
Reportes de distribución `2026-09-15T21-06-33.938Z-linux-x64.json` y
`2026-09-15T21-07-48.230Z-linux-x64.json` en `reports/distribution/`.

## Memcheck del addon cargado

Se ejecutó el helper real en baseline y candidata con 1.000 ciclos, Node24.20,
`--jitless --expose-gc`, reporte completo de leaks y error-exitcode. Sólo se
mantuvieron las dos supresiones existentes de escaneo conservador cppgc; no se
suprimieron pérdidas ni accesos inválidos. Logs crudos con prefijo
`reports/memory/2026-09-15T21-10-23.000Z-selection-return-`.

Ambos resultados fueron idénticos: 24 B definitivos, 0 B indirectos, 48.839 B
posiblemente perdidos y 18.177 B alcanzables. El único contexto de error fue
la asignación OpenSSL de Node previamente reproducida sin addon; no se declara
un gate Memcheck limpio. No aparecieron contextos adicionales de acceso inválido
o pérdida definitiva/indirecta con la candidata. Todos los propietarios
observados se recolectaron. Estos escenarios finitos no prueban ausencia
universal de fugas ni miden memoria pico.

## Rendimiento

La primera comparación AB usa los reportes `2026-09-15T21-16-37.134Z-linux-x64.json`
y `2026-09-15T21-17-25.831Z-linux-x64.json`. Mostró cambios pequeños y mixtos,
con deriva también en el control jsdom. Se ejecutó una segunda comparación BA
para equilibrar el orden; las conclusiones están a continuación. No se afirma
una mejora general de rendimiento a partir de la primera ejecución.

## Comparación equilibrada AB y BA

La segunda ejecución invirtió el orden de las versiones. En total hay cuatro
procesos por motor y variante, con 36 muestras por caso agrupadas dentro de
esos procesos. Los resultados descriptivos y las medianas por proceso están
en `reports/benchmarks/selection-direct-result/comparison.json`.

| Operación, 1000 repeticiones | Baseline mediana ms | Candidata mediana ms | Cambio observado |
|---|---:|---:|---:|
| selection-read | 7.448 | 6.854 | -8% |
| selection-associate | 15.731 | 15.31 | -2.7% |
| selection-extend | 21.845 | 21.68 | -0.8% |
| selection-contains | 10.694 | 10.303 | -3.7% |
| selection-stringify | 1.226 | 1.128 | -8% |

Las medianas de lectura y stringificación bajaron aproximadamente 8% al
agrupar las muestras; ambas bajaron en los dos órdenes. Las demás diferencias
fueron menores y algunas cambian de signo según el bloque. En extend, el cambio
también aparece en jsdom: no hay evidencia de una mejora específica del cambio.

Los intervalos observados se superponen y las muestras de un proceso no son
ensayos independientes. No se afirma significación estadística ni una mejora
general. La candidata sigue siendo más lenta que jsdom en estos casos; reduce
parte del costo del puente y mantiene los contratos comprobados.

Se conserva la candidata por quitar el callback y las asignaciones por lectura
con el beneficio acotado observado, sin cambiar el controlador DOM ni quitar la
API previa. No se declara alcanzado el objetivo de alto rendimiento.

El baseline local puede reconstruirse desde el commit 66865bc y el overlay
`reports/benchmarks/selection-direct-result/baseline-overlay.tar.gz`: 71 archivos
y lockfiles con SHA y roundtrip verificados en `baseline-overlay.json`. La
reconstrucción no depende de conservar los checkouts temporales.
