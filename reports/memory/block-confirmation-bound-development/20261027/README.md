# Recursos de la calificación funcional vinculada

`endpoints.json` separa desarrollo inicial, regresión legacy, v1 rechazada por
review y calificación final v2. Conserva las tres rondas de cada worker,
baselines nativos, Window y Document por separado, primeras rondas no claras,
estados finales y snapshots parentales. Los parciales permanecen como parciales.

La v2 final contiene 256 procesos, 3.072 Window y 3.072 Document por separado,
512 estados finales claros y 24 snapshots parentales. La regresión legacy de 128
procesos y los tres prototipos de 96 se conservan en grupos distintos; no se
combinan para producir una decisión estadística. Los fallos deliberados de
progreso y los procesos interrumpidos están íntegros en sus archivos de origen.

Los tests Linux ejercen huérfanos, señales, timeout y fallos de escritura con
Node/Python reales. Se reapean solamente descendientes observados por el kernel,
contrastando PID y startTicks antes de señalarlos. Un error al escribir evidencia
no puede saltar la limpieza; un recibo incompleto no se acepta.

Los padres conservan metadata, conteos y muestras como JSON; nunca reciben
referencias al DOM. Las observaciones finitas de GC y los snapshots no miden
memoria pico ni demuestran ausencia universal de fugas o retención del allocator.
El cambio afecta herramientas, no añade una ruta de runtime Rust/JavaScript.
