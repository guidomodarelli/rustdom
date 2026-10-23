# Memoria del diagnóstico jsdom 39959175058

Los 64 procesos observaron 768 Window y 768 Document por separado, incluidos
192 owners de warmup por tipo. Las 192 rondas conservan tres primeras rondas
no claras. Los 128 endpoints finales requeridos quedaron claros antes de
terminar los procesos. Las 32 sesiones Inspector iniciadas se detuvieron y
desconectaron; los procesos JIT no iniciaron una sesión Inspector.

| Node / modo | Procesos | Window | Document | Primera ronda no clara | Finales claros | RSS observado (MiB) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| v22.12.0/cpu | 16 | 192 | 192 | 1 | 32 | 147.5–180.6 |
| v22.12.0/jit | 16 | 192 | 192 | 2 | 32 | 138.6–165.0 |
| v24.14.1/cpu | 16 | 192 | 192 | 0 | 32 | 159.2–281.1 |
| v24.14.1/jit | 16 | 192 | 192 | 0 | 32 | 147.5–268.7 |

El JSON conserva todos los rangos de RSS, heapUsed, heapTotal, external y
arrayBuffers por Node y modo. Los snapshots siguen al GC; no son memoria pico.
La instrumentación y el allocator influyen en RSS: no se compara el consumo
entre modos ni se interpreta un máximo como una fuga. Son observaciones
finitas de jsdom y de las herramientas; no certifican ownership nativo de
Rustdom ni ausencia universal de fugas. Los archivos originales y cada ronda
están en el ZIP íntegro del informe de benchmarks correspondiente.
