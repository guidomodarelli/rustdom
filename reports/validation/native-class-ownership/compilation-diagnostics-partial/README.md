# Evidencia terminal de captura parcial

`receipt.json` registra una sola invocación desde el commit publicado
`4e1e66c1e30e54b6e29ce275d8890a9add3b2df8`, nueve workers exit 0 y J0/jsdom
Node 24.14.1 terminado por SIGSEGV. El recorder terminó con exit 2. No se
reintentó el proceso, no se completaron datos retroactivamente y no se acepta
ningún subconjunto como evidencia de rendimiento aprobado.

`partial-capture-and-crash.tar.gz` contiene 14.218.708 bytes, SHA-256
`d9e93f17000dd674c27d5515bd749a76945f2f11b4e8c4a1d5539b2c77a9eafd`.
Su prefijo es `native-compilation-partial/`. Incluye la captura completa
disponible, nueve traces, el reporte parcial sin trace del proceso fallido,
telemetry, comandos, logs, snapshots de método/lector, recibos, preparación y
postproceso. Las copias JSON/log junto al tar permiten consultar el resultado
sin extraerlo. El ejecutable Node de 122 MB y un core/backtrace nativo completo
no forman parte de la evidencia; se registra el hash del ejecutable usado.

## Fallo y límites

El kernel registró RIP `0xa68b6a`. `addr2line` contra el ejecutable local exacto
(ELF EXEC) resolvió `node::tracing::NodeTraceBuffer::AddTraceEvent(unsigned long*)`.
`crash-symbolization.json` conserva comandos, códigos de salida y hash del
binario; el tar incluye stdout/stderr de addr2line, readelf y objdump.
`kernel-crash.log` conserva el diagnóstico del kernel/collector.

El último registro de módulos cargados contiene solo J0, sin copias de
Rustdom. Es el último control persistido: no demuestra una causa raíz, la
ausencia de otras dependencias nativas o la liberación del trabajo en vuelo.
La instrucción localizada tampoco es una prueba de un bug concreto de Node.

El `after` normal de preparación de Node 24 falta porque el orquestador se
detuvo. La verificación posterior fue otra operación de solo lectura, exit 0:
las seis fuentes, 390 partes derivadas y preparación oficial seguían iguales.
Se conservan su comando, stdout/stderr y estado sin rellenar el índice original.

## Validación y alcance

El lector conserva 876 timings: 864 con eventos, doce con eventos desconocidos;
84 intervalos planificados carecen de registro. Sus siete casos numéricos y
la lectura del artefacto real pasaron. El análisis y la cobertura están en
`reports/benchmarks/native-class-ownership/compilation-diagnostics-results/`;
la evidencia de recursos está en
`reports/memory/native-class-ownership/compilation-diagnostics-partial.md`.

`verify.py` comprueba el hash del tar, copias laterales, bytes del lector y seis
fuentes, hashes de nueve traces y recuentos independientes de reportes/recursos,
sin extraer ni ejecutar workers. `packaging-check.json` registra su resultado.
La primera ejecución detectó un error del nuevo verificador al sumar contadores
`trackedOwners` acumulativos por lote (3.900 en vez de 876); se corrigió para
sumar el último contador persistido de cada proceso. No cambió ningún crudo,
lector de eventos, resumen ni medición. El fallo se conserva en
`packaging-check-first-failure.log`.

La reproducción desde el tar, extraído con filtro `data`, pasó los siete casos
numéricos y produjo JSON idéntico al análisis publicado usando Python 3.12.10
en Windows. `replay.json` y sus stdout/stderr conservan el resultado. Los bytes
difieren únicamente por saltos de línea LF/CRLF del lector histórico; ambos
hashes se conservan. No se ejecutaron mediciones ni se reemplazó el análisis
original de Linux.

Este cambio publica evidencia y postproceso; no cambia el runtime Rust/DOM ni
sus bindings. No se repiten las suites de producto para este empaquetado.
El CI general del SHA fuente `4e1e66c1` pasó sus ocho checks en el run
`39757410705` (Linux, Windows, macOS y benchmarks). El check de ownership
`39757410643` sigue fallando: no se omite ni se presenta como aprobado.

No relanzar mediciones por archivos incompletos. No mergear ni crear tag de
checkpoint mientras el hito siga sin aceptación. Los experimentos negativos
anteriores y sus presupuestos permanecen sin cambios.
