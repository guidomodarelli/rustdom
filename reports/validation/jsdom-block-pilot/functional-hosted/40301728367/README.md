# Productor funcional aprobado en GitHub Actions

Run `40301728367`, intento 1, commit
`2466b8d35910e5f663224203462d341fdae14f64`: **2/2 jobs aprobados**,
Node 22.12.0 y 24.14.1. Cada job ejecutó los 22 contratos de Node, nueve del
lector Python, dos pruebas de integridad del autenticador y 22 procesos reales
del calificador funcional: 16 positivos y seis adversos. El código del
productor y la fuente Git reales están ligados al SHA publicado, con
`sourceChangesRaw=""` y `sourceGitErrors=[]`, sin reescribir esos campos.

Los ZIP originales se autenticaron mediante la API: run, intento, commit,
nombre, ID, tamaño, digest y ventana temporal del job. Cada ZIP tiene 145
miembros físicos. Se guardan íntegros, junto con API, logs e inventarios SHA256.
El collector lee JSON como datos y ejecuta únicamente lectores actuales del
repositorio. Sus copias `.txt` son procedencia, nunca una orden de ejecución.
Las observaciones anteriores incompletas se conservan con `complete=false`.
`receipt.json` es la observación final completa de ambos jobs.

Cada dataset se reprodujo offline con Node 22.12.0 y 24.14.1: cuatro replays
aprobados, sin DOM adicional. La suma de los dos datasets incluye 32 positivos,
12 adversos, 4608 duraciones medidas y 1568 warmup: 1536 de los positivos y
32 del fallo deliberado del observer. Se observaron por separado 386 Window y
386 Document; 34 procesos construyeron DOM, con tres rondas de cleanup y 68
endpoints finales claros. Hay dos primeras rondas no claras, conservadas.
Los tres snapshots parentales de cada SDK y todas las rondas están en
`reports/memory/jsdom-block-pilot/functional-hosted/40301728367/`.

El primer intento del lector se detuvo al buscar `sourceChanges`, un campo que
no pertenece al schema real. Se corrigió a `sourceChangesRaw` vacío y se leyó
el mismo artifact; el fallo está documentado. La revisión encontró además un
P2 por Python optimizado: ahora `-O`, `-OO` y `PYTHONOPTIMIZE=1` se rechazan
antes de filesystem/API. Los tres casos reales conservaron intacta la evidencia.
La revisión aislada cerró ese P2. No hubo reinicio del workflow ni recaptura.

Este productor prueba jsdom 27.4.0, no ejecuta el candidato Rust a277. Estos
tiempos funcionales **no son observaciones del piloto científico**. No se
comparan rendimientos ni se acepta el gate. `performanceAccepted=null` y
`gateReevaluated=false`; el rechazo histórico sigue vigente. Los snapshots no
miden memoria pico ni demuestran ausencia universal de fugas. El runtime
del producto sigue siendo híbrido.
