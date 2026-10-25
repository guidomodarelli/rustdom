# Recursos de tareas secuenciales

Estos 23 probes por SDK pertenecen a contratos funcionales del sampler. Mantienen
los baselines completos, tres rondas y dos estados finales claros, los controles
retenidos y los estados separados de Window y Document. resources.json conserva
JS heap, external, RSS y todas las familias nativas observadas.

Las fixtures mutables se disponen antes de preparar la siguiente. El reporte
retiene solo escalares y hashes; los owners de seguimiento son WeakRef. Los errores
Symbol/undefined de un writer propio también cierran el realm y liberan ambos
owners. Los descriptores y estructuras corresponden a una cantidad fijada de tareas,
sin caches de observaciones globales crecientes. No se infieren ausencia universal
de fugas ni memoria pico a partir de estos endpoints.

Se ejecutó el addon local f8c8af92. El paquete remoto 4b52a84d todavía no se usó en
estos contratos. La futura secuencia necesita calificación integral con sus bytes
seleccionados y metodología revisada. Evidencia y comandos:
reports/validation/owner-batch-sampler/20261025/.
