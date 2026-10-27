# Memoria de la calificación CI 39988794384

Node 22.12.0 y 24.14.1, con referencia jsdom J0 y rustdom híbrido B.
Son datos de CI separados de la calificación local. Los artifacts y logs
completos están en reports/validation/native-class-ownership/shared-fixture-ci/39988794384/.

| Node / runtime | Window | Document | Primera ronda no clara | Finales claros | RSS observado (MiB) |
| --- | ---: | ---: | ---: | ---: | ---: |
| v22.12.0/jsdom | 19 | 19 | 13 | 38 | 170.0–214.9 |
| v22.12.0/rustdom | 19 | 19 | 15 | 38 | 194.9–214.9 |
| v24.14.1/jsdom | 19 | 19 | 16 | 38 | 193.9–303.3 |
| v24.14.1/rustdom | 19 | 19 | 15 | 38 | 290.8–303.4 |

Total: 76 Window y 76 Document, 59 primeras rondas no claras y 152 estados
finales claros. Incluye errores, cancelación y retención deliberada de
fixtures descartados y promesas pendientes. Los baselines nativos se
conservaron y recuperaron; napiClasses.live=22 corresponde a ese baseline.

RSS, heapTotal, heapUsed, external y arrayBuffers están en el JSON y en
cada ronda original. Son snapshots tras GC; no son memoria pico. No se
comparan runtimes o hosts como A/B ni se certifica ausencia universal de
fugas. El runtime sigue híbrido y no se aceptó rendimiento.
