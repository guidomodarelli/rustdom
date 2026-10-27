# Resultado completo rechazado — run 40184510898

La secuencia `ownership-combined-process-means-v1` se ejecutó una sola vez,
job 121142337986, intento 1, fuente 95e64bd20711975b08864cf1bef1dee362b79663.
[Run original y logs](https://github.com/guidomodarelli/rustdom/actions/runs/40184510898).
Terminó con código 1 por sus criterios numéricos; no fue un timeout ni una captura
incompleta. Los replays estrictos en Node 22.12.0 y 24.14.1 autenticaron el archivo
y produjeron el mismo payload completo: `performanceAccepted=false`,
`gateReevaluated=true`. El runtime continúa híbrido y el candidato sigue aislado.

No se repite esta secuencia, añaden muestras ni cambian presupuestos. Este nuevo
rechazo conserva los rechazos históricos. No habilita tag ni merge de ownership.

## Integridad y cobertura

Artifact 12600097415, ZIP de 133107653 bytes, SHA256
`252f261b25f1bbbd5ef553c3992703d266bb217a269c6300a5e8b9ff9e254364`.
Tar interior de 133079044 bytes, SHA256
`01f1550768e68adc14d79d49da66223e019244dfb863fadd187a144cbfb37ebe`.
`parts.json` y las ocho partes de hasta 32 MiB conservan ambos archivos íntegros,
sin recomprimir ni descartar sus contenidos. Los manifiestos de miembros completos
están en `replay/node22/extracted-members.json.gz` y su par Node 24.
Nunca ejecutar programas desde el archivo: usar los lectores actuales revisados.

Se verificaron 2048 procesos, 18432 duraciones medidas, 6144 warmup, 24576 Window
y 24576 Document separados, tres rondas por proceso, dos estados finales claros,
baselines nativos, tres snapshots del padre, todas las identidades y 2048 entradas
de progreso más el resultado terminal. Los 599 pins históricos, las 724 fuentes
del método y las 738 del exportador permanecieron intactas. El ELF del candidato
sigue siendo 567f6bff6af92fcd24698b3dbaa6ea7d0d2e4f0001e8083038041fdd0eac7ae7;
no se sustituyó por el ELF del CI ordinario ni se reconstruyeron paquetes.

## Los 64 criterios, incluidos todos los rechazos

El método fijado compara medias aritméticas de nueve duraciones por proceso,
16 pares, con intervalos Fieller puntuales del 95%, t15=2.131449545559323.
Los controles jsdom exigen el intervalo entero dentro de ±2%; Rust AA dentro
de ±5%; Rust AB exige el extremo superior como máximo +5%, sin cota inferior.
La verificación independiente en Python reprodujo los 64 intervalos desde sus
pares con tolerancias numéricas 1e-12, sin modificar la decisión del lector.

Pasaron 20 criterios y fallaron 44. Fallaron 31/32 controles jsdom, 7/16 Rust AA
y 6/16 Rust AB. `criteria.md`, `criteria.csv` y `analysis.json` conservan todos.
No se seleccionan solo resultados favorables ni se construye un índice global.

En Rust AB, Range/control observó cambios puntuales entre -21.90% y -26.02%.
Range/lifecycle observó +5.50% a +6.30%, con extremos superiores de +7.30% a
+9.87%, rechazados en ambos SDK. En Node 22 también rechazaron MutationRecord/100
(+5.44% de extremo superior) y observer-delivery/100 (+15.87%). Los controles
rechazados impiden atribuir causalmente al cambio Rust todas esas diferencias.
Estos resultados fundamentan el rechazo; una mejora puntual no acepta el conjunto.

## Datos y recursos

`metadata/` conserva bindings independientes antes/después del artifact, API,
intención/recibos de activación, logs completos y el index, inventario y manifiesto
originales. `replay/` conserva decisiones, logs y manifiestos de ambos SDK.
`resources/spans.csv` conserva las 24576 duraciones, incluidos los 6144 warmup;
`resources/resources-native.jsonl` conserva todas las familias nativas, baselines,
rondas y propietarios por proceso. Ambas exportaciones son idénticas entre SDKs.
Los memory.json de cada SDK solo difieren en identidad y hash del ejecutable lector.

El exportador mantiene `performanceAccepted=null` y `gateReevaluated=false`:
la decisión completa pertenece al lector de transporte/payload, no al exportador.
El análisis de memoria está en reports/memory/native-class-ownership/combined-process-study/40184510898/.
Conservar los 228 primeros estados no claros. Endpoints finitos no son memoria pico
ni garantía universal de ausencia de fugas; los snapshots del padre no prueban
causalidad ni equivalen al máximo simultáneo de padres e hijos.

## Reconstrucción y replay offline

Reconstruir los dos archivos en una carpeta nueva fuera del repositorio y del
paquete publicado. El lector valida todos los metadatos/partes antes de crear la
salida, rechaza enlaces/junctions/hardlinks y no sobrescribe destinos existentes:

```sh
python tools/materialize.py <repositorio-actual> <este-paquete> <salida-nueva>
```

Usar un checkout Git Linux real y limpio de 95e64bd2 para los replays estrictos,
los SDK oficiales con los hashes registrados, y un destino nuevo por SDK:

```sh
node reports/benchmarks/native-class-ownership/combined-process-study/decision.cjs <binding.results.json> <salida-reconstruida> <decision-nueva>
```

El exit 1 es esperado para este rechazo íntegro; `decision.json` debe indicar
complete=true y captureAuthenticated=true. No normalizar sourceCommit, cambios
Git ni errores de identidad. Los lectores actuales no ejecutan código archivado.

La QA real conserva seis contratos de materialización por Windows/Linux,
reconstrucción byte-idéntica, rechazo de corrupción, protección del destino,
junction Windows/symlink Linux y guarda contra Python optimizado. El primer
rechazo del destino Windows dentro del repo también se conserva, sin cambiar
assertions. `validation/materialization-qa.zip` tiene sus 32 miembros y logs;
`validation/summary.json` registra hashes, comandos y límites. Los replays y el
exportador se probaron con ambos Node fijados; no ejecutaron DOM ni nuevas muestras.

La revisión detectó que importlib podía leer un .pyc por timestamp/tamaño aunque
se validara el SHA del fuente. El lector ahora compila únicamente los bytes
autenticados en ModuleType. La QA final, separada de la inicial, creó caches
reales válidos en árboles aislados de fuentes actuales: el control importlib -B
confirmó su ejecución inocua y el lector corregido reconstruyó los archivos
ignorándolos. Los seis contratos completos volvieron a pasar en ambos sistemas,
con los inputs intactos; materialization-safe-cache-qa.zip conserva los controles,
logs y recibos. No se modificó la captura ni se ejecutó código del artifact.

La revisión también cerró la dependencia transitiva del helper: se fijan y verifican
transport.json, capture.json y protocol.json antes de compilarlo. La QA final
materialization-final-qa.zip conserva nueve contratos por sistema y el control
real de pyc: incluye mutación de cada config y redirección a un helper inocuo con
SHA autodeclarado. Todos se rechazaron antes de crear salida o ejecutar el helper.
Las QA inicial y de cache se mantienen sin reescribir sus recibos históricos.
