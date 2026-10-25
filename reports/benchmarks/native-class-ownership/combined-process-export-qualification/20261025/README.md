# Exportación de datos funcionales originales

spans.csv contiene 192 warmup y 576 duraciones medidas de los 64 procesos
funcionales originales. resources-native.jsonl conserva todas las familias de
contadores nativos, baselines, las tres rondas y endpoints; Window y Document se
observan por separado: 768 de cada uno. No se ejecutaron procesos de medición nuevos.

node22-memory.json y node24-memory.json contienen agregados iguales y procedencia
del lector distinta y auténtica. Se preservan ocho primeros estados no claros y
128 estados finales claros exigidos. El agrupamiento por fila mantiene separados
los recursos de workloads distintos. No extrapolar estos conteos a los 2048 procesos
del estudio científico ni utilizar este conjunto funcional para aceptar rendimiento.

La autenticación y QA están en reports/validation/combined-process-exports/20261025/.
Estas observaciones de cleanup no miden memoria pico, no establecen causalidad ni
demuestran ausencia universal de fugas. El runtime del producto sigue híbrido.
