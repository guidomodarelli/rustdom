# Benchmarks ordinarios de la integración

Se ejecutó `benchmarks/compare.cjs range-state-lifecycle-1000 range-control-1000`
en ambos SDK fijados, contra jsdom 27.4.0 independiente. Cada fila conserva
18 muestras por motor, dos procesos/órdenes por motor y tres warmups por
proceso/carga. Las duraciones de warmup no se retienen en este harness;
se conservan su cantidad y metodología. Hay 144 duraciones medidas por SDK,
288 en total. JSON y Markdown originales están en `node22/` y `node24/`.

| Node | Operación / tamaño | jsdom mediana ms | Rust mediana ms |
|---|---|---:|---:|
| 22 | lifecycle / 250 | 6,032 | 17,831 |
| 22 | lifecycle / 1000 | 6,630 | 16,400 |
| 22 | control / 250 | 2,071 | 3,760 |
| 22 | control / 1000 | 1,717 | 3,156 |
| 24 | lifecycle / 250 | 5,659 | 14,264 |
| 24 | lifecycle / 1000 | 5,660 | 15,033 |
| 24 | control / 250 | 1,890 | 3,427 |
| 24 | control / 1000 | 1,832 | 3,509 |

Las ocho medianas Rust fueron mayores. Es una comparación descriptiva entre
el runtime híbrido actual y jsdom; no mide la ganancia de este parche frente
a la implementación Rust anterior, ni permite aceptar rendimiento. No se
repitieron los estudios consumidos ni se cambiaron sus presupuestos.

Los reportes conservan máquina, SDK, versiones, fuentes y cambios Git reales,
flags, metodología, resultados públicos, muestras y endpoints de memoria.
El binario local es a6a21c3c, distinto del a277 sellado; los 344 inputs del
candidato sí coinciden con producción. La evidencia de ejecución completa
está en `reports/validation/range-native-production/20261027/`.
`performanceAccepted=null`, `gateReevaluated=false`.
