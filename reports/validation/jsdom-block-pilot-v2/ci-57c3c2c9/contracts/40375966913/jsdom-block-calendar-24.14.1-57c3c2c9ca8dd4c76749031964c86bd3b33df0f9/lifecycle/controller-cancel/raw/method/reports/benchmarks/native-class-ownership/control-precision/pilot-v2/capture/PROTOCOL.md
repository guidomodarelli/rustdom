# Piloto prospectivo de bloques jsdom — v2

## Corrección de preparación frente al v1 consumido

El run original 40366685759, intento 1, fuente 1078e4fd, falló en los 32
criterios al crear `inputs/` después de que el snapshot copiara allí el paquete.
Se conservaron los 33 artifacts, sus ZIP y tar, todos los logs y 64 replays
parciales. No inició workers de benchmark ni produjo muestras. Ese run y el
método v1 están consumidos; no se relanzan ni se completan sus datos faltantes.

Este sucesor tiene código, workflow, etiqueta y publicación independientes.
Crea `inputs/` y `workers/` una vez, antes del snapshot. Los modos funcional y
captura comparten esta preparación y ambos copian el paquete y grafo reales.
La calificación ejecuta bloques jsdom con ese mismo coordinador y verifica
los archivos producidos. Cambia únicamente la preparación y su cobertura;
conserva filas, calendario, factores, semillas, warmup, estimador y presupuestos.

Se prepara con `executionReady=false`. La habilitación exige revisión aislada
y calificación del SHA publicado, cubiertas por la autorización permanente.

Este piloto estudia la dispersión de controles jsdom. No mide ni acepta el
rendimiento del candidato Rust. `performanceAccepted=null` y
`gateReevaluated=false` son invariantes, incluso con una colección completa.
Ownership conserva los rechazos históricos y el runtime sigue siendo híbrido.

## Fuente y habilitación

La autorización permanente proviene de `AGENTS.md`. No requiere otra pregunta.
Antes de activar la única secuencia se publica y revisa el método íntegro,
se comprueban los artifacts y replays reales del CI del mismo SHA y se guardan
sus identidades y resultados. Deben aprobar los cuatro jobs del workflow de
calificación y los ocho del CI general. El preflight vuelve a comprobar los
últimos runs de ambos workflows y todos sus jobs originales antes del label-run.
Los verdes anteriores no califican bytes agregados después.

`capture/files.json` fija código, pruebas, workflows, este protocolo, política
de autorización y los 32 criterios. `capture-method/review.json` contiene el
catálogo completo, incluido el hash del catálogo, y la revisión local aislada.
Se requieren `executionReady=true`, `completeMethodReview=true` y cero
hallazgos accionables en la publicación. La fuente es un Git Linux real limpio;
se conservan HEAD, cambios y errores originales. El schema raw reutilizado
identifica su contrato, no atribuye el productor a un estudio histórico.

Los 850 pins del v1 se comprueban sin modificarlos. Incluyen los 786 anteriores,
sus métodos,
dependencias y grafos anteriores. El paquete sellado es el artifact 12628261403:
ELF `a2777cbf00baa2cc7aa67c1098d6a5ceba4009aa6e514d558aac0b304e7ea583`;
tar `fb06276a9fb0510360b4a0cf804699b2554303c3f80cf164fcd60f3f443aa72d`.
No se instala ni reconstruye ese paquete. Solo se ejecuta jsdom 27.4.0 en este
piloto; autenticar un ELF no significa haberlo ejecutado.

Node 22.12.0 y 24.14.1 tienen hashes de ejecutables fijados en `constants/capture.json`.
Las actions del workflow científico se fijan por commit. Se conservan hardware,
kernel, SDK, flags, afinidades, semillas, procesos y relojes originales. No se
agrupan hosts ni SDK para producir una estimación común.

## Una única secuencia

Workflow `.github/workflows/jsdom-block-pilot-v2-capture.yml`, evento
`pull_request/labeled`, PR #80, etiqueta `ownership-jsdom-block-pilot-v2`, intento 1.
La concurrencia es global al método y `cancel-in-progress=false`.
La ventana fija de activación es 2026-10-26T12:00:00Z–2026-10-28T00:00:00Z.
No se extiende tras publicar el método. Es una ventana de creación del run,
no un permiso para reiniciar procesos ni para cortar una observación tardía.

`once.cjs` consulta el historial completo del repositorio, acotado a menos
de 1000 runs, hasta la creación del run actual. Comprueba el mismo path global
entre commits y branches. Solo puede ignorar un intento 1 concluyentemente
omitido. Fallos, parciales, cancelaciones ambiguas y ejecuciones anteriores
consumen el método. Un run posterior todavía en cola no puede entrar mientras
el actual posee la concurrencia global. Historial truncado o inconsistente
impide empezar. Los responses API originales se guardan por separado, sin
duplicarlos dentro del recibo acotado del controller.

Un job de preflight, sin DOM, publica el recibo y su digest. Los 32 jobs reciben
el ID de artifact y el digest mediante outputs del controller. Padre y worker
exigen que ese recibo sea del mismo run/head/intento y corresponda a la fuente
revisada. El sidecar no autentica su propia fuente ni transporte.

No relanzar workflows, reaplicar la etiqueta, agregar procesos, completar
muestras, sustituir un host, cambiar semillas, filas, warmup, instrumentación,
estimador o presupuestos. Un error de observación se resuelve consultando el
mismo handle. Una captura fallida o un resultado desfavorable no habilitan otra.

## Calendario y unidades

Son ocho filas originales × dos SDK × AA/AB = 32 criterios independientes.
Cada criterio pertenece a un solo padre/host y contiene 16 bloques completos.
Cada bloque conserva los 16 factores originales y sus dos labels:32 procesos
nuevos por bloque,512 por criterio y 16384 en total.

El factor de una posición es `(slot + block) % 16`. Semillas, flags, selección
física y lead A/B dependen del factor original, nunca de su slot temporal.
Los mismos factores conservan el mismo prefijo RNG entre labels y bloques.
No se superponen procesos dentro de un criterio ni se reemplaza un fallo.

Cada proceso conserva 12 realms, 48 tareas de warmup y 144 medidas:73728 duraciones
medidas y24576 warmup por criterio. La colección completa contiene2359296
duraciones medidas,786432 warmup,196608 Window y196608 Document separados,
49152 estados de cleanup y32768 estados finales claros. Tres snapshots del
padre por criterio suman96. No sumar estas unidades como una misma dimensión.

El modo funcional ejecuta un bloque,32 procesos por criterio, con
`analysisObservation=null`. Sus raw permanecen funcionales aunque se cambie
la petición al lector. La calificación heredada adicional cubre las ocho filas,
16 positivos y seis adversos por SDK. Las épocas privadas y publicadas se
identifican por sus Git reales; no se mezclan para aumentar muestras.

## Estimación fijada

Cada proceso aporta la media aritmética de sus 144 duraciones originales.
Cada bloque aporta 16 procesos A y 16 B y los contrastes `B - q*A` para
q=0.98, 1, 1.02. Se conservan todos los bloques, medias y contrastes.
Los intervalos de SD usan 15 grados de libertad y el modelo de trabajo iid
normal a nivel de bloque completo. Son puntuales por contraste, no simultáneos.
SD observada cero es inconclusa; no demuestra varianza poblacional cero.

La autocorrelación de lag 1 y pendiente temporal son diagnósticos descriptivos.
No prueban independencia ni causalidad. No se estima potencia ni se aprueba
un tamaño de confirmación por haber observado un contraste favorable.
Las referencias numéricas y cuantiles fijados permanecen en `constants/variance.json`.
Los presupuestos históricos ±2%/±5% no cambian; este piloto no reevalúa su gate.

## Plazos y procesos

Cada job dispone de 200 min: setup 10, captura 170, archivo 10, upload 5 y margen 5.
El registro de uptime del primer step, antes del checkout, delimita el setup
controlado. El padre emite un marcador inmutable de inicio después de autenticar
fuente/paquete y copiar snapshots. El watchdog comparte ese hito y concede los
170 min completos. `/proc/uptime` se registra como un intervalo de 0.01 s; su borde
superior evita recortar al padre por cuantización. El reloj propio del padre
sigue exigiendo `elapsedMs <= 170 min` para un resultado completo.

Cada worker tiene un máximo de 180 s, acotado además por el tiempo restante.
`supervise.py` se registra como subreaper Linux antes de lanzar Node. Adquiere
el journal exclusivamente antes de iniciar al productor. SIGTERM/SIGINT cancelan
la secuencia; una muerte forzada de Node no deja a sus workers separados sin
controller. Solo se señalizan descendientes reales observados por PID y
startTicks, nunca PIDs leídos de un archivo archivado. Gracia 15 s y reap 5 s
consumen parte del margen del job. Un descendiente activo inesperado o un plazo
agotado invalida la finalización aunque las tareas guardadas sean correctas.

La calificación funcional prueba cancelación del controller, muerte forzada
de Node y recolección de un worker ya zombi. Solo en este último test se detiene
temporalmente el padre con SIGSTOP para observar el estado zombi real antes de
SIGKILL. No se modifica ni instrumenta el worker. Los tres casos deben conservar
parciales, terminar con exit 2 y dejar cero descendientes propios. Un zombi
recolectado no se declara falsamente como worker activo.

El watchdog hace polling de estado, sin leer `/proc` en cada tarea normal.
Su trabajo es parte del entorno observado. No se presupone que su costo sea
nulo. Los fallos extremos del runner pueden dejar artifacts parciales o
ausentes; se conservan también API y logs, sin convertirlos en muestras completas.

## Archivo y replay

Tras detener el productor, `archive.py` conserva cada archivo, incluidos `.next`,
logs, warmup, muestras y parciales, y añade un inventario completo. Usa USTAR
dentro de gzip: solo archivos físicos independientes, sin links, extensiones
PAX/GNU, dispositivos, aliases o traversal. Límites: 2 GiB totales, 256 MiB por
miembro, 20000 entradas y paths de 255 bytes. Los headers se acotan antes de leer
un cuerpo. El inventario no autentica su propio transporte.

Se autentican artifacts mediante ID/run/head/intento/nombre/tamaño/digest API.
Se conservan ZIP íntegro, tar íntegro incluido en él, responses API, logs y todos
los manifiestos. Una representación por partes debe reconstruir exactamente
los hashes originales; no omitir controles rechazados ni informes negativos.

El replay utiliza únicamente código actual revisado y una expectativa de
fuente/criterio obtenida independientemente del raw. Nunca ejecuta código
archivado ni importa módulos de la captura. Comprueba las 512 posiciones,
PID/padre/SDK, argv, orden temporal, bindings, outputs, recursos, snapshots,
inventarios y análisis recalculado. Los métodos copiados se leen como datos;
referencias binarias publicadas conservan su identidad y el paquete medido
se incluye íntegro. Los readers declaran su alcance y no inventan autenticación.

Ejemplo de lectura, con expectativa externa ya autenticada:

```
node capture/verify.cjs datos expectativa-externa.json resultado-nuevo.json --allow-partial
```

Un parcial devuelve `complete=false`, sin análisis que aparente cobertura total.
Un rechazo de integridad se registra y conserva. Se prueban lectores y replay
offline con ambos Node sobre los mismos bytes; las reparaciones del lector
preservan versiones/resultados anteriores y nunca vuelven a ejecutar el DOM.

## Recursos y límites de interpretación

Se observan Window y Document por separado, tres rondas y dos estados finales
claros por proceso. Las primeras rondas no claras se publican. El baseline
nativo es `null` para jsdom, no un contador Rust artificialmente cero.
Se conservan memoria y CPU originales, incluidos deltas negativos o relojes
inciertos, con su alcance. Los snapshots no miden memoria pico. Pruebas finitas
no demuestran ausencia universal de fugas ni ausencia de retención del allocator.

La colección completa requiere los 32 criterios; los incompletos no se rellenan
ni se esconden mediante selección. Cada resultado se interpreta dentro de su
SDK/criterio/host. La migración general sigue pendiente después de este piloto;
no crear tag ni merge mientras ownership no tenga rendimiento aceptado.
