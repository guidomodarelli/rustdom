# Estudio original de afinidad auxiliar: resultado rechazado

El estudio publicado y calificado en `5e6ac005` se ejecutó una sola vez, en
Node 22.12.0 y 24.14.1. Cada versión terminó sus 1024 workers con exit 0.
La verificación completa terminó con exit 0, `verified=true` y
`backgroundAffinityVerified=true`. La aceptación de rendimiento es `false`
en ambos perfiles y en conjunto.

Se conservaron los 7425 archivos originales y 1355361715 bytes crudos.
`study.tar.xz` contiene todos ellos en 6684604 bytes, SHA-256
`0cb8a43985aa92e5dfff64420a36c6be1453f2a300e94aa3f31d0fef520e7d25`.
La compresión no modifica los bytes descomprimidos del tar, cuyo SHA-256 es
`24abac0a8721e1d6312652dc20085d992d2e4fe0b96d3c14f1b6db677801033a`.
Se verificaron todos los miembros por tamaño y hash antes y después de comprimir.

La primera captura gzip de 265296558 bytes, hash `363ef21b`, y sus ocho fragmentos
siguen conservados localmente; no se duplican en el PR. Sus recibos y manifiestos
originales están en `original-gzip-*.json`. `archive-producer.py` conserva esa
primera captura y `transport-producer.py` la recompresión exacta. Son cambios de
transporte, sin muestras nuevas o descartadas.

El tar conserva arnés completo, informes de workers, stdout/stderr, índices,
publicaciones, fuentes y ejecutor. `raw-files.json` autentica cada archivo del
estudio; `files.json` autentica los archivos publicados salvo sus propios bytes.

## Decisión y alcance

Son 18432 duraciones medidas en 2048 procesos, ocho filas, AA/AB, dos motores,
dos etiquetas y 16 posiciones balanceadas. Se conservan estimador y presupuestos:
jsdom ±2%, Rust AA ±5% y Rust AB +5%. No se descarta ninguna fila o muestra.

Trece controles jsdom exceden ±2%: seis en Node 22 y siete en Node 24. Una de esas
filas también excede numéricamente el presupuesto Rust: Node 24 / AB /
mutation-records-collect/1000, +5,6268522203%, con control jsdom +2,0454497753%.
Su control inválido impide atribuir causalmente esa diferencia al cambio Rust.
El exceso se conserva como fallo numérico; no se declara resuelto ni se normaliza
por el control para aprobarlo. Este estudio no habilita tag o merge.

La tabla incluye todas las 32 celdas. Los valores completos, medianas, muestras
por proceso y hashes de salida permanecen en `summary.json`.

| Node | Fase | Operación/tamaño | Control jsdom % | Cambio Rust % | Presupuesto |
| --- | --- | --- | ---: | ---: | --- |
| v22.12.0 | AA | mutation-records-collect/100 | +4.6664 | -0.6470 | rechazado |
| v22.12.0 | AA | mutation-records-collect/1000 | -0.5425 | +1.4408 | dentro |
| v22.12.0 | AA | observer-delivery-records/100 | -2.6661 | -0.2049 | rechazado |
| v22.12.0 | AA | observer-delivery-records/1000 | -0.7490 | -1.2307 | dentro |
| v22.12.0 | AA | range-control-1000/1000 | +0.2568 | -0.7626 | dentro |
| v22.12.0 | AA | range-control-1000/250 | -0.9985 | -1.5587 | dentro |
| v22.12.0 | AA | range-state-lifecycle-1000/1000 | +1.7072 | -1.1751 | dentro |
| v22.12.0 | AA | range-state-lifecycle-1000/250 | +2.0403 | -1.5432 | rechazado |
| v22.12.0 | AB | mutation-records-collect/100 | +3.7736 | -0.2371 | rechazado |
| v22.12.0 | AB | mutation-records-collect/1000 | -0.7170 | +0.4153 | dentro |
| v22.12.0 | AB | observer-delivery-records/100 | -2.4045 | -1.1233 | rechazado |
| v22.12.0 | AB | observer-delivery-records/1000 | +0.1882 | -2.8809 | dentro |
| v22.12.0 | AB | range-control-1000/1000 | +1.0646 | +1.7083 | dentro |
| v22.12.0 | AB | range-control-1000/250 | +3.4456 | -1.0740 | rechazado |
| v22.12.0 | AB | range-state-lifecycle-1000/1000 | +0.2822 | -1.0950 | dentro |
| v22.12.0 | AB | range-state-lifecycle-1000/250 | +0.6807 | -1.5365 | dentro |
| v24.14.1 | AA | mutation-records-collect/100 | +2.9116 | -0.6386 | rechazado |
| v24.14.1 | AA | mutation-records-collect/1000 | -2.7931 | +0.4691 | rechazado |
| v24.14.1 | AA | observer-delivery-records/100 | +0.7546 | -1.4754 | dentro |
| v24.14.1 | AA | observer-delivery-records/1000 | +1.1149 | +4.1302 | dentro |
| v24.14.1 | AA | range-control-1000/1000 | +0.8417 | -0.2807 | dentro |
| v24.14.1 | AA | range-control-1000/250 | -0.8497 | +3.9127 | dentro |
| v24.14.1 | AA | range-state-lifecycle-1000/1000 | +3.3660 | -0.5396 | rechazado |
| v24.14.1 | AA | range-state-lifecycle-1000/250 | -1.1237 | +1.4871 | dentro |
| v24.14.1 | AB | mutation-records-collect/100 | +2.6336 | -1.5158 | rechazado |
| v24.14.1 | AB | mutation-records-collect/1000 | +2.0454 | +5.6269 | rechazado |
| v24.14.1 | AB | observer-delivery-records/100 | +0.2078 | +2.6886 | dentro |
| v24.14.1 | AB | observer-delivery-records/1000 | +0.3884 | -4.2161 | dentro |
| v24.14.1 | AB | range-control-1000/1000 | +2.7091 | +0.7889 | rechazado |
| v24.14.1 | AB | range-control-1000/250 | -2.3789 | +0.9122 | rechazado |
| v24.14.1 | AB | range-state-lifecycle-1000/1000 | -0.9959 | -2.6109 | dentro |
| v24.14.1 | AB | range-state-lifecycle-1000/250 | -1.8564 | +2.3083 | dentro |

## Qué prueba la afinidad

Se inicializó libuv y se apartaron los TID auxiliares existentes de CPU 2,
conservando el hilo principal en CPU 2. Los snapshots antes/configurado/final y
sus contratos pasaron en todos los workers. No demuestran aislamiento físico,
ausencia de hilos transitorios o la causa del ruido. La comparación con estudios
anteriores tampoco identifica un efecto causal de la afinidad: fueron ejecuciones
separadas y se conservan sus rechazos.

El sampler carga exactamente un paquete físico por proceso y comprueba la
caché antes y después. Los cinco nombres en loadedBefore/loadedAfter no
significan cinco runtimes cargados: los no seleccionados tienen listas vacías.
No se encontró allí un defecto de carga que explique los controles inválidos.

## Memoria y procedencia

Cada worker registró 12 Window y 12 Document: 24576 de cada tipo, incluidos
6144 por warmup. Los dos últimos endpoints declarados estuvieron claros antes
de salir. Los snapshots heap/external/RSS se conservan por worker, sin
interpretarlos como memoria pico, estabilidad en procesos longevos o ausencia
universal de fugas.

Se usó la preparación oficial anterior 39720077911/artifact12400802735,
preparation99fb5dd8-2ee8-402c-97b4-d8174069f933, binario B 221e6754.
El arnés medido tiene hash 46b2e7cc y fuentes canónicas 0b485; la preparación
compilada conserva su identidad 0d67. La correspondencia real de esos alcances,
limitada a las diferencias de herramientas ya documentadas, está en
`reports/validation/native-class-ownership/build-correspondence/2026-10-22/`.
No se sustituyó el SUT por el build fresco ni se repinearon resultados rechazados.

`python3 verify-archive.py` verifica el transporte, el tar y cada archivo sin
extraer código o ejecutar workloads, addon, DOM o capturas. Los datos
originales siguen bajo
`/home/guido/rustdom-validation/background-affinity-study-k98_55yo`.
El marcador consumido es `.cache/background-affinity-study.started.json`.
No repetir la secuencia por pérdida de handle, cambio de máquina o resultado
desfavorable.
