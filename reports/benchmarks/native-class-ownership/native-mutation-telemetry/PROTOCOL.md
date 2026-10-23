# Diagnóstico prospectivo de MutationRecord nativo

`native-mutation-telemetry-v1` es un método separado, implementado pero **sin
ejecutar ni autorizar**. El estudio `ownership-shared-fixtures-v1`, run
`40012710923`, terminó rechazado y su autorización se consumió en esa secuencia.
No se repite, amplía, corrige ni convierte en aceptado ese estudio.

Este método necesita publicación, contratos en CI, revisión local íntegra y
autorización humana explícita independiente antes de aplicar su etiqueta.
`captureImplemented=true` expresa capacidad del código; no consentimiento.
No se creó/aplicó la etiqueta ni se inició un workflow de captura.

## Pregunta y evidencia faltante

Node 22 AB `mutation-records-collect/100` excedió +5%, con un control jsdom
también fuera de ±2%. Las trayectorias varían también en AA y no contienen
eventos GC/JIT o perfiles CPU del candidato durante sus spans.
Los perfiles nativos anteriores cubren Range y el candidato `83322767…`,
no esta fila con el runtime actual `5ef668c4…`. El diagnóstico `39959175058`
solo ejecutó jsdom. No hay causa suficiente para modificar Rust a ciegas.

Se busca describir GC, compilación/deoptimización y frames V8 dentro de los
límites originales, distinguiendo operaciones de setup, warmup y cleanup.
La instrumentación altera el contexto. No identifica automáticamente una causa,
no garantiza stacks de funciones Rust internas y no estima una mejora causal.

## Secuencia fija

Se reutiliza el orden de `current-ownership-experiment.cjs`, seleccionando
explícitamente una fila para diagnóstico. No es un estudio de aceptación.

| Factor | Valor fijado |
| --- | --- |
| Fila | `mutation-records-collect/100`, índice 0 |
| Runtimes | Node 22.12.0, después Node 24.14.1 |
| Modos por Node | CPU/GC y después JIT/GC, cada uno con ambas etiquetas |
| Agenda por modo | Orden original completo de AA/AB, jsdom/Rustdom, A/B y 16 posiciones |
| Semillas | 1..16, flags y afinidad originales |
| Procesos | 128 por Node/modo; 256 por Node; 512 en total |
| Cada proceso | 3 warmup + 9 duraciones medidas, sin recortar índices o extremos |
| Warmup dentro del realm | Tres rondas originales; nodos medidos sin pre-mutarlos |
| CPU | Inspector con intervalo solicitado de 100 µs |
| JIT | `--log-code --log-function-events --log-deopt --no-logfile-per-isolate --logfile=v8.log` |
| Relojes | Anchors monotónicos y scripts con nombres propios; incertidumbre de timestamp 1 µs |

Si se completa, se esperan 1536 warmup y 4608 duraciones medidas: 6144 spans,
6144 Window y 6144 Document por separado, 1024 endpoints finales requeridos,
256 perfiles CPU y 256 logs JIT. Son cantidades planificadas, no observadas.
Los modos no se mezclan al comprobar prefijos RNG por fase/posición/motor/label.

## Entradas, derivación e identidad

La preparación es la original de `39906777389`, autenticada por ZIP y tar
contra el recibo publicado. Se conservan los paquetes A0/A1/B/J0/J1 y las
distribuciones completas originales, sin reconstruir ni instalar dependencias.
Los dos ejecutables se autentican por SHA256/version antes del primer worker,
con probe acotado a 10 s, y se vuelven a comprobar después de cada Node.

El runtime `5ef668c47a78bb73ef5b0881fbf20e6d36c4d4cc9686198c26e722d8fc9c6806`,
el grafo congelado de 434 archivos y los 26 pins previos no cambian.
`prepare.py` reutiliza las derivaciones actuales de telemetría y fixtures
compartidos; exige el sampler calificado `d24c7282…` y su patch canónico.
El sampler combinado registra CPU y bordes fuera del reloj original y conserva
el cuerpo, inputs, warmup, hashes públicos, afinidad y teardown de la operación.

Los mapas `derived-code-cpu.json`/`derived-code-jit.json`, versionados fuera de
la captura, fijan los bytes ejecutables/configuración y todos los nombres del
árbol derivado. Un recibo local reescrito no puede redefinir ese código. Se
rechazan archivos extra, enlaces y redirecciones de resolución de módulos.
El recibo de revisión liga método, mapas, workflows y dependencias reutilizadas.

Cada worker conserva `report.json.source.json` con los bytes del sampler y
genera un reporte con revisión/purpose nuevos. El sidecar fija PID, Node,
run/intento/commit, derivación, modo, recursos de observación y errores.
No se presenta un perfil histórico jsdom/Range como nativo nuevo. La lectura
de fixtures históricos exige sus revisiones explícitas y no valida una captura.

## Recursos y límites de tiempo

Cada proceso conserva tres rondas de cleanup, con dos finales claros, doce
observaciones de cada owner y retorno al baseline nativo mediante `isReleased`.
La GC se guarda como escalares; no se retienen targets DOM en esos eventos.
Stop/disable/disconnect de Inspector y desconexión de PerformanceObserver se
intentan independientemente en errores. Se conservan errores y parciales.

Hay un límite de 180000 ms por worker. El colector tiene 110 minutos de presupuesto
y no inicia otro proceso si no queda el límite completo de un worker. El step
de captura tiene 130 minutos y el job 180; archivo/subida tienen 25/10 minutos.
Esto reserva margen operativo, sin garantizar que sobreviva cualquier archivo
a un timeout global, fallo de disco o cancelación del runner.

Se detiene ante el primer error de integridad, worker, recurso, RNG o presupuesto.
Una secuencia parcial sigue parcial; no se repite ni se completan muestras faltantes.
Los snapshots del padre se guardan antes y después de cada Node sin GC forzado.
No son memoria pico, límites universales de retención ni prueba de ausencia de fugas.

## Consumo único y preservación

El workflow solo responde a `ownership-native-mutation-telemetry-v1` en PR #80,
intento 1, sin cancelar una ejecución viva. Consulta todo el historial del repo
para impedir otra ejecución no omitida del mismo workflow y exige contratos
exitosos de ambos Node en el SHA actual, además del recibo local de revisión.
El colector comprueba el evento etiquetado y el HEAD Git real del mismo commit.
No existe una opción de retry, reducción de la agenda o aceptación de rendimiento.

Se archiva el árbol entero, incluidos preparación, fuentes, originales, wrappers,
perfiles, logs JIT, muestras/warmup, spans, GC, errores y resultados parciales.
También se conservan controles de historial/QA y logs del colector. El lector
completo comprueba todos los procesos, ficheros, muestras y estados finales;
rechaza capturas incompletas. Ante un parcial se preserva el transporte íntegro
y se analizan los archivos disponibles sin relanzar.

La futura recolección debe autenticar artifact por ID/run/commit/intento/tamaño/
digest y conservar ZIP, tar, metadata y manifiesto completo. No ejecutar código
desde el archivo. Un replay estricto necesita el checkout Git real y limpio del
commit fuente publicado; no normalizar `sourceCommit/sourceChanges/sourceGitErrors`.

## Validación y alcance

Los contratos usan derivaciones reales y datos históricos autenticados: CPU/JIT
de ambos Node y la calificación funcional compartida. Comprueban agenda, probes,
integridad externa, archivos extra/symlinks, preservación de outputs y rechazo de
contextos locales/reintentos, sin ejecutar DOM ni profiling nuevo.
Las corrupciones son solo casos negativos, no muestras positivas fabricadas.

El entrypoint del replay es `run.cjs --verify <capture>` y usa código del checkout
actual revisado, no scripts archivados. `--preflight <preparation>` solo autentica
datos/archivos. El código fuente preparado no se ejecutó para calificar esta fase.
El profiler nativo end-to-end y un replay positivo de sus 512 procesos siguen sin
validarse; no se infieren a partir de perfiles jsdom ni de contratos de rechazo.

La salida del diagnóstico es `performanceAccepted=null`, `gateReevaluated=false`.
Un exit 0 solo indica diagnóstico íntegro, no presupuesto aprobado. Se conservan
relojes inciertos, deltas CPU negativos, eventos desconocidos, regresiones y
controles rechazados. Nada se añade a un A/B no instrumentado ni cambia sus
presupuestos/estimador. El runtime continúa híbrido; no hay tag ni merge con
ownership rechazado y el objetivo completo de migración sigue pendiente.
