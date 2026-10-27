# Recursos del diagnóstico AA de Range — 40154725015

Evidencia finita de `range-control-aa-telemetry-v1`, fuente d5ec4186, intento 1.
El replay completo coincide en Node22.12.0 y24.14.1. El runtime es híbrido;
`performanceAccepted=null`, `gateReevaluated=false`. No se ejecutó una captura nueva
para este análisis y no se acepta rendimiento ni se reemplazan los rechazos previos.

La [evidencia íntegra y metodología](../benchmarks/native-class-ownership/range-control-telemetry-results/40154725015/README.md)
conserva ZIP/tar, API, manifiesto, muestras/warmup, perfiles, logs y replay.
El análisis usa endpoints observados, GC/WeakRef y contadores de ownership
registrados por el protocolo, sin sustituir valores negativos o ausentes.

## Alcance y resultado observable

256 procesos: 128 híbridos y128 jsdom independiente, con2304 endpoints medidos,
768 snapshots de limpieza y tres snapshots del padre. Se observaron3072 Window
y3072 Document por separado. Cada proceso registra tres rondas de limpieza:
512 estados finales claros y cero primeras rondas no claras. Esto acredita la
liberación observable del escenario y las rondas registradas; no demuestra
la de APIs no ejercidas ni la de cualquier carga o duración.

| Familia nativa | Live baseline | Live final | Creaciones desde baseline | Liberaciones desde baseline |
| --- | ---: | ---: | ---: | ---: |
| Referencias de constructores N-API | 22 | 22 | 0 | 0 |
| RangeStates | 0 | 0 | 7680000 | 7680000 |
| RangeClones | 0 | 0 | 0 | 0 |
| RangeExtracts | 0 | 0 | 0 | 0 |
| MutationRecords | 0 | 0 | 0 | 0 |

Sumas de altas/bajas de los128 procesos híbridos; los live indicados son los
valores presentes en todos sus baselines y finales. Los22 constructores ya
existían en el baseline. Las altas de RangeStates cubren el proceso completo,
incluidos fixtures, warmup, validación y teardown: no equivalen a asignaciones
atribuibles exclusivamente a las operaciones cronometradas. Familias sin altas
no demuestran que sus algoritmos estén libres de fugas.

La tabla es solo un resumen. `resources-native.jsonl` conserva todos los campos
nativeTree/owners/baselines/endpoints/rondas; `native-counters.csv` los exporta
sin seleccionar familias mediante JSON Pointer y tipo. Los tests comprueban
su reconstrucción exacta. En jsdom se conserva que no existe baseline nativo.
`resources.csv` y los datos originales incluyen heap, memoria externa y RSS
por endpoint; no se interpretan las diferencias del allocator como fugas.

## Snapshots del proceso padre

Valores originales en bytes; son observaciones puntuales, no máximos.

| Momento | RSS | heapUsed | external | arrayBuffers |
| --- | ---: | ---: | ---: | ---: |
| before-workers | 300277760 | 18967768 | 147591189 | 145649130 |
| after-v22.12.0 | 454029312 | 36627160 | 171085860 | 169143761 |
| after-v24.14.1 | 462569472 | 36817248 | 171085860 | 169143761 |

El padre conserva evidencia/índices y recursos del colector; estos tres puntos
no distinguen por sí solos retención, allocator o fuga y no miden memoria pico.
No sumar su RSS a snapshots de hijos no simultáneos para inventar un pico.
Se conservan273 deltas CPU negativos y límites de reloj inciertos; tampoco
permiten atribuir causalidad o descartar problemas fuera del escenario.

## Validación y límites

Los lectores actuales reconstruyeron los originales y reprodujeron el análisis
con ambos SDKs autenticados: ocho exports byteidénticos. Los nueve contratos
sobre artifact real y cinco contratos descriptivos pasan; transporte y
reconstrucción pasan en Linux/Windows salvo el symlink Windows sin privilegio,
cubierto en Linux. Fuentes, comandos, fallos previos y logs quedan en el ZIP QA.
No se ejecutó código archivado ni se normalizaron metadatos de Git/source.

No hay evidencia de crecimiento no liberado de RangeStates al final de los
procesos de este escenario. No es una garantía universal de ausencia de fugas,
de memoria pico ni una aceptación del rendimiento de ownership. Mantener
pruebas de teardown/errores/reentrancia y ampliar evidencia con cada candidato
nuevo sin reutilizar o repetir este diagnóstico ya consumido.
