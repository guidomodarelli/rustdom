# QA offline del método de limpieza fría

El método ownership-cold-cleanup-v1 está implementado y revisado localmente,
sin activar su workflow de captura. Los 17 contratos pasaron con Node 22.12.0
y 24.14.1 fijados, sin ejecutar DOM ni tomar muestras nuevas. Actionlint
aprobó ambos workflows. La revisión local aislada cerró sin hallazgos sobre
este alcance; no abarca todo el PR ni acepta rendimiento.

Se autentican los paquetes reales del artifact 12549521134, la calificación
4aba8018 del addon 0a949, la derivación y sus productores actuales. Los
contratos reproducen todos los valores del estimador sobre los 2048 procesos
históricos rechazados, sin relabelar esos resultados como datos del candidato.
También validan sus spans, counters y observaciones separadas de Window y
Document. Las pruebas de ejecución se limitan a rechazos de contexto; el
sampler nuevo y una captura íntegra nueva aún no se ejecutaron.

La regresión del P2 modifica coherentemente ambas declaraciones canónicas:
se rechaza porque ahora se fija el hash independiente del manifiesto y se
recalcula el de sus 434 entradas. Otra regresión construye un cache `.pyc`
hostil en un directorio propio: el control demuestra su ejecución con el
loader normal, y la derivación nueva evita ese cache sin modificar fuentes
ni caches reales. No se ejecutó código desde un archivo de evidencia.

El código final conserva sus hashes en source-snapshot.json y review.json.
El checkout de QA es un Git Linux real con HEAD 4aba8018; los archivos nuevos
del método se copiaron para probarlos antes de publicarlos. Por eso ese base
commit aún no los contiene: no se presenta como commit publicado del método.
El arnés medido conserva sourceChanges=[] y sourceGitErrors=[] reales.

offline-qa.tar.xz preserva todos los logs y recibos generados, incluidos los
fallos. El intento 1 falló porque el sparse checkout omitía un test requerido
por el arnés; se amplió /tests antes de continuar. El intento 5 detectó una
referencia a metadata fuera de alcance al extraer validateObservations; se
movió el chequeo del sidecar a validateReport. El intento 6 valida todas las
observaciones históricas y pasa en ambos Node. Los intentos previos exitosos
también se conservan. Los recibos guardan los hashes de cada versión probada;
los snapshots .py.txt son herramientas actuales para inspección, no entrypoints
para ejecutar desde el archivo.

El control de publicación real pasó otros tres contratos en cada Node: acepta
los 511 archivos revisados, rechaza una revisión con hallazgos y rechaza un
hash alterado. La prueba restaura el recibo original en su copia de QA. Sus
logs y snapshots se conservan fuera del tar de 24 miembros. También se guarda
el primer fallo del wrapper: Windows convirtió el argumento POSIX a WindowsPath
y el proceso terminó antes de leer o modificar el recibo. Se corrigió ese
argumento y ambos Node aprobaron, sin modificar el método ni sus 17 contratos.

No se modificaron los 26/46 pins históricos ni las 434 fuentes congeladas.
No hay aceptación, tag, merge ni autorización para una secuencia nueva. El
siguiente paso es comprobar los contratos del SHA publicado en GitHub y su
review antes de solicitar una única ejecución de 2048 procesos. El protocolo
mantiene los presupuestos ±2%/±5% y fija 175 min de captura dentro de 180 min
del job para reservar margen de archivo. Un fallo o rechazo no permite repetir.
