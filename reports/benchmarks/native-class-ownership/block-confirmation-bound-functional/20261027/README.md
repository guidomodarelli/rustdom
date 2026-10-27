# Calificación funcional del controlador vinculado

No es un estudio de rendimiento. `executionReady=false`, `performanceAccepted=null`
y `gateReevaluated=false`; no se activó una captura científica ni se reconstruyó
el paquete consumido. Los rechazos históricos permanecen vigentes.

El comando público `block-confirmation/qualify.py --functional` ejerció cuatro
criterios completos por SDK, con 16 factores y ambos labels por bloque:
AA jsdom MutationRecord/1000, AB jsdom observer/1000, AA Rust lifecycle/1000 y
AB Rust Range/control1000. Usa el paquete original artifact 12628261403, ELF
a2777cbf, archiveFB06276. El runtime sigue híbrido.

| SDK | Criterios | Procesos | Medidas | Warmup | Window / Document | Finales claros |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| v22.12.0 | 4 | 128 | 18.432 | 6.144 | 1.536 / 1.536 | 256 |
| v24.14.1 | 4 | 128 | 18.432 | 6.144 | 1.536 / 1.536 | 256 |

Los 256 procesos conservan 36.864 duraciones medidas, 12.288 warmup, 3.072 Window
y 3.072 Document por separado, 512 estados finales claros y 24 snapshots del
padre. Cada invocación valida PID/SDK/fuentes/manifest/calendario; el lector
reproduce todos los comandos, tareas, resultados públicos y endpoints como datos.
El supervisor y el lector terminan y reapean sus descendientes reales; cada
criterio quedó verificado con ambos recibos de proceso en cero y sin huérfanos.
Estos tiempos funcionales no permiten inferir una mejora ni aceptar presupuestos.

Fuente Linux real: HEAD 748f57ac más los cambios propios conservados en
`sourceChangesRaw`, sin normalizarlos ni presentarlos como un commit limpio.
`source-members.json` y cada snapshot conservan exactamente los bytes usados.
Se verificaron los 344 inputs frente al candidato; no equivale a certificar
igualdad del entorno de build ni de otro binario local.

`qualification.tar.xz`: 12,080,236 bytes, 12,273 archivos,
SHA-256 `66a10236ce8ff184b4fdc7658cfe194b1fb6df758b80452c5c4f47e50ff027cc`. Se releyeron y verificaron todos los miembros.
`qualification-manifest.json` conserva sus tamaños y hashes. No ejecutar código
archivado. El lector siempre pertenece a la fuente actual revisada.

También se conservan 128 workers de regresión del arnés anterior, sus doce casos
adversos, versiones previas y fallidas de tests, la v1 interrumpida por hallazgos
de review y sus parciales. La v1 terminó un criterio de 32 y cinco workers del
siguiente; una sexta invocación recibió la terminación deliberada. No se suman
a la matriz final ni a una decisión estadística. Los tres prototipos anteriores
de 96 procesos permanecen separados en el archivo preliminary de validación.

Los contratos finales pasaron en cada SDK: 37 tests Node de replay/binding,
metadata, calendario, cierre y planificación; 16 Python con procesos Linux
reales; y 13 de fuentes/producción. Los 20 contratos del job nuevo también
pasaron con las fixtures finales v2 en ambos SDK. Se preservan dos fallos de preparación de
tests: fixture Node 22 usado para lanzar un worker Node 24, y baseline sparse
sin sus seis types. Se seleccionó el fixture correcto y se materializaron los
types desde el Git4196 original, manteniéndolo limpio; no se relajaron tests.
También se conserva el primer test de escritura que esperaba un nombre de
excepción distinto; el contrato final verifica el efecto físico.

La revisión local aislada cerró cinco P2 del arnés: bytecode, señal tardía,
metadata incompleta, descendientes del lector y limpieza ante fallos del journal.
Las regresiones incluyen caches válidas adulteradas, SIGTERM real posterior a
la salida del padre, un Python descendiente separado y escritura bloqueada.
Revisión final estática sin hallazgos materiales. No acredita el método
científico completo: faltan el lector del estudio de 64 criterios, transporte,
workflow científico, publicación íntegra y evidencia XML del runtime actual.
