# Recursos del colector y replay AA

Esta etapa ejecutó lectores, preflights y contratos, sin crear Window/Document
nuevos ni iniciar perfiles. Los datos CPU/GC/JIT pertenecen a ocho procesos
históricos con identidad conservada. No representan memoria de un run nuevo.

El colector guarda metadata por256procesos planificados y tres floats de RNG
por entrada; no almacena targets DOM. El análisis de cada proceso queda en un
archivo y no se agrega su perfil entero al índice global. Las estructuras de
frames/eventos son locales a cada lectura. Los handles de stdout/stderr se
cierran en el ejecutor existente; el recibo exclusivo también cierra su fd
incluso si escribir falla. No se borran parciales ni se completan muestras.

Se probaron el consumo exclusivo y la preservación del primer recibo, árboles
derivados con archivos extra/metadatos reescritos, destinos protegidos y
restauración de la fixture Git y configuración de Python. Los temporales de
contratos se eliminan solo bajo su raíz propia. El deadline se comprueba antes
de iniciar un worker, después del análisis y después de la verificación final.

La futura ejecución reutiliza el wrapper ya revisado que intenta stop,
disable y disconnect de Inspector y desconexión de PerformanceObserver por
separado. Aún no se ejerció ese camino en Range con el método nuevo. Los
contratos actuales no prueban su teardown end-to-end; la primera captura
deberá conservar las observaciones de Window/Document, baselines nativos y
dos estados finales claros dentro de tres rondas.

No se midió memoria pico, pendiente de RSS ni liberación del allocator en
este lector. No se afirma ausencia universal de fugas. Los snapshots futuros
serán observaciones puntuales y no pruebas de pico o causalidad.
Evidencia: reports/validation/native-class-ownership/range-control-telemetry-components/20261025/.
