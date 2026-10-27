# Calificación funcional del controlador y replay

node22.tar.xz ynode24.tar.xz preservan cada parte completa de32workers, todo warmup,
timers,12 medias de bloque, comandos, pids, binding, afinidades, estadísticas y
snapshots del padre. Los descriptores JSON enumeran todos los miembros y sus hashes.
initial-preflight-node22.tar.xz conserva el fallo previo de cierre de dependencias,
con cero workers: faltaba el manifiesto fuente del candidato, corregido después.
No se completaron datos faltantes ni se trató esa salida como una medición válida.

Los64workers completos guardan9216duraciones medidas y3072warmup,768Window y768
Document separados,192endpoints de recursos y6snapshots del padre. Cuatro primeras
rondas no fueron claras; todas las dos finales por worker lo fueron. No implican
ausencia universal de fugas ni memoria pico. Recursos completos en
reports/memory/owner-batch-integral/20261025/.

El código actual se copió a un Git Linux real basado en f781c3b7 con WIP de método,
para validar el flujo completo sin usar un gitfile Windows desde GitWSL. Se
preservan el HEAD y169líneas crudas de cambios reales en las partes completas
(168en el intento inicial previo al manifiesto faltante); no se presenta como564f0f55
ni como un checkout publicado limpio. Los bytes ejecutados están ligados al índice
y snapshot. El productor original y el lector actualizado quedan separados.

Pasaron30contratos de reader/protocolo/datos por SDK y6de procesos por SDK, más
actionlint. Los replays iniciales reprodujeron ambas partes en ambos Node. Los
lectores posteriores también verificaron las partes originales sin ejecutar DOM.
Las copias adversariales rechazaron duplicación, falsa liberación y fuente
archivada alterada, sin ejecutar ese código. Los tests de contexto mutado son
contratos negativos explícitos; no modificaron los datos originales.

La colección de CI anterior40216555955 aprobó4/4jobs sobre564f0f55 y sus dos ZIP
originales están en reports/validation/owner-batch-method-ci/40216555955/. No es CI
del prototipo ampliado. Falta su validación hospedada, autenticación científica
externa, decisión final y revisión/publicación íntegra. executionReady=false,
performanceAccepted=null, gateReevaluated=false. Runtime híbrido y objetivo activo.

La revisión aislada detectó un P2 en la salida del replay: rename podía reemplazar
un enlace colgante o una salida concurrente. writeNewJSON publica con hardlink
exclusivo; el progreso propio conserva rename atómico. Las tres regresiones CLI
pasaron en ambos SDK. La suite separada conserva7casos CLI+12protocolo por SDK
y11casos de datos por SDK. Un recheck combinado posterior sufrió EIO al llenarse C:
(el fallo y sus logs quedan publicados), sin cambiar las capturas originales.
Se liberaron1157624877bytes retirando solo dos copias ZIP/tar ignored de la
materialización Windows40051899308, tras verificar SHA/tamaño contra originales
conservados en native-telemetry-collection-40051899308. No se tocó ningún directorio
cuyo borrado fue rechazado. WSL mantiene EIO; no terminarlo perdiendo RAM sin
recuperación. Los tres tar publicados conservan todas las capturas completas/parciales.
La nueva ejecución de CI deberá validar el prototipo sobre el SHA publicado.
