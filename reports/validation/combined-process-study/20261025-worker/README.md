# Derivación, worker y lectores funcionales

Pasaron 15 contratos por SDK, incluyendo datos de una derivación real, rechazo
de controles alterados y resealados, symlinks y archivos no declarados,
preservación de outputs y captura deshabilitada. Los 64 procesos terminaron0;
ambos replay actuales aprobaron. La reproducción exacta del CI acotado pasó
11 comandos, SDKs oficiales, 686 dependencias/599 pins, derivación sin ejecutar
sampler, los 15 tests por SDK y actionlint. La fuente real es8eb2f9b3 con overlay
WIP explícito; su estado real está conservado, no se declara limpio.

El wrapper escribe gateReevaluated=false y conserva fallo/sidecar si falla
la anotación o el sampler. Comparación numérica y metadatos de propósito
mantienen separadas calificación funcional y futura captura.
Evidencia íntegra en reports/benchmarks/native-class-ownership/
combined-process-worker-qualification/20261025/, recursos en reports/memory/
combined-process-study/20261025-worker/. No ejecutar fuentes archivadas.

Quedan capturador, replay integral, workflow de captura y revisión/checks
del SHA habilitado antes del estudio. Sin tag/merge o aceptación de ownership.

La revisión local encontró dosP2: faltaba vincular el argv exacto y el commit
del sidecar. Se corrigieron sin editar/repetir los64procesos. El index terminal,
HEAD8eb,grafo434,derivación yfuentes del productor quedan fijados por identidad
independiente. El replay exige ese checkout real con lectores actuales como
overlay explícito. El fixture de un proceso real permite rechazar executable,
worker,flags,commit ypropósito cambiados. Pasaron17tests finales porSDK yel
CI final de11comandos/688dependencias. Una prueba porSDK entra al worker con
manifiesto inválido, conserva fallo ysidecar yno ejecuta workload. No confundir
esa entrada de error con mediciones nuevas. Se releen64reportes yrechazan8
alteraciones adicionales porSDK. QA posterior separada;archivo original intacto.
