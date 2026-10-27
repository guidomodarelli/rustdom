# Resultado íntegro de ownership-owner-batch-serial-v1

**Rendimiento rechazado: cumplen 42/64 criterios.** Hay 19 controles jsdom y 3 comparaciones RustAB de Node 24 fuera del criterio. Captura e integridad completas no equivalen a aceptación del rendimiento.

Run [40234774968](https://github.com/guidomodarelli/rustdom/actions/runs/40234774968), intento 1, método `504ebc36b66dd6f36b19fd67bd6d61b3faff3f67`. Ambos jobs terminaron con `success`. El candidato ELF4b52 procede del artifact 12604810857 del CI 40205226009; no se reconstruyó para este estudio. Producción no integra este candidato y sigue híbrida.

Se autenticaron los dos artifacts por ID, run, commit, intento, nombre, tamaño y digest. Los ZIP, tar, checksums originales, API, logs y manifiestos completos están en `transport/`. Los dos lectores actuales Node 22.12.0/24.14.1 reprodujeron el rechazo íntegro y generan tablas byte a byte idénticas. No se ejecutaron scripts archivados ni se recogieron muestras adicionales.

## Alcance y unidades

2048 procesos; 294912 duraciones medidas y 98304 warmup externas; 18432 bloques medidos y 6144 warmup; 24576 Window y 24576 Document separados; 6144 endpoints de cleanup y 6 snapshots parentales. Las 144 duraciones medidas forman UNA media por proceso; cada criterio usa 16 pares de procesos. Las tres rondas internas de warmup no tienen tiempos registrados: no se inventan duraciones.

Intervalos Fieller pareados del 95% con t15=2.131449545559323. Son pointwise por comparación, sin cobertura simultánea del 95% para 64 criterios. Se mantuvieron controles jsdom ±2%, controles RustAA ±5% y límite superior RustAB +5%. Se conservan también mejoras grandes, resultados adversos y los 19 controles rechazados; su fallo limita la atribución causal de las diferencias al código Rust.

## Todos los grupos

| SDK | Fase | Engine | Cumplen |
|---|---|---|---|
| v22.12.0 | AA | jsdom | 4/8 |
| v22.12.0 | AA | rustdom | 8/8 |
| v22.12.0 | AB | jsdom | 4/8 |
| v22.12.0 | AB | rustdom | 8/8 |
| v24.14.1 | AA | jsdom | 3/8 |
| v24.14.1 | AA | rustdom | 8/8 |
| v24.14.1 | AB | jsdom | 2/8 |
| v24.14.1 | AB | rustdom | 5/8 |

`all-criteria.csv` y `tables/comparisons.json` conservan los 64 criterios sin selección. Las filas range-control muestran mejoras observadas; las tres filas RustAB rechazadas de Node 24 son mutation-records-collect/100 y range-state-lifecycle-1000/{1000,250}. No se declara aceptación global ni se descartan sus controles desfavorables.

| Comparación RustAB rechazada (Node 24) | Diferencia observada | IC 95% |
|---|---:|---:|
| mutation-records-collect/100 | +4.376466% | [3.202629%, 5.566310%] |
| range-state-lifecycle-1000/1000 | +5.743904% | [4.413334%, 7.130208%] |
| range-state-lifecycle-1000/250 | +4.300560% | [3.201423%, 5.423808%] |

Son diferencias medidas, no una atribución causal demostrada: los tres controles
jsdom correspondientes también fueron rechazados. El criterio exige que el
intervalo completo cumpla el límite; un punto menor que +5% no alcanza.

## Hardware y tiempos observados

| SDK | CPU informada | vCPU visibles | Memoria guest(bytes) | Captura(min) |
|---|---|---|---|---|
| 22.12.0 | AMD EPYC 7763 64-Core Processor | 4 | 16765411328 | 148.956 |
| 24.14.1 | AMD EPYC 7763 64-Core Processor | 4 | 16765411328 | 144.259 |

La frecuencia reportada por os.cpus es0: se conserva como no informada y no como una frecuencia física nula. Los modelos de forecasts anteriores no se sustituyen por el hardware observado ni demuestran causalidad. Se conservaron170min de captura y200min por job; este rechazo es numérico, no un timeout.

## Memoria, procedencia y continuación

Hay108 primeras rondas no claras, publicadas íntegramente. Todos los procesos cumplen dos estados finales claros paraWindow yDocument separados. Los baselines nativos, booleanos sin delta, deltas numéricos y snapshots parentales están completos; ver reports/memory/owner-batch-study/40234774968/. Estas pruebas finitas no miden memoria pico ni demuestran ausencia universal de fugas.

Las identidades originales del método, del compilador, de los paquetes y del lector se conservan sin normalizar. El lector local usa Git nativo f781+WIP real; no se presenta como el checkout publicado limpio504. Todos los cálculos usan código actual y los snapshots medidos solo se leen como datos.

No se repite esta secuencia, no se amplían muestras, no se cambian semillas/warmup/estimador/presupuestos y no se crea tag ni merge de ownership. El CI de rendimiento sigue sin aceptación. Siguiente trabajo: analizar la estabilidad de los controles y el costo de range-state-lifecycle usando la evidencia existente, justificar y probar cualquier candidato o método posterior antes de ejecutarlo. La autorización permanente ya está concedida; la migración general continúa pendiente.
