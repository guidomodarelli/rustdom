# Tiempo completo de Jest y Vitest: ensayo completo

El ensayo único de la receta publicada en `a10e7a04` completó 342 invocaciones
de CLI: 54 warmups y 288 mediciones. Las doce filas pasan; A/A calibra en ambos
Node. Los verificadores congelados Linux Node 22.12.0/24.14.1 y Windows Node
24.14.1 coinciden. El recálculo independiente Python también coincide en las
doce filas, tanto en Windows como Linux. No hubo reintentos ni exclusiones.

Los 10.602 resultados de tests son ejecuciones repetidas dentro de esos CLIs,
no casos únicos ni réplicas adicionales. Cada CLI usa las suites calificadas:
Jest 23, Vitest 34 y Vitest VM 36 tests, con los probes nativos y teardown real.

## Resultados

Razón de medianas de doce tiempos por etiqueta, con warmups excluidos.
AB identifica A/C en el índice: C permanece en el paquete físico B. Los
límites son ±5% A/A y hasta +5% A/C, condicionado a su A/A. Las decisiones
usan productos enteros exactos; los porcentajes de esta tabla son redondeados.

| Node | Fase | Runner | Baseline (ms) | Comparado (ms) | Cambio | Pasa |
| --- | --- | --- | ---: | ---: | ---: | --- |
| v22.12.0 | A/A | jest | 4002.640 | 3957.851 | -1.119% | sí |
| v22.12.0 | A/A | vitest | 1566.075 | 1522.610 | -2.775% | sí |
| v22.12.0 | A/A | vitest-vm | 1732.144 | 1716.677 | -0.893% | sí |
| v22.12.0 | A/C | jest | 4015.446 | 4114.355 | +2.463% | sí |
| v22.12.0 | A/C | vitest | 1651.928 | 1631.838 | -1.216% | sí |
| v22.12.0 | A/C | vitest-vm | 1868.736 | 1834.202 | -1.848% | sí |
| v24.14.1 | A/A | jest | 3738.121 | 3685.347 | -1.412% | sí |
| v24.14.1 | A/A | vitest | 1291.331 | 1295.647 | +0.334% | sí |
| v24.14.1 | A/A | vitest-vm | 1516.463 | 1523.434 | +0.460% | sí |
| v24.14.1 | A/C | jest | 3700.053 | 3742.510 | +1.147% | sí |
| v24.14.1 | A/C | vitest | 1267.770 | 1230.740 | -2.921% | sí |
| v24.14.1 | A/C | vitest-vm | 1434.356 | 1435.875 | +0.106% | sí |

## Host, inputs y alcance

Host WSL2/Linux 6.6.87.2-microsoft-standard-WSL2, Intel Core i7-1360P,
16 CPU lógicas expuestas y 8.095.191.040 bytes de memoria reportada a Node.
GNU Time conserva su salida de versión UNKNOWN y el paquete dpkg1.9-0.1build2.
Hashes, versiones, CPU y configuración completa están en `machine-and-tools.json`.
No se cambiaron JIT, afinidad, energía o GC durante el ensayo. No se ejecutaron
builds, otras suites, compresión ni reviews locales durante la captura; el host
Windows y la actividad ajena no están completamente controlados.

Los addons y dependencias son los oficiales de la preparación calificada, sin
rebuild o npm install. Se comprobaron antes/después los inputs de ambos Node,
los ejecutables y las 79 fuentes publicadas. El índice de preparación mantiene
la fijación independiente `cc7d36f1e702c27935c8ed49afe7da280ca760adcb17be45a2db6bc735b845fc`.

La métrica incluye GNU Time, lanzamiento de Node, carga, suites, teardown y espera
del proceso. Excluye bookkeeping y validación. El ensayo compara el baseline y
el candidato ownership del motor híbrido; no compara contra jsdom puro ni prueba
un DOM íntegramente Rust. No mide por separado el costo del puente N-API.

Los puntos estimados describen estas suites y este host. No se calcularon
intervalos de confianza ni significancia; no se afirma una mejora general a
partir de variaciones pequeñas. Los warmups calientan caches de OS, no comparten
un isolate V8 entre CLIs. No se acredita cobertura de aplicaciones arbitrarias.

## Evidencia y límites

`observations.json` conserva las 342 duraciones crudas en nanosegundos, sus
selecciones y recursos; `summary.json` contiene todas las muestras de cada fila.
`resources.json` presenta RSS descriptivo por celda, sin presupuesto de memoria.
El archivo completo, logs, probes, snapshots y replay están en
`reports/validation/native-class-ownership/runner-suite-timing-study/`.

Este entregable satisface la medición de tiempo completo para estas suites.
No cambia los microbenchmarks rechazados: seis controles jsdom siguen sin
calibrar en el ensayo anterior. Ownership continúa abierto; no hay merge, tag
ni nuevo crédito de migración Rust por esta evidencia. La receta original
`runner-suite-timing/PROTOCOL.md` conserva su estado histórico previo a medir.
