# Node 24: resultados verificados del runner Linux

[Run 39613158016](https://github.com/guidomodarelli/rustdom/actions/runs/39613158016), Node 24.14.1 y Rust 1.99.1, Ubuntu 22.04, AMD EPYC 7763 y afinidad CPU 0.

Se verificaron los 468 procesos: 208 A/A, 208 A/B y 52 descriptivos contra jsdom. Las trece filas calibraron dentro de ±2% (máximo absoluto 1.378%). A/B quedó dentro del presupuesto +5% en todas las filas (máximo +3.263%). Cada etiqueta conserva 256 muestras por fila de A/A y A/B; la referencia descriptiva tiene 64.

La verificación independiente recalcula medianas y gates, contrasta cada stdout con el índice, comprueba hashes de salida entre etapas/motores, tamaños de warmup, orden de procesos, contadores de la ruta nativa y referencias temporales liberadas. También verifica fuentes del baseline/candidato y el head solicitado. El ZIP descargado coincide con el digest SHA-256 de GitHub.

La aceptación se limita a este host y protocolo. Los fallos locales de Node 24 y los protocolos anteriores permanecen publicados. Junto con la aceptación local de Node 22, completa el control predeclarado de este hito; no demuestra rendimiento universal ni una aceleración global.

La referencia descriptiva conserva costes Rust entre 5.03× y 6.76× los de jsdom en estas filas. Migrar este control no resuelve esa desventaja.

| Tarea | Tamaño | A/A | A/B | Coste Rust/jsdom |
| --- | ---: | ---: | ---: | ---: |
| xml-serialize | 100 | 0.65% | -0.64% | 5.73× |
| xml-inner-serialize | 100 | 0.38% | 0.11% | 6.36× |
| xml-document-serialize | 100 | -0.63% | -2.09% | 5.80× |
| xml-serialize-error | 100 | -1.38% | -1.72% | 6.32× |
| xml-serialize | 1000 | -0.37% | -0.73% | 5.12× |
| xml-inner-serialize | 1000 | -0.16% | 0.02% | 5.65× |
| xml-document-serialize | 1000 | -0.64% | -1.33% | 5.24× |
| xml-serialize-error | 1000 | -0.57% | -1.38% | 5.77× |
| xml-serialize | 1 | 0.09% | -0.61% | 6.76× |
| xml-serialize | 16 | -0.55% | -1.28% | 5.78× |
| xml-serializer-getter-error | 1 | -0.20% | 3.26% | 5.03× |
| xml-serializer-getter-error | 100 | 0.12% | -0.36% | 5.59× |
| xml-serializer-getter-error | 1000 | 0.36% | -0.31% | 5.27× |

Las muestras crudas y la variación por proceso/mitad siguen en los JSON; no se filtraron outliers ni se compensaron filas.

Fuente candidata: `67523bf38c8bfd32286618de24cee952b684f32fd91a322c407f7111cd73be3f`. Fuente de referencia: `993a1efdbd928991028f8831c62ef65fe4612b1797727afda3870c5058a87415`.

El commit de merge temporal de GitHub y el head revisado tienen el mismo árbol; provenance.json registra ambos y los binarios. verify-and-report.cjs reproduce la comprobación sobre los datos archivados:

```sh
node reports/benchmarks/xml-serializer-controller/hosted/39613158016/verify-and-report.cjs \
  reports/benchmarks/xml-serializer-controller/hosted/39613158016 \
  62cf726cc0ed0d1487db9dfa2100a78568638108
```
