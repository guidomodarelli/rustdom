# Recursos: estudio compartido 40012710923

La única secuencia completa observó 24576 Window y 24576
Document por separado, en 2048 procesos. Cada proceso conserva
tres rondas tras GC: 228 primeras rondas no claras,
sin descartarlas; 4096 estados finales requeridos
claros, dos por proceso, con ambos tipos de owner liberados.

Los seis grupos Rust (A0/A1/B en ambos Node) regresan al baseline observado
`napiClasses.live=22`. Los cuatro grupos jsdom no tienen baseline de ese addon.
Todos los endpoints originales, nativeTree y supervivientes permanecen en el
tar/ZIP íntegros de `reports/benchmarks/native-class-ownership/shared-fixture-study-results/40012710923`. `memory.json` conserva rangos de
rss, heapTotal, heapUsed, external y arrayBuffers por grupo, versiones y máquina.

Snapshots del proceso padre, bytes (sin GC forzado del padre):

| Etapa | RSS | heapUsed | external | arrayBuffers |
| --- | ---: | ---: | ---: | ---: |
| before-workers | 258097152 | 7448264 | 128415444 | 126486355 |
| after-v22.12.0 | 268525568 | 10106408 | 128415484 | 126486355 |
| after-v24.14.1 | 296513536 | 12405264 | 128415484 | 126486355 |

El crecimiento de RSS/heap del padre entre tres puntos no distingue por sí mismo
retención del allocator, heap aún recolectable o fuga. `arrayBuffers` permanece
en 126486355 bytes y `external` casi estable, pero estos snapshots no prueban un
límite universal ni memoria pico. Las observaciones finitas de los workers no
descartan fugas en otros escenarios de eventos, timers, caches o referencias.
Los rangos entre paquetes tampoco son una comparación causal A/B de memoria.

El análisis offline se reprodujo byte-idéntico en Node 22.12.0 y 24.14.1;
no se crearon nuevas ventanas ni se repitieron mediciones. La evidencia tiene
integridad verificada y rendimiento rechazado. No se declara resuelto el gate
de rendimiento ni completo el objetivo de migración.
