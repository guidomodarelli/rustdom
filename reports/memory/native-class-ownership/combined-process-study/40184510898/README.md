# Recursos del estudio combinado rechazado

Run 40184510898, job 121142337986, intento 1, fuente inmutable 95e64bd2.
Los 2048 procesos completos conservan 6144 warmup y 18432 duraciones medidas.
Se observaron 24576 Window y 24576 Document por separado: tres rondas por proceso
y 4096 estados finales requeridos claros. Se conservan 228 primeras rondas no
claras, sin descartarlas ni reescribirlas como liberación inmediata.

node22.json/node24.json conservan 18 grupos de paquetes físicos y todas las filas,
endpoints, baselines nativos y snapshots originales. Los datos observados son
idénticos entre ambos lectores; solo cambian readerNode y readerExecutableSha256.
Las familias completas por proceso están en resources/resources-native.jsonl del
paquete de benchmarks, con ruta, bytes y SHA256 registrados en observations.json.
El CSV conserva todas las duraciones, incluidos warmup. No hubo nueva medición.

Snapshots del padre: antes de los workers RSS=351092736 bytes; después de Node 22,
257376256; después de Node 24, 172855296. Se conservan también heapTotal, heapUsed,
external y arrayBuffers sin normalizarlos. El padre no forzó GC para estos puntos.
Estos endpoints no son memoria pico, no suman máximos simultáneos de padre e hijos,
no atribuyen causalidad y no garantizan ausencia universal de fugas o retención.

Los estados finales claros y baselines verificados delimitan este escenario finito,
no toda combinación futura de callbacks, errores, nodos y teardown. El exportador
actual f6ca5da2 sobre checkout limpio fc99401e mantiene performanceAccepted=null y
gateReevaluated=false. La decisión autenticada del estudio, conservada aparte,
es performanceAccepted=false/gateReevaluated=true por sus 44 criterios rechazados.
El rechazo no se sustituye por los resultados favorables de recursos.
