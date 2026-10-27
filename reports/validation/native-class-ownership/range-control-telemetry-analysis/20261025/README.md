# Exportación offline completa de recursos

Este paquete prepara el análisis del único diagnóstico AA activo: run40154725015,
job121053535757/intento1, fuente inmutable d5ec4186. No inicia ni repite procesos,
no ejecuta DOM y no acepta rendimiento. Los pins del resultado nuevo permanecen
sin fijar; la CLI rechaza exportar hasta autenticar el artifact y el replay real.
El runtime sigue híbrido y la migración general continúa pendiente.

## Cambio y responsabilidades

`tools/analyze.cjs` conserva los siete exports previos y añade
`resources-native.jsonl`. Cada línea contiene identidad original, `nativeBaseline`,
`trackedOwners`, los nueve endpoints de memoria medidos y las tres rondas
`cleanupTrace` completas. No selecciona familias: conserva también `rangeStates`,
`rangeClones`, `rangeExtracts`, capacidad, flags y todos los demás campos originales.
La ausencia de un baseline en jsdom se conserva como ausencia, sin fabricar ceros.
El análisis cruza owners/trazas con el reporte original. El descriptor JSONL se
cierra en un `finally` independiente de los dos writers CSV; se escribe una línea
por proceso, sin acumular los objetos completos de recursos de toda la captura.
El CSV histórico mantiene sus columnas para conservar comparabilidad.

Los tres helpers proceden de código actual del repositorio y se autentican por
hash antes de importarlos. `repositoryRelativePath` permite ubicar esos helpers
al publicar el lector; no se importa código de archivos archivados. Para usarlo
con el resultado nuevo, copiar el lector a su paquete de resultados, autenticar
primero el run/artifact/fuente y fijar allí los hashes reales del índice y replay.
No modificar ni fabricar los campos de procedencia de la captura.

## Validación ejecutada

La QA con la política histórica original de40051899308 reproduce sus512procesos
en Node22.12.0/24.14.1. Los siete exports anteriores son byteidénticos a los
versionados; los ocho exports, incluido el JSONL nuevo, son byteidénticos entre
Node. Se conservan1536snapshots de limpieza y211primeras rondas no claras.
Los cinco contratos anteriores también pasan en cada Node. Es una lectura del
diagnóstico histórico de MutationRecord, sin relabel ni mediciones nuevas.

Los cuatro contratos portables de recursos pasan en ambos Node fijos. Ejercen
128reportes AA de Range1000/1000 de40137458635: todas las posiciones, etiquetas,
motores y ambos Node. Se añade explícitamente UN control MutationRecord original
del mismo run para comprobar una primera ronda no clara. No se presenta ese
control como Range ni como proceso nuevo. `fixtures/reports.bin.gz` concatena los
bytes exactos de129reportes; manifiesto, offsets, tamaños y hashes se contrastan
con el índice original ya versionado. La descompresión tiene un límite exacto de
82076505bytes. No se ejecuta contenido de la fixture. No se ejecutó Windows para
estos contratos nuevos; ambos Node son los binarios Linux fijados.

```sh
node --test reports/validation/native-class-ownership/range-control-telemetry-analysis/20261025/tools/resources.spec.cjs
```

El workflow `range-resource-analysis-contracts.yml` ejecuta solo esos cuatro
contratos por Node, con límite10min y subida5min. Actionlint pasa; los checks
remotos del commit nuevo todavía están pendientes al publicar este paquete.
No instala ni carga paquetes DOM, ni ejecuta sampler, CPU/JIT profiling o replay
de una captura nueva. Los errores iniciales de QA se conservan: runId string
frente a número, campos jsdom ausentes frente a null y la expectativa incorrecta
de una primera ronda no clara entre los128Range; las mediciones no se alteraron.

`evidence.zip` y `members.json` preservan fuentes, políticas, logs, comparación,
exports JSONL y fallos. El ZIP tiene49miembros, SHA256
c732d7c849ed082f78cfbd413e507ecf9e74101d0916b11ddcf734f6f952a2bc.
Su código archivado es evidencia de inspección: no ejecutarlo.

## Límites

El artifact/replay completo del diagnóstico AA nuevo sigue pendiente. Este
paquete no cambia los599archivos del método ni563pins históricos. Preserva48
entradas ajenas. `performanceAccepted=null`, `gateReevaluated=false`; ownership
mantiene su rechazo histórico. No hay tag ni merge. Los snapshots son estados
observados, no memoria pico ni demostración universal de ausencia de fugas.
