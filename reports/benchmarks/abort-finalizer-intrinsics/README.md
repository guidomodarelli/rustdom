# Comparación focal de Abort después de capturar intrínsecos

Se ejecutó el harness existente `benchmarks/compare.cjs abort-lifecycle abort-any abort-propagation`, sin cambios, en una ventana coordinada sin otras cargas. Runtime: Node 24.20.0. Baseline: DCE `dce2472a1f093c6d9e4a768ffe454a5c4b2d3348`; candidata: el adapter corregido. Ambos usan el mismo addon `1f5cb1d86c660f6e1681638474c64e45d6de6c84b67919c5cc70be6a1b452f83`.

Cada ejecución alternó procesos jsdom/rustdom y rustdom/jsdom. Se hicieron tres muestras de warmup y nueve medidas por proceso: 18 muestras por motor y caso, con tamaños de 100 y 1000 señales. Los fixtures validan razones, idempotencia, identidad, orden de callbacks y marcado de todos los dependientes antes de observar la señal fuente. Se mide la operación pública, incluido el puente Rust/JavaScript; setup, validación final, cierre de Window y GC quedan fuera del tiempo.

| Operación | Señales | DCE ms | Candidata ms | Cambio rustdom | Cambio control jsdom |
| --- | ---: | ---: | ---: | ---: | ---: |
| abort-lifecycle | 100 | 1.843 | 1.984 | +7.7% | +10.6% |
| abort-any | 100 | 0.627 | 0.639 | +2.1% | +9.9% |
| abort-propagation | 100 | 1.560 | 1.648 | +5.7% | +13.0% |
| abort-lifecycle | 1000 | 15.894 | 16.580 | +4.3% | +12.4% |
| abort-any | 1000 | 4.429 | 4.876 | +10.1% | +10.5% |
| abort-propagation | 1000 | 14.390 | 14.631 | +1.7% | +8.7% |

Las seis medianas brutas de rustdom aumentaron entre 1,7% y 10,1%; el control independiente jsdom también aumentó entre 8,7% y 13,0%. Esta corrida no permite atribuir los aumentos al cambio del adapter ni demostrar equivalencia estadística. No se afirma una mejora de rendimiento. En estos microbenchmarks el runtime híbrido sigue siendo más lento que jsdom.

`comparison.json` conserva los valores completos; `runtime-identity.json` distingue los hashes de los adapters y el addon compartido. Los dos reportes completos, muestras crudas, p95, hardware, versiones y resultados de validación están en `../2026-09-15T19-55-10.305Z-linux-x64.json` y `../2026-09-15T19-55-39.998Z-linux-x64.json`. Se conservan los logs de ambas versiones. Los metadatos de fuentes del harness describen el checkout de medición; el override `RUSTDOM_BENCHMARK_PACKAGE` y los hashes identifican el runtime DCE histórico realmente cargado.

Los tiempos no incluyen inicio del módulo ni representan tiempo total de suites o memoria pico. Los ensayos son finitos, sintéticos y de una máquina; no equivalen a una certificación completa de rendimiento o compatibilidad.
