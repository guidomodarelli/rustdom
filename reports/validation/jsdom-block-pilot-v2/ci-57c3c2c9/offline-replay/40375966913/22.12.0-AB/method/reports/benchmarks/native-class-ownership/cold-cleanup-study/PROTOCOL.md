# Estudio prospectivo de limpieza fría

Este método propone una única secuencia nueva sobre el candidato aislado.
No autoriza ejecutar muestras. Primero deben aprobar el código, la revisión
local aislada y los contratos del SHA publicado en ambos Node. Después se
solicita autorización humana independiente para ese SHA y sus 2048 procesos.
La etiqueta `ownership-cold-cleanup-v1` solo se aplica una vez tras recibirla.
Las autorizaciones históricas están consumidas; sus rechazos permanecen.

## Hipótesis y tratamiento

El guard conserva el ownership de construcciones N-API fallidas. El candidato
solo agrega `cold` e `inline(never)` al destructor de valores pendientes.
La reducción estática de código publicada no demuestra una mejora temporal.
La hipótesis es que separar esa limpieza excepcional reduce el costo del
camino habitual; este estudio puede rechazarla. No se deduce una causa del
diagnóstico CPU/GC/JIT anterior ni se atribuyen stacks internos Rust a V8.

Se usan exactamente los cinco paquetes del run 40065437939, intento 1,
artifact 12549521134, fuente de preparación f559d37a. El lector de transporte
fija ZIP, tar, identidad, fuentes, distribución y probes originales. A0/A1
conservan el baseline 3d37f899 con addon 1c46896c. B conserva las fuentes
5273aae0 del checkout 8dba217b más el patch d869ec4a y addon de CI 0a949fb3.
J0/J1 son copias independientes de jsdom 27.4.0. No se reconstruyen paquetes
ni se elige un artifact posterior. Las suites completas de B en Linux/Node22
y Node24 están publicadas en 4aba8018; la validación local de 9bab7909 se
mantiene aparte. El runtime sigue híbrido y el candidato no está integrado.

El arnés conserva la identidad de fuentes primarias 5ef668c4. Es código de
control: la implementación Rust ejecutada por B se autentica aparte, con
fuentes 5273aae0 y el ELF 0a949fb3 de la preparación. El commit del método,
el commit base de la implementación y el hash del árbol modificado son
identidades distintas; no se igualan ni se sustituyen sus campos.

## Diseño congelado

Se reutilizan el scheduler, el sampler, los fixtures compartidos y el
estimador ya publicados. Solo cambian la identidad del estudio y los hashes
del candidato y su preparación. Se mantienen CPU 2 para el hilo principal,
afinidades de los demás hilos, ocho filas, orden y factores balanceados,
fases AA/AB, dos motores, dos labels y semillas V8 1 a 16. No se selecciona
un subconjunto ni se agregan procesos, semillas o muestras.

Por cada Node se ejecutan 1024 procesos; ambos suman 2048. Cada proceso
conserva tres duraciones de warmup y nueve medidas: 6144 y 18432 en total.
Se mantienen tres rondas de warmup dentro del realm, GC antes de ese warmup,
los relojes y spans originales, tres rondas de cleanup y dos estados finales
claros requeridos. Window y Document se observan por separado: 24576 de cada
tipo si la secuencia completa llega al final. Los baselines nativos se
conservan por proceso; hay tres snapshots del padre.

Se reutiliza la mediana combinada original. Los controles jsdom deben quedar
en ±2%, Rust AA en ±5% y Rust AB no superar +5%, en todas las filas y ambos
Node. El rechazo de un control sigue rechazando la decisión. Se publican
todas las filas, también las desfavorables. Un rechazo no permite otra
secuencia, modificar presupuestos ni repetir una captura.

Node 22.12.0 y 24.14.1 se autentican por hashes de ejecutables antes de iniciar
ambos. El host es Ubuntu 22.04/Linux x64, glibc 2.35, y conserva las restricciones
de entorno originales. Cada worker tiene timeout de 180000 ms; el job tiene
180 minutos, incluyendo preparación y conservación; el step de captura tiene
175 minutos para reservar margen de archivo dentro del job. Este límite
operativo se declara antes de cualquier ejecución; los presupuestos numéricos
de regresión siguen iguales. Si un timeout o error
impide completarlo, se archiva el parcial sin completar muestras faltantes.

## Derivación y lectura

Los 434 archivos del arnés y los 26/46 pins históricos permanecen intactos.
Se autentican los bytes del manifiesto independiente y el digest canónico de
sus entradas. La derivación actual reutiliza el productor revisado, conserva
sus receipts y cambia el wrapper exterior y los settings declarados. El
sampler interno conserva SHA d24c7282; solo se deriva la copia, sin editar
fuentes congeladas. El prefijo Python de bytecode se dirige a una ubicación
inexistente y se impiden escrituras de caché para evitar sustituciones de
productores transitivos por `.pyc` previos.

`study.cjs --plan` expone el plan completo. `--preflight <preparación>` solo
autentica datos y código: no deriva ni carga DOM. `--capture` se restringe al
workflow nuevo, al repositorio declarado y al intento 1; exige publicación
revisada y QA del SHA actual. El guard consulta todas las páginas de runs y
rechaza cualquier otra ejecución no omitida de esta revisión del workflow.
Un fallo transitorio no autoriza reiniciar ni reaplicar la etiqueta.

`--verify <capture>` reproduce la decisión leyendo todos los reportes y
hashes con código actual revisado, nunca ejecutando código archivado. Debe
usarse un checkout Git Linux real del método y los Node fijados. Se conservan
`sourceCommit`, `sourceChanges` y `sourceGitErrors` reales del arnés y la
preparación; no se falsean para hacer pasar el replay. La autenticación del
artifact exterior por run/job/commit/intento/nombre/tamaño/digest precede a la
lectura cuando se recolecten resultados.

## QA y límites

Los contratos usan paquetes auténticos, la derivación real y los datos crudos
del estudio histórico rechazado. Comprueban identidad, invariantes, rechazos,
cache hostil, tratamiento completo y reproducción numérica del estimador.
Los datos históricos no se relabelan como resultados del candidato. Las
pruebas offline no certifican una futura ejecución completa: no ejecutan el
sampler nuevo ni producen mediciones del candidato.

Se conservan ZIP, tar, metadata API, logs, código/método, manifest completo,
todos los warmup y muestras, y parciales aun ante rechazo o fallo. Los
recursos se publicarán en reports/memory/ y los resultados en reports/benchmarks/.
Se publicarán primeras rondas no claras y todos los endpoints. Los snapshots
no prueban memoria pico ni ausencia universal de fugas, y la retención del
allocator no se clasifica automáticamente como fuga. La aceptación, si
ocurre, corresponde solo a este estudio íntegro y requiere integrar su
evidencia al gate con pruebas y revisión antes de mergear; no borra los dos
rechazos históricos ni completa la migración a Rust.
