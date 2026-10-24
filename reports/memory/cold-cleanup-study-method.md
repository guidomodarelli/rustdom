# Recursos del método prospectivo de limpieza fría

Esta revisión corresponde al tooling del estudio. No se ejecutó un nuevo
benchmark ni se generaron mediciones nuevas de memoria del candidato.
La implementación de producción de rustdom permanece sin cambios.

El padre autentica archivos y guarda recibos/datos escalares; no carga las
implementaciones DOM. Conserva como máximo la matriz fija de 2048 entradas,
nueve duraciones y tres probes RNG por entrada. No retiene objetos DOM,
WeakRef de realms ni callbacks del addon. Los reportes completos se guardan
en disco y sus buffers dejan de estar referenciados tras extraer escalares.
Los descriptores de archivos stdout/stderr se cierran en finally. Cada
worker usa un proceso propio y los inputs/output se exigen disjuntos.

La captura futura conservaría24576 Window y24576 Document por separado,
baselines nativos, tres rondas de cleanup y dos estados finales claros
requeridos por proceso, además de tres snapshots del padre. Se conservarían
también primeras rondas no claras y parciales. Esos números son el plan,
no observaciones nuevas. Los17 contratos leen recursos históricos y prueban
rechazos de datos alterados; no demuestran la liberación de realms nuevos.

Los probes existentes del addon exacto 0a949 están en
reports/memory/cold-cleanup-build-40065437939.json:30 Window/30 Document
observados y20 estados finales requeridos claros. Las suites completas
guardan sus 1920 snapshots de 960 procesos WPT en
reports/memory/cold-cleanup-hosted-compatibility-40065437939.json, sin GC
forzado en esos endpoints. Son evidencias separadas de esta revisión estática.
Ninguna prueba finita ni estos snapshots prueban memoria pico o ausencia
universal de fugas; la retención del allocator no se clasifica por sí sola
como fuga. El runtime continúa híbrido y la migración está pendiente.
