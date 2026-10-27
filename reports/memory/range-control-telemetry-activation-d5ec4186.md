# Alcance de recursos al activar el diagnóstico AA

El CI general de d5ec4186 aprobó los escenarios finitos de memoria y Valgrind
en Linux. Los reportes y logs originales están incluidos en el registro de
activación. Eso no prueba memoria pico, ausencia universal de fugas ni el
teardown de una captura nueva todavía en curso.

Los lectores de transporte solo leen API/archivos y cierran sus descriptores.
Autentican los bytes de ZIP/tar y conservan observaciones parciales. No crean
Window/Document, perfiles, muestras o paquetes nativos nuevos. El shim Linux
invoca el CLI real y modifica PATH únicamente en el proceso hijo.

El error local de ruta WSL ocurrió antes del POST y se corrigió sin repetir
DOM. El error de PATH del lector conservó un snapshot incompleto con su flag
readerCompleted=false; no se sustituyeron campos ausentes por valores cero.
Los temporales de contratos se eliminan solo bajo sus directorios propios.

La captura real deberá comprobar Window y Document por separado, los baselines
nativos, tres rondas y dos finales claros por proceso. Sus 256 procesos y tres
snapshots del padre son cantidades planificadas, no una medición de pico. Los
reportes nativos íntegros permitirán analizar también los contadores de Range;
las columnas del exportador histórico no bastan por sí solas para ese análisis.

performanceAccepted=null y gateReevaluated=false. El rechazo histórico de
ownership y la migración incompleta permanecen explícitos.
