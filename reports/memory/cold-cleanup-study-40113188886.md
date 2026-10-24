# Recursos: estudio frío40113188886

La secuencia completa observó24576Window y24576Document por separado en
2048procesos. Se preservan tres rondas de limpieza por proceso,264primeras
rondas no claras y4096estados finales claros. Cada grupo Rust vuelve a su
baseline nativo observado; jsdom no usa ese addon. No se descartan rondas.

| Grupo | Procesos | Primera ronda no clara | Baselines live | Finales live | RSS observado, bytes |
| --- | ---: | ---: | --- | --- | --- |
| v22.12.0/J0 | 256 | 68 | [] | [] | 141955072..184123392 |
| v22.12.0/J1 | 256 | 71 | [] | [] | 141676544..185823232 |
| v22.12.0/A0 | 192 | 46 | [22] | [22] | 156082176..205459456 |
| v22.12.0/A1 | 192 | 47 | [22] | [22] | 154021888..205467648 |
| v22.12.0/B | 128 | 32 | [22] | [22] | 148160512..205193216 |
| v24.14.1/J0 | 256 | 0 | [] | [] | 162131968..281337856 |
| v24.14.1/J1 | 256 | 0 | [] | [] | 162242560..280162304 |
| v24.14.1/A0 | 192 | 0 | [22] | [22] | 159526912..303968256 |
| v24.14.1/A1 | 192 | 0 | [22] | [22] | 157962240..303890432 |
| v24.14.1/B | 128 | 0 | [22] | [22] | 159555584..304136192 |

Todos los endpoints/supervivientes/nativeTree originales permanecen en el tar
y ZIP íntegros del paquete cold-cleanup-study-results/40113188886. El JSON
adyacente y memory.json conservan rangos de RSS,heapTotal,heapUsed,external y
arrayBuffers, versiones/máquina y3snapshots del padre sin GC forzado:

| Etapa | RSS | heapUsed | external | arrayBuffers |
| --- | ---: | ---: | ---: | ---: |
| before-workers | 275222528 | 11646656 | 128728388 | 126798006 |
| after-v22.12.0 | 276332544 | 14105392 | 128727135 | 126798006 |
| after-v24.14.1 | 284946432 | 16396616 | 128727135 | 126798006 |

Los rangos observados no son memoria pico. Las diferencias entre paquetes no
son una comparación causal A/B de memoria. Tres snapshots del padre no
permiten distinguir retención del allocator, heap recolectable y fuga.
Las observaciones finitas tras GC no descartan fugas en otros escenarios de
eventos, timers, caches o referencias. El replay offline es byte-idéntico en
Node22.12.0/24.14.1 sin nuevas ventanas ni mediciones. El rendimiento fue
rechazado; los endpoints claros no aceptan el gate ni completan la migración.
