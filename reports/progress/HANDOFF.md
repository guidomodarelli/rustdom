# Continuar rustdom en otra máquina

## Actualización: launcher de optimización calificado, captura pendiente

`reports/benchmarks/native-class-ownership/optimization-log/` conserva el
launcher, settings y contratos. Ocho tests pasaron en Linux con Node22/24
y Windows con Node24. El preflight completo de ambos Node pasó, verificó
las387 fuentes originales y preparación antes/después, sin ejecutar DOM o
tracing ni consumir el marker. Fuente original y sampler permanecen intactos. El hashing es por bloques
de 1 MiB; el control real de 16 MiB confirma hash igual y pico de heap del
helper reducido de 16.782.237 a2.102.646 bytes, sin afirmar mejoras del DOM.

Evidencia en `reports/validation/native-class-ownership/optimization-log-method/`,
con crudos, snapshots y tandas previas. Raíz local final
`/tmp/rustdom-optimization-method-67qtetar`, terminal. Su inputs.json referencia
el harness congelado en la extracción independiente y el manifest local
validado. No reconstruir, reinstalar o derivar otra copia del sampler.

Siguiente: autenticar el commit publicado y las seis fuentes de run.py --sources,
generar recibo y ejecutar una sola vez --capture según OPTIMIZATION-PROTOCOL.
Guardar el handle; no reiniciar por silencio. Son cuatro procesos jsdom,
32 lotes y384 ejecuciones incluidas las96 warmups. El worker original solo
conserva288 duraciones medidas; no inventar intervalos o tiempos de warmup.
El marker exclusivo .cache/optimization-log-capture.started.json impide otra
captura desde este checkout. No borrarlo para reintentar. Ante un error,
conservar todo lo parcial. No hay aceptación, merge/tag o crédito Rust nuevo.

## Histórico: identidades por Window (launcher preparado posteriormente)

La observación sin temporizadores pasó en J0/J1 oficiales, Node22.12.0 y
24.14.1: cuatro procesos y48 Windows. En cada proceso Range y cinco métodos/
getters observados tuvieron doce identidades; JSDOM/Object una. Los endpoints
finales de Window/Document quedaron claros en la prueba finita. Las387 fuentes
congeladas se autenticaron y la preparación completa quedó idéntica antes y
después de cada Node. Dos CLIs sin --expose-gc rechazaron como corresponde.

Fuentes y receta prospectiva: `reports/benchmarks/native-class-ownership/window-identities/`.
Crudos y fuentes: `reports/validation/native-class-ownership/window-identities/`.
Límites de memoria en el informe equivalente de `reports/memory/`.
Raíz local `/tmp/rustdom-window-identities-qualified-ha9snove`, terminal.
No se midió rendimiento ni se observaron deoptimizaciones en este probe;
identidades diferentes no prueban código compilado diferente ni causa del
rechazo de Azure. No aceptar presupuestos o aumentar warmups con este dato.

Siguiente: fijar, probar, publicar y revisar el launcher de la nueva receta de
trace-opt/trace-deopt antes de su única captura. Usará el worker original
congelado sin cambios y cuatro procesos jsdom; no relanza tracing nativo ni
ensayos anteriores. El ensayo de suites ya publicado en2896d90b permanece
aceptado para ese alcance. Los microbenchmarks siguen rechazados; ownership
abierto, sin merge/tag ni integración del inventario separado.

## Actualización: ensayo de suites completas terminado y aceptado

La única captura de la receta publicada en `a10e7a04` terminó con exit0:
342 CLIs, 54 warmups y 288 mediciones, 10.602 ejecuciones de tests, doce filas
aceptadas con A/A calibrado en Node22.12.0 y24.14.1. Los verificadores congelados
Linux Node22/24 y Windows Node24 coinciden; el recálculo Python independiente
también, en Windows/Linux. Diez contratos del lector (cinco por plataforma)
rechazan checksum, ledger, decisión e inventario de fuentes alterados sobre
copias conservadas.

Resultados y muestras crudas:
`reports/benchmarks/native-class-ownership/runner-suite-timing-results/`.
Tar completo, índices, fuentes, logs y replays:
`reports/validation/native-class-ownership/runner-suite-timing-study/`.
Informe de límites de memoria del mismo nombre en
`reports/memory/native-class-ownership/`. Se observaron 912 asignaciones Range,
no su liberación individual; no es una prueba adicional de ausencia de fugas.

Raíz local `/tmp/rustdom-runner-suite-timing-8wamjxj2`, session10111/PID421662
terminal; replay session63028 también terminal. No relanzar la captura. Los
contratos de lectura están en `/tmp/rustdom-suite-timing-reader-D6hTNPBZ`.
La preparación y las 79 fuentes mantuvieron su identidad; no se reconstruyeron
addons ni se reinstalaron dependencias. Las doce filas y los aumentos de Jest
permanecen publicados, sin selección de resultados.

Este entregable cierra la medición pendiente de tiempo completo de estas
suites. Los microbenchmarks anteriores continúan rechazados por seis controles
jsdom sin calibrar; ownership sigue abierto, sin merge/tag ni crédito nuevo de
migración. Siguiente: seguir CI y review del SHA publicado y resolver el bloqueo
de calibración con la evidencia existente, sin repetir ensayos consumidos ni
cambiar retroactivamente sus presupuestos. Inventario4c09 permanece separado
hasta cerrar ownership.

## Histórico: método calificado antes del ensayo (superado)

Este bloque registra el estado anterior a la captura. Está superado por el
ensayo terminal del encabezado: no seguir sus próximos pasos ni relanzarlo.

Se agregó `reports/benchmarks/native-class-ownership/runner-suite-timing/`.
La receta fija 342 CLIs: 54 warmups y 288 mediciones de Jest/Vitest/VM,
con A/A y A/C, Node 22.12.0/24.14.1, doce tiempos por celda y decisión de
doce filas. Todavía no se ejecutó el ensayo formal. El resultado anterior
de microbenchmarks sigue rechazado y ownership sigue abierto, sin merge/tag.

El ejercicio final pasó 18 CLIs/558 tests, 13 tests del método y cinco
contratos de replay por Node Linux. El replay congelado también pasó en
Node 24.14.1 nativo Windows. Se corrigieron cuatro P2 de revisión y se
preservaron fuentes previas, ejercicios y reproducción del fallo Windows.
Ver evidencia, índices, archive y lector en
`reports/validation/native-class-ownership/runner-suite-timing-method/`;
los límites de memoria están en el informe del mismo nombre en
`reports/memory/native-class-ownership/`.

Raíz local `/tmp/rustdom-suite-timing-method-llt4lx03`, final en
`exercise-portability`. Todas las ejecuciones de calificación son terminales.
Preparación fija `/tmp/rustdom-runner-suites-ytu9q4xb/static-prepared`,
índice SHA-256 `cc7d36f1e702c27935c8ed49afe7da280ca760adcb17be45a2db6bc735b845fc`.
No reconstruir addons ni reinstalar dependencias para el ensayo.

Siguiente paso: autenticar en Git/GitHub el commit publicado y los 79 archivos
de `study.cjs --sources`, generar recibo y ejecutar una sola vez el CLI formal
según `PROTOCOL.md`. Registrar su handle y conservar resultados completos o
parciales; no relanzar por silencio, timeout del observador o rechazo de límites.
Durante la captura no correr builds, tests, reviews ni compresión en este host.
El CI general del último SHA publicado `53b4d225` terminó verde en Linux,
Windows y macOS (run 39768757722); el check ownership sigue fallando por la
evidencia de rendimiento anterior. No hay nuevo crédito de migración Rust.

## Actualización: arnés de suites completas calificado, sin ensayo de tiempo

Se agregó `reports/benchmarks/native-class-ownership/runner-suites/` para el
entregable pendiente de medir tiempo total de Jest/Vitest. La calificación
completó doce CLIs A0/B en Node22.12.0/24.14.1: Jest23, Vitest34 y VM36 por
paquete/Node, 372 tests en total (356 originales y16 probes de procedencia).
También pasan ocho contratos del arnés. Se observaron dos asignaciones de
Range por probe y el módulo del paquete seleccionado; no se midió su liberación.

Los addons siguen siendo los oficiales, sin builds nuevos. npmci instaló los
runners desde lockfile fijado y los archivos de producción comparados siguen
idénticos. La preparación anterior no contenía la suite completa: se fijaron
sus nueve archivos y tres configs desde Git eaeca4af, iguales a checkpoint067.
También se corrigió un import dinámico de config que Vite trasladaba a su
carpeta temporal. Ambos fallos y fuentes históricas se conservan.

Crudos, fuentes, dependencias y recibos están en
`reports/validation/native-class-ownership/runner-suites-qualification/`;
el informe de límites de memoria, en el archivo de nombre equivalente en
`reports/memory/native-class-ownership/`. Raíz local:
`/tmp/rustdom-runner-suites-ytu9q4xb`, estado final en static-prepared,
static-contracts y static-qualification. Todas esas ejecuciones son terminales;
no relanzar por silencio o archivos de los fallos anteriores.
El readback verificó 15.298 inputs y la extracción en otra raíz pasó el
verificador sin ejecutar suites. Se conserva también el primer fallo del
lector de enlaces y su corrección, sin cambios a los crudos.

Siguiente paso: publicar/revisar el arnés y después definir una receta completa
para el ensayo de tiempo total (orden, replicación, estimador, presupuestos,
identidad y errores) antes de medir. No existe todavía un CLI de aceptación
de tiempo total. Las calificaciones no son muestras de rendimiento. Los
microbenchmarks siguen rechazados y no se reemplazan por este nuevo entregable;
ownership permanece abierto, sin merge/tag ni nuevo crédito de migración.
CI58650e58 terminó verde (run39762878895); CI81ed78cb también terminó
verde con ocho checks (run39764082821). Verificar el CI de cada SHA nuevo.

## Actualización: sensibilidad offline de los controles

La evidencia parcial del tracing ya se publicó en `58650e58`, con crudos,
fallo de Node24, lector, replay Windows/Linux y revisión independiente sin
hallazgos. Su CI general corre en run39762878895; no confundirlo con el CI
ya aprobado de `4e1e66c1`. No relanzar capturas ni ensayos consumidos.

`reports/benchmarks/native-class-ownership/control-sensitivity/` conserva un
diagnóstico exploratorio de las 32 filas jsdom del ensayo 39735778846. Lee
9.216 duraciones de 128 procesos y recalcula la razón de medianas agrupadas;
después elimina cada pareja de posición únicamente dentro de 512 escenarios
descriptivos. Cuatro de los seis controles fallidos siguen fuera de ±2% en
todos sus escenarios; dos pueden cruzarlo, igual que siete filas que pasan
en el resultado original. No se elimina ningún dato del ensayo ni se cambia
su decisión `accepted=false`. No es confianza, potencia ni prueba de causas.

Diez tests por Windows/Linux, incluidos tres contratos sobre copias reales,
y el replay de las 32 filas pasaron. Los resultados son byte-idénticos y los
inputs coinciden con `58650e58`. Ver validación del mismo nombre. No hay
nuevas mediciones, código DOM migrado ni evidencia adicional de ausencia de
fugas. Investigar la variación persistente antes de fijar otro contraste;
no asumir que descartar una posición o aumentar warmups lo resuelve.

## Actualización: evidencia parcial preservada y revisada

El tar íntegro de la captura parcial está en
`reports/validation/native-class-ownership/compilation-diagnostics-partial/`,
14.218.708 bytes, SHA-256
`d9e93f17000dd674c27d5515bd749a76945f2f11b4e8c4a1d5539b2c77a9eafd`.
El lector, análisis por intervalo y resumen están en
`reports/benchmarks/native-class-ownership/compilation-diagnostics-results/`;
el informe de recursos, en `reports/memory/native-class-ownership/compilation-diagnostics-partial.md`.
Son evidencia de diagnóstico, no aceptación del hito ni migraciones nuevas.
El CI general de `4e1e66c1` terminó verde (run39757410705, ocho checks);
ownership sigue rechazado (run39757410643). No merge ni tag.

La revisión independiente del paquete final terminó con cero hallazgos
accionables. El verificador offline y la reproducción desde el tar en Windows
pasaron; el JSON coincide con Linux y la diferencia de bytes es solo LF/CRLF.
La lectura y preservación indicadas como siguientes pasos en el estado
histórico inferior ya se completaron. Seguir investigando los controles de
rendimiento con los datos existentes antes de definir otro contraste; no
repetir esta captura ni los ensayos consumidos.

## Histórico: estado al terminar la captura parcial por SIGSEGV

El orquestador y sus seis fuentes se publicaron y cotejaron en `4e1e66c1` antes
de ejecutar. Se hizo una sola invocación, sesión75648 terminal, launcher exit2.
Raíz `/tmp/rustdom-native-compilation-ysdkpsaf`, datos en `capture/`. NO relanzar
el CLI ni los procesos anteriores por tener un archivo incompleto.

Nueve procesos exit0; el último J0/jsdom Node24.14.1, PID370845, terminó por
SIGSEGV. El índice conserva complete=false, accepted=null y la ausencia del
after normal de preparación Node24. El último report conserva un lote completo
y el siguiente iniciado sin spans persistidos; no hay trace nativo de ese proceso.
La telemetry quedó solo en su header inicial y no representa cero GC observado.

El kernel registró RIP0xa68b6a; addr2line sobre el ejecutable exacto ELF EXEC
resuelve `node::tracing::NodeTraceBuffer::AddTraceEvent(unsigned long*)`.
SHA-256 binario bf9112eb83a827dc9f9c8d19bb7bddcbf00f7b2fedae18fdcaee05406981f20a.
El último check de módulos cargados contiene solo J0, ninguna copia Rustdom.
Esto localiza la instrucción observada, no prueba una causa raíz ni aporta un
backtrace nativo completo. Se conservan kernel, símbolos, disassembly y fuentes.

Se hizo una verificación de solo lectura después del fallo: seis fuentes,
390 partes derivadas y preparación oficial siguen idénticas. No se rellenó
retroactivamente el after faltante del índice. El postproceso distingue los diez
procesos, conserva 876 spans registrados, de los cuales 864 tienen eventos
nativos disponibles; doce tienen eventos desconocidos y 84 spans planificados
no están registrados. Algunos pudieron ejecutarse antes del crash: no contarlos
como ceros ni afirmar que no se ejecutaron. Ningún subconjunto acepta rendimiento.

En los nueve procesos completos se observan eventos de OptimizeCode/finalización
en intervalos medidos tras tres warmups. No identifican funciones ni prueban que
expliquen el rechazo Azure. El lector tiene siete casos numéricos y conserva
eventos de duración cero, fases no completas y el envelope observado de reloj,
sin presentarlo como límite universal. Datos/análisis pendientes de cierre y
publicación de evidencia; no repetir mediciones. Ownership sigue abierto.

Siguiente paso: revisar la lectura parcial y preservar el artefacto íntegro,
incluido el fallo, con snapshots y hashes. Investigar el mecanismo sin volver
a ejecutar esta captura ni atribuirlo al guard Rust sin evidencia. No merge ni
tag. Inventario `4c09d1bd` permanece separado.

## Histórico superado: preparación del orquestador antes de la captura

Esta sección describe el estado anterior a `4e1e66c1`. La captura ya terminó
parcialmente por SIGSEGV; prevalecen las instrucciones del encabezado. No
ejecutar el siguiente paso histórico.

`compilation-diagnostics/run.cjs` comparte `command.cjs` con los contratos DOM.
Verifica 390 partes derivadas contra recibo independiente fijado por SHA, coteja
seis fuentes con recibo que el operador autentica en Git/GitHub, fija las dos
versiones Node y los diez tratamientos, preserva logs/índice/error y se detiene
sin reintentos. Copia fuentes/recibo y revalida fuentes y preparación tras cada
Node. La autenticación remota no se deduce de un JSON ni de verifySources solo.

Seis casos por Node22/24 pasan, incluidos procesos reales exit7 y JSON inválido
tras exit0, sin mocks; no ejecutan DOM. Con el comando compartido pasaron cuatro
procesos DOM/32 cargas/384 spans. Las tres fuentes de comando permanecen iguales;
se reutiliza esa evidencia después del delta de documentación/copia/revalidación
de main, y se repitieron los seis casos sobre las seis fuentes finales. La
revisión independiente final no encontró hallazgos. Aún no se ejecutó main completo.

Evidencia en `reports/validation/native-class-ownership/compilation-orchestrator/`,
benchmarks y memoria equivalentes. Raíz local:
`/tmp/rustdom-compilation-orchestrator-uyseygat`. Memoria DOM: 384 referencias por
tipo, 96 observaciones, 64 finales claras y dos iniciales aún no claras conservadas.
Sin nuevas suites de producto ni builds porque no cambia el runtime.

Paso histórico ya ejecutado (no repetir): publicar/cotejar los seis archivos del método y generar
recibo `{commit, files}` con hashes relativos al directorio compilation-diagnostics;
invocar una sola vez el CLI del protocolo con copia instrumentada verificada,
preparación oficial, recibo, output nuevo y binarios Node22/24. Conservar el
proceso vivo por su handle, no relanzar por silencio/timeouts de observación.
La captura de diez procesos terminó parcialmente; consultar el encabezado. No repetir capturas previas.
Ownership sin aceptación; inventario `4c09d1bd` separado, sin merge ni checkpoint.

## Actualización: posiciones leídas, tracing nativo validado antes de capturar

Se completó la lectura de primeros/últimos bloques de los 80 lotes de la captura
`2af7a05c`: 160 bloques y todos sus frames por source location están en
`reports/benchmarks/native-class-ownership/sampler-diagnostics-results/2026-10-22/position-comparison/`.
El input original y sus 960 intervalos permanecen sin modificaciones. No hay
nueva decisión de rendimiento ni una dirección universal de variación. La
inspección de los diez perfiles confirma que no contienen metadata de tiers o
eventos de compilación; no puede deducirse JIT de sus pocos ticks hoja.

El nuevo protocolo de observación nativa está en
`reports/benchmarks/native-class-ownership/compilation-diagnostics/PROTOCOL.md`.
Reutiliza sin cambios wrapper, sampler y 390 partes autenticadas de la copia
instrumentada. Solo añade flags nativos de Node/V8 y retira CPU profiler del
futuro diagnóstico, sin cambiar fixtures, warmups, muestras, paquetes o limpieza.
No modifica el arnés de aceptación ni el resultado rechazado 39735778846.

Pasaron los probes de capacidad CLI y contratos reales J0/A0 en ambos Node:
cuatro procesos DOM, 32 cargas y 384 spans, todos los outputs iguales al archivo
original. La preparación oficial completa se verificó antes/después en ambos
Node. Hubo 384 referencias por tipo Window/Document, 96 observaciones, 64
finales exigidas claras y dos iniciales aún no claras conservadas. Son contratos,
no muestras de la captura futura ni prueba universal de ausencia de fugas.

El método captura eventos de categorías de compilación, no identidad de función
ni causalidad. Se preservan principal/fondo, fases y nombres; los 510.536 eventos
completos de categoría de los contratos no son 510.536 compilaciones. La revisión
independiente del protocolo, contratos y posiciones terminó sin hallazgos.
Crudos y fuentes en `reports/validation/native-class-ownership/compilation-diagnostics-method/`;
raíz local `/tmp/rustdom-compilation-method-ca_1479i`.

El CI general de `8c6dc74b`, run39750126871, aprobó ocho checks. El de `2af7a05c`,
run39752006618, seguía vivo en la última consulta; comprobar estado real y los
checks del SHA que publique el método. Sin merge ni tag de ownership.

Siguiente paso: implementar y revisar el orquestador de la única captura nativa
de diez procesos del protocolo, cotejar las fuentes publicadas y ejecutarla una
sola vez. Aún no se ejecutó esa captura. Conservar cualquier error sin reintentos;
no repetir las capturas anteriores. No atribuir el rechazo de Azure a JIT ni GC
sin evidencia. Ownership sigue abierto e inventario `4c09d1bd` separado.

## Actualización: captura CPU/GC local completa, sin aceptar rendimiento

El método y fix se publicaron y cotejaron en `8c6dc74b` antes de medir.
La revisión final terminó con cero hallazgos tras cerrar pérdida de GC al
rechazar y una referencia documental. Las siete fuentes publicadas coinciden
con sus pruebas y revisión. Ownership y el inventario global siguen abiertos.
El CI general de `12eaeb82`, run 39747428995, aprobó sus ocho checks; el de
`8c6dc74b`, run 39750126871, sigue en ejecución. No confundir ambos SHAs.

La única captura prevista terminó en
`/tmp/rustdom-sampler-diagnostics-capture-8t6vmwnn`: diez procesos exit0,
80 lotes y 960 intervalos (240 warmups/720 medidos), 3.552 GC y 740.753 ticks
CPU. Todos los outputs de los 80 lotes coinciden con el ensayo original y las
cuatro verificaciones de preparación oficial antes/después coinciden. No
repetir la captura ni ninguno de los ensayos anteriores.

Hay solapamiento temporal GC en 24 intervalos, todos observer-delivery/1000
de J0/J1 Node22; 18 son medidos. No se observó solapamiento GC durante las
operaciones de rangos de esta captura. No prueba causas de Azure, resolución
de regresiones ni ausencia de compilación/deoptimización. Host local WSL Intel,
profiler e instrumentación distintos del ensayo Azure; sin decisión de aceptación.

El lector inicial asumía deltas CPU no negativos y falló ante 71 entradas.
Se conservan lector y fallo. El fix reconstruye timestamps y ordena juntos
timestamps/IDs, preservando todos los ticks, como DevTools. Cinco casos numéricos
y replay de los diez perfiles pasan, conservando los 960 resultados. El análisis
registra incertidumbre de reloj y los diez intervalos sin ticks, sin excluirlos.

Memoria: 960 referencias Window y Document por separado, 240 observaciones,
160 finales exigidas claras y ocho iniciales aún no claras conservadas. No son
picos ni garantía universal de ausencia de fugas. Crudos/fuentes/perfiles en
`reports/validation/native-class-ownership/sampler-diagnostics-capture/`;
análisis completo y scripts en `reports/benchmarks/native-class-ownership/sampler-diagnostics-results/2026-10-22/`.

La revisión independiente de la lectura y los crudos terminó sin hallazgos.
Siguiente paso: cotejar primeros/últimos intervalos y frames de rangos de estos
mismos perfiles. No obtener más muestras
ni atribuir causalidad sin evidencia. El resultado de aceptación 39735778846
sigue verified=true, accepted=false. No merge ni checkpoint de ownership;
inventario `4c09d1bd` sigue separado. Consultar CI del SHA publicado real.

## Histórico: diagnóstico acotado preparado antes de la captura

Los resultados íntegros del ensayo independiente se publicaron en `12eaeb82`,
sin aceptación ni merge. El CI general de ese SHA está en el run 39747428995;
consultar su estado real. XML y preparación terminaron en success; el gate
histórico de ownership terminó en failure por el rechazo conservado, no se
lo saltea. No repetir ninguno de los tres ensayos oficiales rechazados.

La lectura de todas las series detectó aceleración durante las muestras de
rangos Node22 tanto en una fila rechazada como en otra calibrada. No identifica
causa suficiente. El método nuevo, todavía sin captura con profiler, está en
`reports/benchmarks/native-class-ownership/sampler-diagnostics/PROTOCOL.md`.
Deriva una copia autenticada de las 387 fuentes, registra warmups e intervalos
después de detener el reloj y observa GC externo. No modifica el arnés de
aceptación `6904db29…` ni paquetes oficiales, presupuestos o crédito Rust.

Los contratos finales pasaron en Node22/24: cuatro procesos funcionales, 32
cargas, 384 intervalos y outputs públicos idénticos al archivo original. Hubo
1.434 eventos GC escalares, 384 referencias por tipo Window/Document, 96
observaciones de cleanup y las 64 finales exigidas claras; cuatro observaciones
iniciales aún no claras siguen incluidas. No son picos ni garantía universal.
Tres contratos negativos del preparador y tres de error por Node pasan.

La revisión encontró pérdida de GC pendiente cuando el sampler rechazaba.
Se reprodujo sin mocks mediante un segundo observer y GC real, se movió el
drenaje a finally y el mismo probe pasa en ambos Node. Se conservan fuente y
crudos iniciales, fallo real, fix y validación final, con identidad completa de
la preparación oficial comprobada antes/después en ambos Node.

Evidencias en `reports/validation/native-class-ownership/sampler-diagnostics-method/`,
benchmarks y memoria equivalentes. Raíz final local:
`/tmp/rustdom-sampler-diagnostics-final-tktpjoet`; inicial conservada:
`/tmp/rustdom-sampler-diagnostics-method-tvzqtpz3`. Antes de capturar los diez
procesos del protocolo, publicar y cotejar fuentes y revisión finales. La captura
es observacional: no puede aceptar rendimiento. Continuar con CI/review del SHA
publicado y mantener ownership abierto; inventario `4c09d1bd` sigue separado.

## Actualización: orden independiente completo, presupuesto rechazado

El run `39735778846` terminó sobre `f5526bc1`: 128 procesos por Node, 256 en
total, todos con exit 0. Ambos drivers dieron exit 1 por presupuesto, sin
errores de ejecución. Se conservaron las 18.432 duraciones y todas las filas.
No repetir el run ni quitar/reaplicar `ownership-independent-order-v1`.

El artefacto oficial `12409208308` está íntegro en
`reports/benchmarks/native-class-ownership/independent-order/39735778846/`.
ZIP SHA-256 `0ee75c12464aa8cfee9f3ac3b42ba81a01dd54a9ed0c15faddfedbcf4ea2f2a5`.
Tar SHA-256 `928e17bfd676264bab0e2bf30f8dfe7267831752dbc3a254cb86c5abece76756`.
Extracción verificada: `/tmp/rustdom-ownership-results-m7jq3638/independent-order`.
Las 387 fuentes por Node coinciden con el commit publicado, arnés `6904db29…`.
Los verificadores congelados y preparación completa pasan offline en Node22/24;
conservan `verified=true, accepted=false`. El lector independiente reproduce
32 filas, 2.048 medianas de lotes y la misma decisión.

Calibración A/A y A/B: Node22 5/8 y 7/8; Node24 7/8 y 7/8. Todos los puntos
Rust A/A están dentro de ±5% y los A/B no superan +5%, pero seis filas jsdom
no calibran. No aceptar un subconjunto ni cambiar límites/estimador. El archivo
confirma los cuatro factores independientes; no demuestra causas del drift.

Memoria: 24.576 referencias por tipo Window/Document; 6.144 observaciones,
182 iniciales no claras conservadas y 4.096 estados finales exigidos claros.
No son picos ni prueba universal de ausencia de fugas. Los diagnósticos por
posición de muestra son descriptivos y no cambian aceptación ni excluyen datos.

El CI general afba8091, run `39735898622`, aprobó sus ocho checks; metadata y
logs están publicados en `ci-afba8091`. El nuevo SHA requiere sus propios checks.
El inventario sigue separado en `feature/inventory-node-helpers`, `4c09d1bd`:
once módulos, veinticinco anclas y seis APIs auditados, alcance abierto. Solo
hasFeature recibe nuevo crédito Rust existente; cinco anclas se conservaron
híbridas tras corregir sobrecrédito. Integrar después de cerrar ownership.

Siguiente paso: analizar dispersión y fuentes de los controles fallidos de
rangos/observers usando este mismo archivo, sin nuevas muestras ni causalidad
no demostrada. Antes de otro contraste se requiere una hipótesis respaldada,
protocolo y revisión publicados. No repetir ensayos rechazados, no relajar
presupuestos y no hacer merge/checkpoint mientras ownership siga abierto.

## Histórico (superado): activación del ensayo independiente

El método y sus evidencias se publicaron en
`f5526bc1ea645946b41541350f940f5c85a7e628`. Las 387 fuentes publicadas coinciden
en bytes con el recibo de revisión; la comprobación previa a activar está en
`independent-order-method/published-source-verification.json` de validación.
Se aplicó `ownership-independent-order-v1` una sola vez.

El [run 39735778846](https://github.com/guidomodarelli/rustdom/actions/runs/39735778846)
se confirmó vivo sobre ese SHA, job `119680992084`, preparando Node después del
checkout. Su resultado está pendiente. No quitar/reaplicar la etiqueta ni rerun;
una espera que vence no demuestra que el job terminó. Los otros dos workflows
por etiqueta quedaron skipped sin repetir los ensayos anteriores.

El método nuevo está en `INDEPENDENT-ORDER-PROTOCOL.md`,
`independent-order-experiment.cjs`, `independent-order-worker.cjs`, sus constantes,
tests y workflow `ownership-independent-order.yml`. Desacopla el orden de motores
del orden del par mediante cuatro bits independientes: dieciséis posiciones,
256 procesos y 18.432 duraciones previstas. Mantiene los paquetes oficiales,
cargas, estimador, limpieza y presupuestos; no demuestra resolver el drift.

Las 23 pruebas pasan en cada Node 22.12.0/24.14.1, sin skips: 16 workers reales
en total, 128 lotes y 1.152 duraciones. Se conserva el rechazo anterior por
verificación legada y el CLI nuevo impide relabelarlo. Las 387 fuentes tienen
SHA-256 `6904db29afcddf80aca5e775ec9ebe6d2a680b11891259f3bdcc8b58f4f8ff31`;
revisión independiente sin hallazgos accionables. Actionlint y preflight real
del YAML pasan en fixture local; no es aprobación del commit publicado.

Evidencias en los reportes `independent-order-method` de validación, benchmarks
y memoria. Se observaron 1.536 referencias por tipo Window/Document, con los
256 endpoints finales exigidos claros y 12 observaciones iniciales no claras
conservadas. No se evaluó rendimiento global ni se ejecutó el estudio completo.

Siguiente paso: observar ese mismo run hasta terminar, conservar el artefacto
completo o parcial y verificarlo con sus 387 fuentes congeladas en ambos Node.
No reconstruir paquetes ni cambiar el método después de activar. No repetir
ensayos previos, modificar límites, seleccionar filas ni hacer merge/tag mientras
ownership no esté cerrado. El inventario `d723c90a` continúa separado para
integrar después de este hito.

## Actualización: ensayo de una copia terminado, sin aceptación

El run `39727878290` terminó sobre `6f708467`: ambos Node completaron 64 workers,
128 en total, todos con exit 0. Los drivers dieron exit 1 por presupuesto,
sin errores de ejecución. Se conservan las 9.216 duraciones y todas las filas.
No reiniciarlo ni quitar/reaplicar `ownership-single-package-v1`.

El artefacto oficial `12405762060` está completo en
`reports/benchmarks/native-class-ownership/single-package/39727878290/`.
ZIP SHA-256 `51d46871123f346547c6c2dd7c75fb292ec97287113a38907fa71ea5cdfcb140`.
Tar SHA-256 `c8d8395855f057e3b60024fd0a87ac76694c2a34d8c6340213c9f82cfe4b171a`.
Extracción verificada: `/tmp/rustdom-ownership-results-0yjp1eeo/single-package`.
Los 380 archivos por Node coinciden con el commit publicado; arnés `fc25f0b6…`.
Los verificadores congelados y la preparación completa pasaron offline en
Node22/24 y conservaron `accepted=false`, sin nuevas mediciones.

Calibración A/A y A/B: Node22 6/8 y 6/8; Node24 5/8 y 6/8. Todos los puntos
Rust A/A están dentro de ±5% y los A/B no superan +5%, pero jsdom no calibra
nueve filas. No aceptar un subconjunto ni modificar los límites. Memoria:
12.288 referencias por tipo Window/Document, 3.072 observaciones, 88 iniciales
no claras conservadas y 2.048 endpoints finales exigidos claros. No es prueba
de ausencia universal de fugas. El producto continúa híbrido.

El CI general de `181957b9`, run `39727951022`, aprobó sus ocho checks; logs de
las tres plataformas y metadatos están en `ci-181957b9`. El inventario se publicó
aparte en `feature/inventory-node-helpers`, `d723c90a`: cinco módulos/catorce anclas
clasificados y correspondencia física de 531 fuentes, sin nuevo crédito Rust.
No integrarlo hasta cerrar ownership. No hay merge ni checkpoint de este hito.

Siguiente paso: evaluar el balance independiente de orden de motores y de
tratamientos. El schedule actual comparte la paridad entre ambos órdenes;
`order-factors.json` conserva la observación, sin demostrar causalidad. Publicar
un método distinto y revisado antes de otra medición; no repetir este ensayo.

## Histórico: secuencia de una copia activa (superado)

El run ya terminó; sus antiguos pasos de espera/activación no están pendientes.
El resultado y las instrucciones vigentes están al principio del documento.

El resultado hosted anterior se publicó en `1024f769`, con el artefacto
completo y su rechazo conservado. El PR #80 está actualizado. El CI general
`39726914194` se observó en ejecución; XML y preparación ya aprobaron.
No confundir esa espera con un ensayo hosted nuevo ni reiniciar `39721610003`.

El método nuevo está en `SINGLE-PACKAGE-PROTOCOL.md`, `single-package-worker.cjs`,
`single-package-experiment.cjs`, sus constantes/tests y el workflow
`ownership-single-package.yml`. Una distribución física por proceso; 128 workers
entre ambos Node, ocho cargas, 3 warmups/9 muestras y los presupuestos originales.
Arnés final: 380 archivos, SHA-256
`fc25f0b60292e1a394ab792acb21a21bfdb6b6e63a6923106367439fc1febbbe`.
La revisión estática final no encontró hallazgos accionables.

Validación: once contratos iniciales pasan en cada Node, con ocho workers reales
entre ambos; sampler/settings idénticos en bytes al final. Tras agregar workflow,
export y caso negativo de paquete alterado, seis contratos afectados pasan en
cada Node y seis sin cambios quedan fuera del filtro. No afirmar doce contratos
reejecutados. Actionlint y el preflight real del YAML pasaron. Fuentes, logs y
trazas están en los reportes `single-package-method`; la secuencia completa y
su decisión todavía no se ejecutaron. No hay nuevo crédito de migración.

El método y evidencias se publicaron en `6f70846772e68ae3265616cdc52bb43f9e3c00e8`.
Los 380 archivos publicados coinciden en bytes con el recibo de revisión;
`published-source-verification.json` conserva la comprobación previa a activar.
La etiqueta `ownership-single-package-v1` se agregó una sola vez.

El [run 39727878290](https://github.com/guidomodarelli/rustdom/actions/runs/39727878290)
se confirmó vivo, job `119655895196`, preparando Node tras checkout, sobre ese
SHA. Su resultado todavía está pendiente. Consultar su estado real antes de
continuar; no quitar/reaplicar la etiqueta ni rerun. Conservar todos los parciales
si falla. Una espera que vence no significa que el job terminó. El workflow
hosted anterior quedó skipped en el nuevo evento de etiqueta, sin repetirlo.

No modificar el método tras activar. Al terminar, autenticar su artefacto y
verificar con las 380 fuentes congeladas en ambos Node, sin recompilar paquetes.
No merge/checkpoint mientras falten presupuesto, CI y review final. La evidencia
de contratos no acepta el estudio completo; el objetivo sigue abierto.

## Actualización: contraste hosted terminado, sin aceptación

El run `39721610003` es terminal, con fallo de presupuesto y sin errores de
ejecución. Ambos Node completaron 32 workers, 64 en total, todos con exit 0;
se conservaron las 9.216 duraciones. No reaplicar la etiqueta ni reiniciar.

Artefacto oficial `12402457156`, ZIP SHA-256
`526ec22b70bdee0c1cee824f3a1365cdd5beeba825c1c712eb332dc7674401d6`.
Está completo en `reports/benchmarks/native-class-ownership/hosted-main/39721610003/`.
Ambos Node reprodujeron offline `verified=true, accepted=false` con el arnés
congelado de 373 archivos y verificaron la preparación completa. Extracción:
`/tmp/rustdom-hosted-main-results-6n_lsanc/hosted-main`; no reconstruir paquetes.

Calibración A/A y A/B: Node 22, 5/8 y 5/8; Node 24, 6/8 y 8/8. Todas las
diferencias puntuales Rustdom A/A están dentro de ±5%; ninguna A/B supera +5%.
La aceptación global continúa falsa por el control jsdom. No aceptar solo las
filas calibradas ni atribuir a C las diferencias de filas sin calibrar.
Se conservaron 91 endpoints inicialmente no claros y los 4.096 finales exigidos
claros, observando Window/Document por separado. Ver el reporte de memoria.

El CI general de `429b9240`, run `39721714768`, aprobó sus ocho checks,
incluido Windows/paquetes. Metadata y logs están en la validación `ci-429b9240`.
El inventario mejorado está publicado aparte en `feature/inventory-node-helpers`,
`b6a44f50`: 4.374 APIs, con 43 declaraciones añadidas, sin nuevo crédito Rust.
Integrarlo después de cerrar ownership. No merge ni checkpoint del hito todavía.

El método distinto de una copia por proceso se preparó después de este resultado;
ver la actualización al principio del documento. Sigue siendo una hipótesis,
no una solución demostrada. No repetir este ensayo hosted anterior.

## Histórico: secuencia hosted única en ejecución (superado)

Este bloque describe el estado anterior a la conclusión del run. El resultado
terminal y los pasos vigentes están al principio del documento; las instrucciones
de preparación/espera de este bloque ya no indican trabajo pendiente.

El [run 39721610003](https://github.com/guidomodarelli/rustdom/actions/runs/39721610003)
está ejecutando el contraste sobre `56825a50535b28d3c6ba082de1a81153c21b94ed`.
La API de GitHub confirmó vivo el job `119636108675`, paso de Node 22 y después
Node 24, tras aprobar el preflight oficial. La etiqueta `ownership-hosted-main-v1`
ya fue aplicada una sola vez. **No quitarla/reaplicarla ni iniciar otra secuencia.**

Consultar el estado actual de ese run antes de continuar; una observación que
vence no significa que terminó. Su resultado y artefacto final están pendientes.
Conservar las 64 ejecuciones y 9.216 duraciones si completa; ante fallo de
ejecución, conservar todo lo parcial. No reconstruir inputs ni reintentar para
seleccionar una corrida. El presupuesto histórico continúa sin aceptar.

La revisión del SHA publicado confirmó los 373 archivos y arnés `7ef509af…`
byte a byte. Esta actualización del handoff no cambia el método ni sus fuentes.
Los nuevos checks generales se deben comprobar sobre el HEAD actual por separado;
el contraste permanece vinculado a `56825a50` aunque este documento avance.

## Histórico: preparación del contraste hosted completo (superado)

Este bloque registra la preparación de `56825a50`, previa a la activación.
La secuencia ya terminó y su resultado figura al principio del documento.
No volver a activarla ni usar los pasos siguientes como instrucciones actuales.

Se agregó `HOSTED-MAIN-PROTOCOL.md`, bindings del arnés existente y
`ownership-hosted-main.yml`. Mantienen ocho filas, dos Node, tres warmups,
nueve muestras por lote, 64 procesos y los mismos presupuestos ±2%/±5%/+5%.
Usan únicamente los paquetes oficiales del run `39720077911`, sin recompilar.
Nueve contratos reales por Node 22/24 pasaron; logs en
`reports/validation/native-class-ownership/hosted-main-method/`.
Revisión estática cerrada sin hallazgos: 373 archivos y arnés `7ef509af…`.
El paso real de preflight del workflow pasó localmente sin medir.

La secuencia todavía no se ejecutó. Antes de activarla deben estar publicados
el arnés, sus pruebas y el recibo de revisión con su huella final. Se activa una
sola vez con la etiqueta `ownership-hosted-main-v1`; no la quitar/reaplicar ni
reintentar para seleccionar resultados. Conservar todos los fallos y verificar
ambos archivos Node offline. El presupuesto anterior continúa sin aceptar.

## Actualización: paquetes oficiales de CI autenticados

La preparación publicada en `2e0ae88d` pasó el run `39720077911`.
Artefacto oficial `12400802735`, SHA-256
`b25f1e98608c6abb50cb9a5c9feb00f825276941511f3ed9905c457480582610`.
Está conservado con metadata, logs y verificaciones offline en
`reports/validation/native-class-ownership/hosted-build-ci/39720077911/`.
El verificador congelado y los cuatro reportes funcionales pasan; 17 contratos
por Node 22/24. Sin nuevos benchmarks ni aceptación de rendimiento.

Los paquetes oficiales A/C tienen huellas distintas de los locales solo por
el addon y native-build.json: A `03568ce9…`, C `99c07d9b…`; jsdom conserva
`c458b9e9…`. Usar los pins completos de receipt.json para el contraste futuro,
sin confundirlos con las distribuciones locales del estudio C terminado.
El tar oficial se extrajo y verificó en `/tmp/rustdom-hosted-official-mbd7e41q/ownership-build`.
No reconstruir estos paquetes ni reiniciar estudios antiguos. Siguiente paso:
fijar y revisar el nuevo método hosted sobre este artefacto antes de medir.
Al registrar el recibo, el CI general de `2e0ae88d` seguía en curso; comprobar
siempre el SHA actual después de nuevos pushes. Ownership conserva su rechazo
del estudio anterior. No merge/tag ni APIs nuevas desde esta preparación.

## Actualización: preparación reproducible para CI, todavía sin medir

El CI general de `40a4adf3`, run39714488637, aprobó los ocho checks: Windows,
macOS, Linux, cuatro shards y agregado, incluido Memcheck. Esto confirma el fix
anterior de espera de colecciones. XML también verde; ownership conserva exit1
por el estudio C completo con accepted=false, sin preflight B obsoleto.

Se agregó una receta de preparación separada: `ownership-build.yml` y
`prepare-hosted-build.cjs`. Construye A/C desde fuentes completas, con versiones
fijadas, sin dist previo; conserva fuentes, herramientas, logs, todos los paquetes
de ejecución DOM y dependencias. No ejecuta un benchmark. Rechaza overrides y
configuración externa de Cargo, rutas ambiguas y enlaces no portables.

Validación local final terminada: build11075 exit0, root
`/tmp/rustdom-hosted-build-links-00612sdr`; validación48980 exit0. No reiniciar.
17 contratos por Linux Node22/24 y cuatro workers reales, incluyendo traslado:
60 observaciones Window/Document por tipo y 40 estados finales claros exigidos.
El tar se extrajo y verificó con ambos Node sin usar los roots originales.
Las distribuciones reconstruidas son bit-idénticas a A/C/jsdom congelados.
Código revisado localmente sin hallazgos. Evidencia completa en
`reports/validation/native-class-ownership/hosted-build/` y memoria correspondiente.

Se preservan tres intentos de desarrollo: uno detenido por defectos de revisión,
otro con carpeta dependencies incorrecta, y otro que pasó workers/16contratos
pero conservaba un enlace absoluto .bin/tldts. Este último no se aprueba; la
versión final preserva y enumera enlaces relativos y rechaza referencias externas.

Siguiente paso: publicar y observar el nuevo workflow de preparación, autenticar
su artefacto oficial y fijar esas distribuciones antes de declarar un contraste
hosted con hipótesis/método nuevos. No repetir el ensayo hosted antiguo ni las
secuencias C/diagnósticos terminados. No aceptar rendimiento desde un build o
desde tests. Sin APIs migradas nuevas, merge ni tag; revisión remota sigue
pendiente por cuota. El objetivo completo permanece activo.

## Actualización: gate C y espera funcional de colecciones

Se reemplaza el preflight obsoleto de ownership (esperaba B833) por la verificación
offline de la secuencia C existente, fuentes0d67/arnés96491. Autentica los 931
archivos y recalcula ambos Nodes/64procesos/9.216duraciones con el verificador
original. Conserva accepted=false y exit1: no remedir, no merge/tag. Fuentes,
inputs raíz o evidencia distintos producen exit2; una copia recortada de A fue
rechazada correctamente y los CLI posteriores usaron blobs Git de checkpoint067.
14contratos nuevos pasaron en Linux22/24 y Windows24; evidencia en
`reports/validation/native-class-ownership/ownership-evidence/`.
El comando completo del workflow aprobó 43 contratos por Linux Node 22/24.

El CI general bfe51fef/run39712379896 produjo un fallo real Windows24.22 en
colecciones jsdom/VM: primera observación clara en ronda12 a326,77ms, sin otra
para confirmar. Log, JSON y metadata oficiales autenticados están en
`reports/validation/native-class-ownership/collection-query-quiescence/`.
La política funcional de colecciones permite64rondas bajo el mismo deadline10s,
siempre dos estados claros y baselines exactos. No cambia runtime, helpercanónico
ni samplers de rendimiento. Regresión con propietario fuerte por12observaciones
y rechazo de retención persistente. Cinco tests por Linux22/24 aprobaron con
ambos motores, incluyendo52escenarios/120observaciones finales claras por Node.
Windows24.22 aprobó la regresión jsdom/default/VM; Windows nativo queda para CI.
Ambos cambios tienen revisión nativa local limpia. No declarar CI final verde
sin consultar el SHA publicado; revisión remota sigue pendiente por cuota.
No hay nuevas APIs migradas. Mantener el objetivo completo activo.
La corrección funcional de colecciones está en `60e8b112`; ambos cambios deben
quedar publicados antes de continuar. Consultar siempre el head remoto real.

## Estado actual: diagnóstico con contexto completo terminado

La secuencia aislada sigue terminada, publicada en `5da6a90d`; no reiniciarla.
Se publicó `RUNNER-SHARING-CONTEXT-PROTOCOL.md` en `8cc47053` para observar las ocho filas
originales en posiciones0/4, manteniendo física J0/J1 y cargaA/B, con modos
shared/independent en orden ABBA. Son ocho procesos entre Node22/24 y 1.152
duraciones medidas. La única secuencia terminó con exit0 en ocho workers y
ambos drivers, Node22 antes de Node24. Root original
`/tmp/rustdom-runner-context-study-alwnuvvp`, sesión96791 terminal: no reiniciar.
El método/367fuentes se fijó en c5afe557… antes de medir, con review local limpia.

El resultado es inconcluso: en range-control-1000/250 Node22 dio primero/segundo
+16,718885% shared/pos0 y −1,029562% independent/pos0; pos4 dio +0,529461% y
−9,200011%. Node24 conservó valores negativos en ambos modos/casos. No permite
adoptar la separación como fix ni aceptar ownership. Los 1.366 archivos crudos,
64 comparaciones y 1.152 muestras están en
`runner-sharing-context-diagnostics/2026-10-22/`, bajo benchmarks de ownership.
Linux/Windows recalcularon JSON idéntico; Node cruzó todas las medianas/muestras.
No repetir estos contrastes. Definir una hipótesis nueva antes de medir, revisando
entorno de ejecución y procedencia de fuentes, compilados y herramientas.

Los controladores compartidos aceptan esa receta explícita y conservan los
defaults aislados. Los checksums ahora se comparan por cada una de las ocho
filas. Cuatro contratos pasaron por Linux Node22/24; la validación incluye ocho
workers funcionales, 648 duraciones y 288 comprobaciones finales de recursos.
La revisión local del código cerró sin hallazgos. Fuentes y evidencia en
`reports/validation/native-class-ownership/runner-sharing-context/`.

El análisis offline adicional de las 9.216 muestras, sin cambiar aceptación,
está en `paired-inline-sample-trajectories/2026-10-22/`, bajo el directorio
de benchmarks de ownership. Incluye los 1.024 lotes y conserva todas las filas.
Linux/Windows produjeron el mismo JSON y Node verificó los cálculos. No permite
atribuir causas ni juzgar warmups no registrados; motiva conservar el contexto.

El CI general de `8cc47053`, ejecución39710595898, seguía activo al preparar
este registro; XML39710595698success y ownership39710595756failure por preflight
histórico. Consultar estado real antes de declarar cierre. Mantener rendimiento
sin aceptar y revisión remota pendiente por cuota, sin merge/tag ni APIs nuevas.

## Estado del motor y evidencia previa: secuencia C sin aceptación

Continuar en `feature/native-class-ownership`, PR #80. La compilación y medición
C corresponden a `eaeca4af3084a23b96fc0214240b552204018c22`, revisado antes de
medir. La evidencia completa se publicó en `6206cc0302bbccf0a6007855b50bffe33eafd19b`,
con revisión limpia `6330167262` y los ocho checks generales `39702836685` aprobados.
C agrega únicamente `#[inline]` a `new_instance<T>` sobre el parent `767aca43`.
El guard y sus contratos de ownership permanecen iguales. No sumar APIs migradas.
Los apartados siguientes conservan la historia y no reemplazan este estado.

La corrección XML se publicó en `93856fdd27d2ab7036d8ea58cb1ec40f07f157e3`.
Su workflow `39706343771` aprobó verificando el archivo histórico, sin construir
ni medir otra vez. El CI general `39706343650` produjo un fallo real en shard2:
la tercera ronda de quiescencia ya estaba clara, pero no quedaba otra para
confirmar dos endpoints consecutivos. Log y endpoint originales conservados en
`reports/validation/native-class-ownership/ci-quiescence-93856fdd/`.
La review remota de 93856 fue rechazada por cuota, recibo `6330524298`;
no considerar ese SHA revisado remotamente ni redisparar para eludir el límite.

Esta actualización corrige solo el contrato funcional de quiescencia, usando
la espera acotada canónica existente de 12 rondas/10 segundos, siempre con dos
endpoints claros y baselines nativos exactos. La regresión retiene Document
reales durante tres observaciones y exige liberación posterior. No altera el
runtime, helper de GC, ni las tres rondas de los samplers de rendimiento.
Dos contratos del nuevo diagnóstico y seis de recursos aprobaron por Node22/24;
evidencia en `reports/validation/native-class-ownership/runner-sharing/`.

Se preparó `RUNNER-SHARING-PROTOCOL.md`, en el directorio de benchmarks de
ownership: 32 procesos jsdom A/A entre ambos Nodes, comparando un módulo de
carga compartido con dos copias de fuentes idénticas. Mantiene fixture y lotes
originales, balance físico/carga/lotes y agrega trazas V8 idénticas en ambos
brazos. El reviewer local cerró sin hallazgos tras corregir rutas relativas y
conteo de fuentes. Esa preparación se publicó antes de ejecutar la secuencia;
el resultado actual terminado está registrado a continuación. El diagnóstico
no puede aceptar un presupuesto ni sustituye la revisión remota para mergear.

El método se publicó en `4b76fe2a550c3c979e7412fe7400d02e81d0cf3c` y la
única secuencia diagnóstica terminó con exit0: 32 procesos/576 duraciones,
Node22 antes de Node24. Root original `/tmp/rustdom-runner-sharing-study-yco2wkdn`,
sesión16508 terminal: no reiniciar. Archivo y análisis portable en
`reports/benchmarks/native-class-ownership/runner-sharing-diagnostics/2026-10-22/`.
Se verificaron 1.470 archivos crudos, todos los resultados públicos coincidieron
y quedaron claros los endpoints. El primer lote fue más lento 4/8 en ambos
brazos Node22 y 3/8 en ambos Node24. El contraste no reprodujo el patrón anterior
ni demostró que separar el módulo arregle la inestabilidad. Las trazas del script
son anónimas y no identifican measure; no atribuirles causalidad.
El diagnóstico usa trazas y omite el contexto de las otras siete filas: no acepta
presupuesto ni justifica cambiar el runner como fix demostrado. Investigar el
contexto completo y una hipótesis nueva antes de otra medición.
El paso de contratos del shard2 del CI de 4b76 ya aprobó; CI general aún en curso
al preparar este registro, XML39707715801success y ownership39707715813failure
en el preflight histórico. No declarar CI general verde sin consultar su final.

El CI general de `eaeca4af`, ejecución `39697882540`, terminó success: los ocho
checks, incluidos macOS, Windows, Linux y cuatro shards, aprobaron. Datos y recibo
originales en `reports/validation/native-class-ownership/ci-eaeca4af/`.
Ownership `39697882495` aprobó los 29 contratos y se detuvo en preflight antes
de compilar/medir: conserva el pin histórico 833 frente a C 0d67. No se omite.
La evidencia previa de CI/review de `767aca43` también permanece archivada.
XML `39693070050` terminó A/A sin calibrar:
208 procesos, 6.656 duraciones, una fila fuera de ±2%, `accepted=null`, sin A/B.
El ZIP oficial y su verificación están archivados; no elegir un histórico favorable.
El XML actual `39697882498` terminó success: artefacto `12393700893`, ZIP oficial
verificado, 937 entradas, 468 procesos y 14.976 duraciones. Las trece filas
calibraron y quedaron dentro del +5% de su gate en Node24. El verificador y sus
dos tests históricos pasaron sobre este archivo en Linux/Windows. Su binario CI
`221e6754e8e6ef461007f5d6834cb586ebbf0f0a6d8556651ab93b64e6b9c0f5`
es distinto del addon local C; no equipararlos. El protocolo XML no fija el
manifest completo de JavaScript y no acepta el presupuesto separado de ownership.
Archivo: `reports/benchmarks/native-class-ownership/xml-validation/39697882498/`.

El push de datos 6206 activó otra medición XML con las mismas fuentes/método.
Se canceló `39702836767` tras comprobar esa duplicación y antes de inspeccionar
sus resultados. El ZIP oficial, estados previos/finales y observaciones disponibles
quedan en `xml-validation/39702836767/`: 105 entradas, 52 procesos A/A y 1.664
duraciones, experimento incompleto y sin calibración/aceptación calculadas.
No equivale a un check verde ni se combina con otra corrida.

Esta actualización incorpora `xml-history.cjs` y el lector de identidad del ZIP
al workflow XML. Autentica ZIP, verificador y metadata antes de decidir; compara
ambas fuentes, receta del workflow, herramientas grabadas/reales e inputs raíz
de npm/Cargo, incluido build.rs y la presencia/ausencia de configuraciones.
La selección válida recalcula las 14.976 observaciones originales sin remedir;
un dato faltante/alterado falla, y false/null no acepta presupuesto.
Los filtros del workflow cubren ese grafo de dependencias.

Validación local de este gate: 20 contratos en Linux Node22/24, 16 en Windows
Node24 y cuatro casos Linux omitidos explícitamente. CLI actual select/verify
con referencia real restaurada de Git: reuse=true y exit0. actionlint aprobado.
Fuente/pins/fixture/verificador revisados sin hallazgos tras cuatro fixes de
integración; resultados y límites en `reports/validation/native-class-ownership/xml-history/`.
Se requiere CI/revisión del SHA que publique esta corrección antes de su cierre.

C se compiló en `/home/guido/rustdom-native-class-inline-x2yg1emf`, sin Git.
Addon `afbf5e85e85b542d6324b9a8ce2e0295181ac1896494025dc7834ae1b4c3482f`,
fuentes canónicas `0d67e1d821c70371ca1b82817870b7ad6a053f534161ae9096591d7199d0b947`
y distribución completa `9d2d14c14d17f0b1b64473bbeaed435ff893bfc8421029ebba853be67b6e7b6c`.
Los 560 JavaScript y package.json reconstruidos son idénticos a B. El símbolo
ToNapiValue de MutationRecord ocupa 713 bytes sin wrapper tipado separado;
es inspección estática y no prueba mejora temporal.

La validación amplia terminó con exit 0, igual que el empaquetado posterior
(sesiones 45354 y 24030: no reiniciarlas). Rust: 311 tests y seis del guard,
fmt/clippy; Memcheck cero errores y bytes definite/indirect, con categorías
possible/reachable del harness documentadas. Por Linux Node 22.12.0 y 24.14.1:
3.751 contratos DOM, Jest 22, Vitest 33, VM 34, validación 16, corpus HTML5
1.784 comparables/8 exclusiones script-on, benchmark harness 122, cinco modos
de memoria y veinte gates de consumo npm/pnpm. WPT por Node: 240 fixtures,
83.007 resultados, 1.203 fallos de estándares compartidos; paridad aprobada.
La primera copia carecía de cuatro archivos de auditoría y produjo dos ENOENT;
su log negativo permanece junto al rerun de dieciséis casos aprobado.

Archivo completo: `reports/validation/native-class-ownership/inline-candidate/`.
Conserva 188 entradas, 960 inputs de build y hashes de contenido/gzip. Ejecutar
`node reports/validation/native-class-ownership/inline-candidate/verify.cjs`
para recalcular integridad, paridad WPT, gates de paquete y endpoints de memoria.
Resumen y límites: `reports/memory/native-class-ownership/inline-candidate.md`.
No son memoria pico ni una garantía universal de ausencia de fugas.

El método de comparación de C está en `PAIRED-INLINE-PROTOCOL.md` y
`paired-inline-experiment.cjs`, bajo `reports/benchmarks/native-class-ownership/`.
Congela 357 fuentes y conserva todas las cargas, umbrales y estimador anteriores.
Sus cuatro workers funcionales completaron 576 duraciones, 768 Window y 768
Document observados y 256 endpoints finales claros; no son aceptación.
Los 23 contratos pasaron por Linux Node 22/24 y 20 por Windows Node24 con tres
preflight Linux omitidos. El comando CI ampliado aprobó 29 por Linux Node22/24.

La secuencia C de la sesión 93464 terminó con exit 1: los 64 procesos terminaron
con exit 0, 9.216 duraciones, `complete=true` y `accepted=false` en ambos Nodes.
No reiniciarla. Root original: `/home/guido/rustdom-paired-inline-study-1fjgji8z`.
Archivo completo: `reports/benchmarks/native-class-ownership/paired-inline/2026-10-22/`,
931 archivos más manifest, con 357 fuentes congeladas por Node y procedencia del
SHA revisado antes de medir. El CLI real reprodujo el resultado completo en Linux
Node22/24 y Windows Node24. A y jsdom conservan sus pins; B representa C.

Node22 calibró 4/8 A/A y 4/8 A/B; esas cuatro A/B quedaron dentro del presupuesto.
Node24 calibró 5/8 A/A y 5/8 A/B; esas cinco A/B quedaron dentro. Todas las filas
Rust A/A quedaron dentro de ±5%; los rechazos de calibración provienen de jsdom.
mutation-records-collect/100 Node24 dio +0,704117% Rust y −1,302265% jsdom:
A/A y A/B calibraron y esa fila quedó dentro del presupuesto. No prueba causalidad
de inline ni una mejora universal respecto del estudio anterior separado.
range-control-1000/1000 Node24 dio +5,189336% Rust y +3,531075% jsdom A/B:
se conserva el exceso crudo, pero no es una regresión calibrada atribuible a C.
range-control-1000/250 Node22 A/A dio −16,542983% jsdom sin ejecutar C.

Se observaron 12.288 Window y 12.288 Document distintos, con 4.096 endpoints
finales requeridos claros y baselines nativos verificados. Resumen de memoria en
`reports/memory/native-class-ownership/paired-inline-2026-10-22.json`: son rangos
posteriores a GC, no picos ni una garantía universal de ausencia de fugas.

El diagnóstico offline en `paired-inline-diagnostics/2026-10-22/`, bajo el mismo
directorio de benchmarks, cubre las 64 combinaciones Node/fase/motor/fila y cruza
todas sus medianas con el verificador original. Linux/Windows produjeron JSON
idéntico. En jsdom Node22 A/A range-control-1000/250, el primer lote fue más lento
en 7/8 procesos; A y B fueron primero cuatro veces cada uno. La mediana descriptiva
primero/segundo fue +36,250775%. No identifica causalidad de JIT/GC ni reemplaza
el delta original o la decisión. Todas las demás filas y órdenes quedan visibles.

El resultado aislado ya se publicó en 5da6a90d. Los próximos pasos actuales
están al inicio del documento; no repetirlo ni adoptar la separación como fix probado.
Mantener el presupuesto separado de ownership en su estado real sin aceptar;
investigar el estado compartido y aislamiento del runner con una hipótesis y un
protocolo nuevos. No relanzar secuencias V1/C idénticas,
elegir otro estimador, excluir filas ni cambiar umbrales para aceptar datos previos.
Integrar la decisión en CI conservando su rechazo real. Sin presupuesto aceptado
no hay merge ni tag de este hito. El monitor 87492 terminó con exit 0 al recibir
la revisión limpia de eaeca4af; no reiniciarlo como si siguiera pendiente.

Después del cierre de #80, integrar el inventario `014c7da` y migrar completo
`living/node.js`. El inventario publicado todavía no permite un porcentaje
global: 531 módulos, 4.331 APIs y 7.246 anclas, alcance sin cerrar. El objetivo
continúa siendo retirar toda la implementación de plataforma JavaScript.

## Actualización: estudio pareado terminado; presupuesto sin aceptar

La rama vigente es feature/native-class-ownership, PR #80. El último head publicado
antes de esta actualización es 3d682ab477992381aba3bf1e4c98b55dbb01d826, con review
remota limpia 6327932290. La rama temporal feature/native-class-ownership-sampler
ya fue integrada y eliminada. No repetir las instrucciones históricas de publicarla.

La sesión 88845 terminó con exit 1, no fue interrumpida: 64 workers terminaron
con exit 0 y produjeron 9.216 duraciones. El launcher verificó ambos Nodes y se
repitió la verificación offline con el mismo resultado. Datos completos y 350
fuentes congeladas por Node en reports/benchmarks/native-class-ownership/paired-main/2026-10-21/.
Node 22 calibró 5/8 A/A y 4/8 A/B, estas cuatro dentro del presupuesto. Node 24
calibró 4/8 A/A y 5/8 A/B, solo cuatro dentro. accepted=false en ambos.
mutation-records-collect/100 de Node 24 registró +5,776513% Rust y -1,507971%
jsdom en A/B: excede +5% con control A/B calibrado; su A/A no calibró por jsdom
+2,737983%. Investigar el coste de implementación, sin atribuir causalidad al
SDK ni aceptar presupuesto, cambiar estimador/umbrales o relanzar la secuencia
idéntica. Los tests del archivo completo también rechazan aceptación falsa y
Window retenido con clear=true/digest actualizado. No agregar APIs migradas.

Una inspección estática reproducida por review independiente encontró un call
adicional en B desde ToNapiValue de NativeMutationRecord a su new_instance tipado;
A llama directamente a new_instance_raw vía GOT. Desensamblados, SHA, tamaños
y relocaciones en reports/benchmarks/native-class-ownership/mutation-record-code-shape/.
La limpieza adicional está en el camino de error. No demuestra coste temporal
ni causalidad; investigar antes de alterar el runtime o medir una intervención.

Se observaron 12.288 Window y 12.288 Document distintos en el estudio, con los
últimos dos endpoints de cada lote liberados y baselines nativos comprobados.
El resumen en reports/memory/native-class-ownership/paired-main-2026-10-21.json
es posterior a GC, no pico ni garantía universal de ausencia de fugas.

CI general 39686199408 terminó: Ubuntu y Windows aprobaron; macOS y shard1
fallaron. El shard1 llegó a cero Window/Document en la tercera y última ronda,
sin una segunda observación clara disponible. La corrección preparada aplica
el default acotado existente de 12 rondas/10 s solo a Vitest/VM y mantiene dos
endpoints limpios; las ocho cargas y el sampler conservan tres rondas. Seis
tests aprobaron por Node 22/24: 56 endpoints/672 objetivos por tipo y retención
deliberada rechazada. Evidencia en reports/validation/native-class-ownership/async-environment-release/.

El artefacto macOS 12387930088 se descargó, coincidió con el SHA oficial y pasó
los CRC. El único fallo vuelve a ser Range-mutations-dataChange.html: 2.808
casos individuales iguales y aprobados, pero jsdom global TIMEOUT (2) tras
78.752,944708 ms frente a rustdom OK (0) tras 17.699,825 ms; límite upstream
long de 60 s. El aislamiento por proceso no lo resolvió. El reporte completo
original comprimido está en reports/validation/native-class-ownership/ci-macos-timeout/39686199408/.

La corrección WPT configura la extensión upstream setup({timeout_multiplier:2})
igual para ambos motores, conservando fixtures/assertions y comparación de
TIMEOUT. Publica multiplier y límites externos finitos 150/180 s. Once tests
aprobaron sobre las fuentes finales en Node 22/24 Linux y Windows Node 24,
incluidos timeouts globales reales tras un caso aprobado en ambos motores.
La sesión 51948 terminó con exit 0: ambos corpus completos de 240 fixtures,
83.007 resultados y 1.203 fallos de estándares compartidos por Node aprobaron
paridad; 960 procesos terminaron con exit 0/signal null. La sesión 80033 también
terminó con exit 0. No reiniciar estas cargas. Los reportes completos comprimidos,
fuentes, logs finales y procedencia están en
reports/validation/native-class-ownership/wpt-runner-timeout/; se recalculó su
paridad con el comparador real. Reviews independientes de código y datos finales:
cero hallazgos. macOS necesita CI.

El archivo pareado completo pasó tres contratos en ambos Linux y Windows Node 24,
incluidos rechazo de aceptación falsa y Window retenido con digest actualizado.
CI ahora ejecuta esos contratos junto con los anteriores: el comando exacto
aprobó 20 tests por Node 22/24 y actionlint pasó. Un P2 local de filtros incompletos
se corrigió cubriendo el área del método y sus dependencias; review final limpia.
Los snapshots y desensamblados conservan sus bytes mediante atributos Git;
las fuentes reales y los tests siguen visibles. No se cambia preflight ni aceptación.

XMLSerializer 39686199544 terminó sin calibrar A/A: 208 procesos/6.656 duraciones,
xml-serialize/1 = -2,256625% frente a ±2%, accepted=null y sin A/B. ZIP original,
datos y verificación están en xml-validation/39686199544/. El resultado anterior
39679501920 sigue conservado, pero no reemplaza este fallo ni acepta ownership.

Siguiente: publicar los cambios validados y comprobar CI/review del SHA final.
Corregir el coste observado antes
de merge/tag. Inventario014c7da y la migración de living/node.js siguen pendientes;
el objetivo integral no está completo y el porcentaje global aún no está auditado.
El catálogo vigente conserva 531 archivos, 4.331 APIs y 7.246 anclas ejecutables
como dimensiones separadas, con tres módulos auditados. El commit014c7da aún
no integrado añade la auditoría de living/node.js, no cambia esos denominadores.

## Actualización: corpus WPT aislado completado en ambos Nodes

Node 22.12.0 y 24.14.1 completaron las 240 fixtures con paridad, 83.007 resultados
y 1.203 fallos de estándares compartidos por versión. La sesión 50323 terminó
con exit 0; no reiniciarla. Hubo 480 hijos por Node, 960 en total, con exitCode=0/signal=null.
Los nueve tests finales también aprobaron en ambos Linux y Windows Node 24.14.1
con addon real de CI y lockfile. Review read-only del código: cero hallazgos.

La corrección mantiene loader/reporter/assertions y deadlines upstream de 10/60 s;
aisla cada motor/fixture en un proceso nuevo con --max-old-space-size=2048 y espera su terminación.
Ese argumento limita el espacio viejo de V8, no el heap total ni RSS.
El failsafe original de fixture de 90 s se mantiene; el de proceso de 120 s incluye startup.
stdout/stderr y resultados se preservan, incluso en fallos, y se limpian temporales
propios. Los tests observan terminación real tras éxito/deadline. No se afirma
ausencia de fugas internas por terminar procesos ni se modifica Rust.

Los reportes completos de Node 22 (22:04:24.642Z) y Node 24 (22:11:38.752Z) están
comprimidos sin modificar bytes en reports/validation/native-class-ownership/wpt-process-isolation/,
junto con hashes, fuentes, procedencia de addons y logs. El resumen de memoria
está en reports/memory/native-class-ownership/wpt-process-isolation.md. Son
observaciones tras close(), sin GC, no picos ni endpoints de Window/Document.
Las exclusiones/bloqueos y la normalización Date previa siguen visibles.

XMLSerializer 39679501920 quedó conservado y verificado en el commit publicado
931adff90a7d3fa78d8b3c486d6c3f7a5a64c20b del respaldo remoto. Ya terminó y no
requiere seguir esperando ni reiniciar sus cargas. Su aceptación es solo XML
Node 24/head61ed; el presupuesto de ownership continúa pendiente.

Siguiente acción: publicar la corrección WPT validada en la rama original del
PR #80, verificar SHA remoto y eliminar la rama de respaldo una vez integrada.
Pedir review del SHA final y comprobar CI/macOS antes de declarar resuelto el
timeout. Después, con review limpia del método pareado, ejecutar su única
secuencia completa y resolver el presupuesto sin cambiar umbrales. No se suman
APIs migradas por esta instrumentación; inventario014c7da y living/node.js pendientes.

## Actualización: XMLSerializer conservado y aislamiento WPT en curso

XMLSerializer 39679501920/job119497967690 terminó success para 61ed417d,
Node 24.14.1. El artefacto 12384913614 conserva 937 entradas y su ZIP SHA
8f0d6b1640e35652c1d52a3ea668ac488acf93d9222e37ca90e967ebf2891d4a
coincide con GitHub. Se recalcularon 468 procesos y 14.976 duraciones: 208 A/A,
208 A/B y 52 reference. Las trece filas calibraron ±2% A/A y aceptaron +5% A/B;
máximo A/B +3,226057%. Datos, verificador y dos tests Python (Windows/WSL) en
reports/benchmarks/native-class-ownership/xml-validation/39679501920/.
Este gate corresponde a XML/checkpoint66→61ed, no acepta ownership ni Node 22,
ni aporta retroactivamente el manifest de dist ausente en su protocolo histórico.

La corrección WPT aún está sin commitear en este worktree: tests/wpt/run.cjs
extrae el loader/reporter original a fixture.cjs y ejecuta un proceso nuevo por
motor/fixture mediante process.cjs, con constantes en constants/execution.cjs.
No modifica fixtures, assertions, reporter ni deadlines upstream de 10/60s.
Conserva el failsafe de fixture de 90s y añade uno de proceso de 120s incluyendo
startup. Se espera la terminación real antes de la siguiente ejecución, se
preservan resultados/diagnósticos y se limpian temporales propios. No se afirma
ausencia de fugas internas por haber terminado un proceso.

Nueve tests finales pasaron por Node 22.12.0/24.14.1 Linux y Windows Node 24.14.1
con el addon real del artifact 12383559216, ZIP verificado, y npm ci local con
lockfile. Incluyen la fixture de 2.808 casos, procesos terminados, deadline real de 1 ms, errores,
preservación de outputs y rechazo del timeout macOS original. Review estática
read-only del código WPT: cero hallazgos. La resolución en macOS sigue pendiente.

Sesión local 50323 sigue ejecutando secuencialmente corpus completo Node 22 y
Node 24, en /home/guido/rustdom-worker-realms-3vfjh0d8. Logs en validation/
node-22.wpt-full-isolated.log y node.wpt-full-isolated.log. Antes de reiniciar,
consultar el handle y procesos; los nueve tests finales están en *.wpt-process-final.log.
Windows real: .cache/wpt-process-windows-ecadaa81/wpt-process.tests.log (9/9).
No mezclar estos datos con los benchmarks ni declarar resuelto CI antes de macOS.

Siguiente acción: completar y conservar ambos corpus, revisar/publicar el cambio
WPT validado en PR 80, atender review/CI del SHA final y confirmar macOS. Ya puede
actualizarse la rama original sin cancelar XMLSerializer, cuyo resultado quedó
conservado. El respaldo remoto feature/native-class-ownership-sampler contiene
los avances publicados; integrar y eliminarlo después. El método pareado de 350 fuentes
está listo para review remota antes de una única secuencia; ownership y migración
integral siguen abiertos, sin porcentaje global defendible ni APIs nuevas en este tramo.

## Actualización: driver completo en validación y timeout macOS verificado

El avance previo d2c238fb4fcd168acf0218ec536788b38827b09b está publicado en
origin/feature/native-class-ownership-sampler. El PR 80 conserva 61ed417d mientras
XMLSerializer 39679501920/job119497967690 sigue activo; verificar GitHub antes de
actualizar la rama original, conservar su resultado y luego eliminar el respaldo.

paired-main-experiment.cjs define 32 workers por Node, 64 para ambos: A/A luego
A/B, ocho posiciones y orden jsdom/Rust alternado. Congela 350 archivos (333 del
alcance canónico y 17 del método) y verifica fuentes, cinco paquetes físicos,
snapshots, procesos, afinidad, aislamiento, ocho filas y endpoints de recursos.
Recalcula el predicado nativo y no confía en clear=true. El método mantiene los
umbrales y todos los datos; verify-set requiere ambos Nodes con mismas identidades.
El driver exige la huella del harness revisado antes de lanzar workers. La review
remota la verifica el launcher; un recibo declarado no demuestra aprobación.

Once tests pasaron por Node 22.12.0/24.14.1 Linux y nueve en Windows Node 24,
con dos casos Linux omitidos. Reutilizan los cuatro workers publicados y copias
privadas alteradas; no recogen muestras nuevas. La revisión nativa read-only
terminó sin hallazgos. La verificación positiva del archivo completo sigue
pendiente de la corrida real, y accepted no está demostrado. Evidencia en
reports/validation/native-class-ownership/paired-main-driver/.

La huella compuesta del método preparado es
fb2b88ed9fe44fb7c086c659d3e58385d17252401da1b3e4f38ed2a79e105d1f;
sourceHash canónico sigue 609e73b5a7f8781ecfd0c805461ac553021be09476e762869ebd295a885e638a.
El protocolo fija una sola secuencia y parada explícita, sin reintentos buscando
aprobación ni cambios posteriores del estimador, presupuestos, filas o posiciones.

CI general 39679501823 terminó: siete checks aprobaron y macOS falló en WPT.
El artefacto macOS 12384632098 fue descargado con SHA de ZIP verificado. La única
diferencia es Range-mutations-dataChange.html: 2.808 resultados individuales
idénticos y aprobados en ambos; jsdom referencia tiene harness status=2 TIMEOUT,
rustdom status=0. El runner usó Node 24.21.0. Registro crudo completo comprimido
y procedencia en reports/validation/native-class-ownership/ci-macos-timeout/.
No se ignora ni se reinterpreta el timeout como CI aprobada.

Siguiente acción: corregir la ejecución WPT en macOS sin modificar assertions ni
deadlines upstream, validar el flujo y revisar/publicar el método final. Después
de conservar XMLSerializer, actualizar PR 80 y verificar review remota del SHA
antes de una única corrida pareada. Inventario014c7da y living/node.js pendientes;
este avance no migra algoritmos DOM nuevos ni autoriza merge/tag.

## Actualización: sampler pareado y observación real de Window/Document

El head previo 61ed417d23cb3b62430c5c74fe1fa0f6343dd700 recibió review remota
limpia (6327110120). Consultar GitHub para el SHA y CI posteriores. El presupuesto
de ownership sigue pendiente; no corresponde merge/tag ni acreditar APIs nuevas.

El worker público admite trackRealms en mediciones directas: devuelve WeakRef de
Window y Document reales después de timers/assertions/checksum, incluyendo los
warmups, y conserva el resultado ordinario. memory-endpoint.cjs exporta el mismo
predicado de liberación existente para reutilizar todos sus contadores nativos.
CI ejecuta los tests del harness con --expose-gc.

paired-main-worker.cjs carga dos paquetes reales en un mismo isolate, fija solo
el principal a CPU 2 y ejecuta las ocho filas originales en lotes completos de
tres warmups/nueve muestras. Balancea ocho posiciones de carga/asignación/orden;
en Rust A/B el candidato siempre conserva la etiqueta B. Verifica distribuciones
completas contra pins independientes antes/después, aislamiento en ambos sentidos
y exactamente tres rondas de GC por lote. Las últimas dos requieren liberación
de Window/Document y vuelta al baseline nativo de ambos módulos. Conserva fallos
y observaciones escalares, sin serializar WeakRefs.

Pasaron 122 tests del harness, 33 de historia/evidencia y seis del sampler por
Node 22.12.0 y 24.14.1 Linux. Cuatro workers de validación ejercieron todas las
filas: Rust A/B posición 7 y jsdom A/A posición 0 por Node. Se guardaron 576
duraciones de validación; no son el estudio factorial ni aceptan rendimiento.
Windows Node 24 aprobó dos contratos puros; cuatro casos Linux se omitieron
explícitamente allí. actionlint aprobó; revisión local read-only: cero hallazgos.

En estos escenarios se observaron 1.440 Window y 1.440 Document, liberados en los
endpoints exigidos junto con los recursos nativos. Se guardan traces, manifests,
procedencia y logs en reports/validation/native-class-ownership/paired-main-sampler/;
el alcance de memoria está en reports/memory/native-class-ownership/paired-main-validation.md.
No son picos ni una garantía universal de ausencia de fugas. La fuente del
harness actual es 609e73b5a7f8781ecfd0c805461ac553021be09476e762869ebd295a885e638a;
las distribuciones de producción A/B congeladas siguen sin cambios.

Este avance se publica temporalmente en feature/native-class-ownership-sampler
para conservar el commit remotamente sin actualizar el head del PR 80 ni cancelar
XMLSerializer por concurrency. La rama local feature/native-class-ownership
contiene el commit nuevo; origin/feature/native-class-ownership conserva 61ed417d.
Tras el estado terminal de XMLSerializer, conservar su resultado, publicar el
avance en la rama original, pedir review del nuevo SHA y eliminar el respaldo.

Siguiente acción de implementación: completar driver y verificador offline del método definido en
PAIRED-MAIN-PROTOCOL.md, fijar fuentes/secuencia y revisar antes de una única
comparación completa. No relanzar v2 ni reducir las ocho filas/umbrales. Mientras
XMLSerializer 39679501920 siga activo, conservar su ejecución antes de un push
que lo cancelaría por concurrency. Verificar estado terminal y guardar resultado.
Inventario014c7da y el control completo de living/node.js siguen pendientes.

## Actualización: worker reutilizable con runtimes reales y preflight de CI

El head previo `385d901925abba7d9094b92121f6896ecf92bce7` recibió review
remota limpia (6326732916). Consultar GitHub para los checks y el SHA posterior.

benchmarks/worker.cjs ahora expone createBenchmarkRunner: recibe exports reales,
engine y URL de entorno, y comparte measureWorkload con el CLI original. Se
conservan fixtures, operaciones, timers, tres warmups, nueve muestras, assertions
y limpieza. La llamada directa rechaza nombres/tamaños no declarados antes de
crear DOMs. La interfaz puede afectar optimización de V8 y requiere un método
nuevo; no se reutilizan los tiempos v2 como si midieran este harness.

Pasaron 118 tests del harness por Node 22.12.0/24.14.1: 112 previos y seis
nuevos. Los nuevos ejercen las ocho filas con A/B/jsdom reales, independencia
de contadores, CLI, inputs inválidos y entornos Vitest/VM reales. Se usó una
copia Linux propia con lockfile idéntico y el dist/addon B congelado ya
validado, sin build Rust. Logs, diez reportes CLI y procedencia están en
reports/validation/native-class-ownership/public-worker-runner/.

La fuente del harness cambió a hash
`6e0a5ffedad775ea2aa48dbd3d550e799bed86164f9b451b26035f605b6134e0`
(333 archivos). Por eso el hosted antiguo no puede reutilizar su archivo ni
debe construir paquetes para descubrir tarde que sus pins no corresponden.
El workflow añade un preflight de fuentes antes de toolchain/build/muestreo;
con este harness debe fallar de forma anticipada y explícita. No se omite el
check ni se concede aceptación. Driver, protocolo y pins históricos quedan
intactos. La nueva comparación todavía requiere su propia definición/revisión.

Pasaron 33 contratos de preflight/historia/evidencia en cada Node y 17 en
Windows Node 24; actionlint aprobó. El preflight real rechaza el harness actual
y acepta las fuentes históricas sin construir o medir. Ambas revisiones locales
(worker y luego preflight/CI) terminaron sin hallazgos. El presupuesto continúa
sin aprobar; no corresponde merge/tag ni acreditar APIs DOM nuevas.

Siguiente acción: publicar y verificar review/CI de este SHA; después implementar
el método que combine comparación A/B en el mismo proceso con afinidad solo del
principal y balance de carga/orden, reutilizando este worker público. Declarar
fuentes, paquetes, secuencia y criterios antes de medir; validar Node 22/24 y
recursos sin relajar umbrales ni recortar las ocho filas. No relanzar v2. Siguen
pendientes inventario014c7da y migración completa del control de living/node.js.

## Actualización: diagnóstico descriptivo de variación, sin muestras nuevas

El head `21706250c6780a25332429d9cde0e8497f1f2192` recibió review remota
limpia (6326592071). Consultar GitHub para los checks de ese SHA y los cambios
posteriores; el gate dedicado sigue conservando el fallo histórico.

`main-affinity-precision.cjs` verifica el archivo v2 completo y describe las
64 combinaciones de versión/fase/fila/motor. Conserva la mediana agrupada
original, las ocho medianas por proceso de cada etiqueta y dos particiones
completas equilibradas: mitades cronológicas y pares de bloques adyacentes.
Cada etiqueta contiene ocho procesos y 72 duraciones, no 72 procesos.

Node 22 mutation-records-collect/100 Rust A/B conserva +5,057644%; sus mitades
dan +6,870589%/+1,425339%, y los pares abarcan -1,425223%/+7,418784%.
El control jsdom de Range/1000 A/B conserva +6,334907%, con mitades
+14,312749%/-1,065091%. Son cálculos posteriores sobre los mismos datos:
no son réplicas independientes, intervalos de confianza ni un estimador
alternativo para aceptar la mitad favorable. No identifican la causa.

El reporte completo está en
`reports/benchmarks/native-class-ownership/precision/2026-10-21/`. Seis pruebas
pasaron por Node 22.12.0/24.14.1 con el archivo real, el CLI, rechazo de alcance
incompleto, conteos y resultados sin estado mutable compartido. No se ejecutó
ningún benchmark nuevo ni se modificaron los 426 archivos del estudio original.
El presupuesto, accepted=false y el alcance integral permanecen intactos.
Los seis tests también pasaron en Windows Node 24.14.1. La revisión independiente
recalculó las 64 combinaciones y verificó código, manifests, conteos y tabla:
cero hallazgos accionables. El cálculo no identifica una causa del SDK ni
justifica tomar una partición favorable como aceptación.

Siguiente decisión: definir una hipótesis que distinga variación entre procesos
de tratamiento y un diseño capaz de comprobarla antes de otra medición. No
volver a ejecutar v2, reducir filas o cambiar umbrales para obtener aprobación.
Verificar review remota y CI del SHA publicado de este diagnóstico. PR 80 continúa
abierto sin merge/tag; inventario014c7da y control completo de node.js pendientes.

## Actualización: estudio v2 completo, presupuesto sin aprobar

El head `2c92c82da1f9a9eee82549f7947be95f672e1ca8` recibió review remota
limpia (6325872955) y su matriz general 39670400737 aprobó los ocho checks.
El gate dedicado 39670400667 conserva el fallo histórico; no se omitió.
Consultar GitHub para los SHAs/checks posteriores de esta publicación de datos.

La sesión 10526 completó una única secuencia v2 entre 20:31:39Z y 20:58:08Z
del 21 de octubre de 2026. Los 128 workers terminaron con exit 0; los drivers y
el launcher terminaron con exit 1 por accepted=false. Son 9.216 duraciones y
las ocho filas originales en A/A y A/B por Node 22.12.0/24.14.1. No quedan
cargas de ese estudio activas. No relanzar esta misma secuencia para aprobar.

Los datos completos están en
`reports/benchmarks/native-class-ownership/main-affinity/2026-10-21/`:
426 archivos más manifest, fuentes congeladas, recibo de review, manifests
iniciales/finales completos de A/B, stdout/stderr, máscaras por TID y agregados.
Las trece fuentes del método y los paquetes originales no cambiaron.

Node 22 calibró 3/8 filas A/A y 4/8 A/B; solo 3/8 A/B quedaron dentro del
presupuesto. Node 24 calibró 5/8 A/A y 3/8 A/B, estas tres dentro del presupuesto.
Ambas versiones quedan sin aceptación global. La fila mutation-records-collect/100
Node 22 A/B da +5,057644% Rust con control +0,166349%, fuera del +5%; su A/A
no calibró y no permite atribuir la diferencia al SDK. Range/1000 Node 22 sigue
sin control calibrado. La afinidad del principal no basta para resolver el hito.

El verificador completo aprobó en ambos archivos. Dieciséis pruebas posteriores
pasaron por Node 22 y 24 sobre los datos reales y copias privadas alteradas;
logs/CI en reports/validation/native-class-ownership/main-affinity-v2-evidence/.
Los mismos dieciséis también pasaron en Windows Node 24.14.1. El spec está en
main-affinity-evidence.spec.cjs y no ejecuta benchmarks nuevos. La revisión
independiente final cotejó archivos, fuentes, distribuciones, schedule, agregados
y memoria: cero hallazgos accionables. Los 426 archivos coinciden también con
los bytes Git stageados, sin alteración de line endings o muestras.
El resumen de memoria publica 9.216 observaciones posteriores a limpieza por
versión/fase/motor. Son mínimos/máximos, no picos ni WeakRefs separados de
Window/Document, y no sustituyen la regresión de ownership previamente validada.

Siguiente acción: verificar revisión remota y CI del SHA final publicado,
mantener el PR 80 abierto sin merge/tag y estudiar la precisión de estas
mediciones y la fila fuera del presupuesto a partir de los datos existentes.
No reducir alcance, cambiar umbrales o reinterpretar el estudio como aprobado.
El objetivo integral continúa abierto: inventario014c7da y el control completo de
living/node.js siguen pendientes; esta entrega no suma APIs DOM migradas.

## Actualización: método v1 detenido por identidad incompleta de dist

La review remota de `2567e7e176d33fe97f7189b05a2b302339cf8fee` encontró el
P2 4341492148: `captureSourceIdentity` excluye dist y el método fijaba solo el
addon, no toda la distribución JavaScript de A/B ejecutada. El hallazgo fue
confirmado y corregido mediante codex-autofix-loop en clone efímero separado,
publicado como `a2149f8f274192c5396d579e291772f20e0b81c6`. Consultar GitHub
para el cierre del comentario y la revisión remota del SHA final.

Se detuvo la sesión 54959 y se verificaron sus procesos propios antes de enviar
SIGTERM. Ya no hay cargas locales del estudio ejecutándose. Los datos originales
de `/home/guido/rustdom-main-affinity-study-W0MOBs` quedan conservados en
`reports/benchmarks/native-class-ownership/main-affinity-interrupted/2026-10-21/`:
veinte procesos iniciados, diecinueve completos, 1.368 duraciones; únicamente
A/A Node 22 con A/jsdom. No se completó ninguna fase, no se inició A/B ni se
ejecutó B o Node 24. Sin aceptación ni inferencia de rendimiento del parche.
El último proceso no tiene endpoint final. El índice original permanece intacto.

El manifest cubre 82 archivos más su propio manifest; verify.py verifica bytes,
hashes internos, orden, runtime, afinidad y resultados públicos de los diecinueve
procesos completos. Pasaron cuatro pruebas: archivo real y copias privadas con
bytes alterados, falsa finalización y afinidad incorrecta incluso refrescando
hashes. El resumen de memoria conserva 1.368 observaciones posteriores a limpieza,
sin picos ni WeakRefs; está también en reports/memory/native-class-ownership/.
Esto no demuestra retroactivamente la identidad dist que faltaba al medir.
La revisión local detectó separadores de paths incompatibles con Windows; se
corrigieron con as_posix(). Verificador y cuatro pruebas pasaron tanto en WSL
como en Windows Python 3.12.10; logs en la validación main-affinity-interrupted.

El método v2 fija las huellas esperadas de las distribuciones A/B completas,
conserva manifests antes/después y los verifica también offline. Los 569 paths
por paquete coinciden con los manifests históricos publicados. Los 560 archivos
JavaScript son byte-idénticos; difieren addon, native-build.json y package.json.
Diez contratos nuevos y seis funcionales pasaron en cada Node 22.12.0/24.14.1;
revisión local independiente final sin hallazgos. Se conservan fuentes,
artefactos de rechazo y resultados en distribution-identity/. El clone ya fue
eliminado de forma segura y no dejó procesos activos. La prueba positiva del
archivo completo v2 todavía necesita datos reales de su corrida.

La siguiente medición debe congelar los trece archivos del método v2 y esperar
review remota limpia del SHA actualizado antes de comenzar una única secuencia.
No relanzar v1 ni reutilizar su parcial como una comparación aceptada. Tras
resolver el presupuesto y validar review/CI del SHA final podrá cerrarse PR 80;
siguen pendientes inventario014c7da y migración del control completo de node.js.

## Actualización: comparación pública completa con afinidad del principal

El PR 80 sigue abierto en `feature/native-class-ownership`. El head publicado
`e501a71be0775a4eb507f032608b9888551c3c80` recibió review limpia (6325397282).
El check dedicado `39666548266` conservó el fallo histórico; consultar la
matriz general `39666548317` y GitHub para sus estados actuales. No corresponde
merge/tag mientras falte aceptación del presupuesto y checks del SHA final.

Se preparó `MAIN-AFFINITY-PROTOCOL.md` y su ejecutor en
`reports/benchmarks/native-class-ownership/`. Invoca el worker público original,
sin cambiar timers, operaciones, fixtures, tres warmups, nueve muestras ni
limpieza. Cubre las ocho filas originales, no solo Range/1000. El bootstrap
inicializa libuv y fija solo el principal en CPU 2; conserva máscaras por TID.
El reloj Rust auxiliar no se usa para medir o aceptar esta comparación.

El diseño fija una secuencia A/A y A/B de 64 procesos por Node 22.12.0 y
24.14.1: 128 procesos / 9.216 duraciones en total, presupuestos originales
±2% jsdom y ±5% Rust en A/A, +5% Rust en A/B. Se exigen todas las filas y
ambas versiones. Las fuentes y los dos addons están fijados por SHA.
Los estudios previos no se repiten ni se convierten en aprobados.

Los seis contratos reales pasaron en ambos Node, antes y después de fijar
hashes y comprobar conservación de máscaras. Ejecutan A, B y jsdom sobre las
ocho cargas, comparan resultados y rechazan metadatos/filas inválidos y
sobrescritura de evidencia. Logs y raw están en
`reports/validation/native-class-ownership/main-affinity-method/`. Se conserva
la identidad canónica de producción: 333 archivos / hash8332276799c5ccc18c7a45a5136a856b039736597d5e104e22f074f8e23f1ddd.

La revisión local final del método cerró sin hallazgos accionables; sus doce
fuentes están congeladas en before-performance.json. La siguiente acción es
ejecutar una sola secuencia por Node, preservar errores y datos, y
verificar el archivo completo con pruebas adversariales sobre copias privadas.
Estas validaciones no suman APIs migradas ni certifican memoria pico o ausencia
universal de fugas; la regresión de ownership y los endpoints previos conservan
su alcance. Continúa pendiente retirar el control JavaScript de `living/node.js`.

## Actualización: ubicación del reloj aislada de la huella canónica

El crate auxiliar ahora está en
`reports/benchmarks/native-class-ownership/thread-clock-addon/`, no bajo
`benchmarks/native-thread-clock`. La ubicación anterior hacía que el capturador
canónico incluyera sus outputs Cargo ignorados y disparaba un estudio XML ajeno
al helper. Se corrigió el layout sin modificar `benchmarks/sources.cjs`, workflows,
el algoritmo del reloj ni producción. El path Cargo apunta al mismo SDK.

Después de compilar y testear en la ruta nueva, la identidad canónica mantiene
333 archivos y hash `8332276799c5ccc18c7a45a5136a856b039736597d5e104e22f074f8e23f1ddd`.
El Rust y el binario del reloj también permanecen idénticos. Fmt, Clippy, test
Rust y build pasaron; Node 22 aprobó once contratos con un skip explícito y
Node 24 aprobó los doce. Los logs y el comprobante before/after están en
`reports/validation/native-class-ownership/thread-clock/relocation/`.

Los raw v1 y sus quince fuentes se conservan intactos. La configuración
histórica JSON permite verificarlos aunque el layout actual sea v2 y tenga
dieciséis fuentes. No se tomó ninguna muestra nueva ni se cambió accepted=false.
Para reconstruir el helper usar Node en Linux:

```sh
node reports/benchmarks/native-class-ownership/thread-clock-addon/build.mjs
```

El head `4f455da4` publicó el diagnóstico; consultar el PR 80 para su revisión,
checks y el commit posterior de esta corrección. El estudio XML `39662377152`
se activó con el layout anterior y terminó con exit 2: 208 procesos A/A,
6.656 duraciones y trece filas sin calibración; A/B no se ejecutó y
`accepted=null`. Los 417 archivos se conservan comprimidos, con digest de
GitHub y verificador de medianas/fases en
`reports/benchmarks/native-class-ownership/unplanned-xml/39662377152/`.
Corresponden al SHA anterior; no relanzar la medición para obtener aprobación.
La secuencia siguiente sigue siendo una comparación
A/A y A/B que fije solo el principal, preservando condiciones y presupuestos;
la reubicación no justifica repetir el diagnóstico ya terminado.

## Actualización: diagnóstico de CPU y afinidad completado

La rama sigue siendo `feature/native-class-ownership`, PR 80 listo, sobre
`main`/checkpoint 67. `e1d41f56aaac2a7bea81bde8485f37effb0860d5` cerró limpio
en la review remota (recibo 6324232285) y los ocho checks generales del run
`39658367391` terminaron correctamente. Su gate dedicado `39658367394` conserva
el fallo histórico de presupuesto. Consultar Git/PR para el SHA posterior y
sus checks; no hay merge ni tag del hito de ownership.

La variación persistía en las últimas rondas del A/A, sin un calentamiento
convergente. Se agregó un reloj Rust separado en `benchmarks/native-thread-clock`
mediante `libc`/`napi-rs` y `CLOCK_THREAD_CPUTIME_ID`, con Cargo.lock propio,
`publish=false` y binario fuera del paquete de producción. No modifica el SDK,
el addon DOM ni el lock principal. Compiló con Rust 1.99.1; fmt, Clippy y un
test real de dos hilos pasaron. Memcheck terminó sin errores ni pérdidas
definitivas/indirectas, conservando 48 bytes posiblemente perdidos y 548
alcanzables de std/test. Los contratos finales Node 22 aprobaron seis con un
skip explícito de la API nativa ausente; Node 24 aprobó los siete.

El protocolo `THREAD-PROTOCOL.md` fijó una sola secuencia P M M P, ocho
procesos A0/jsdom, sin ejecutar el candidato B. P fija todo el proceso en CPU 2;
M inicializa hilos con la máscara normal y fija solamente el principal. Se
registran máscaras por TID y CPU dentro de un intervalo que contiene al timer
público. No se usa `/proc/schedstat` como reloj preciso ni se cambia su flag
global. El reloj y las quince fuentes quedaron congelados antes de medir.

La sesión `12576` terminó con exit 0 de fidelidad entre 19:19:43.736Z y
19:20:46.071Z del 21 de octubre de 2026. Se verificaron ocho procesos, 144
duraciones y 192.000 copias públicas; `accepted=false` es incondicional. Los
46 archivos más el manifest están en
`reports/benchmarks/native-class-ownership/thread-affinity/2026-10-21/`.
Rust P registró pared pública 16,06/16,93 ms y CPU envolvente 4,67/4,51 ms;
en M ambas quedan cerca de 5,61 ms para 250/1.000. Son dos procesos por celda,
sin atribución al SDK o a V8 ni una certificación de rendimiento. Los intervalos
no tienen los mismos límites: no restar medianas independientes ni interpretar
el residuo porcentual raw como división exacta del cuerpo cronometrado.

Los recursos de las 192 observaciones tienen dos endpoints finales claros de
Window/Document y Range liberados. Se guardan en
`reports/memory/native-class-ownership/thread-clock/`; son casos de éxito sobre
checkpoint 67/jsdom, sin memoria pico ni garantía universal. La validación,
hashes congelados y logs están en
`reports/validation/native-class-ownership/thread-clock/`. Los cinco contratos
posteriores del verificador pasaron en Node 22 y 24 sobre el archivo real y
copias privadas que rechazan CPU invertida, máscara incorrecta, retención y
aceptación falsa. No generan nuevas muestras.

Siguiente acción: publicar esta evidencia, cerrar review/CI del SHA final y
usar este hallazgo para definir una comparación pública A/A y A/B con afinidad
solo del principal. Debe conservar carga, resultados, Node, warmups, muestras y
presupuestos; documentar la diferencia de contexto y revisar el método antes
de medir. No usar CPU como sustituto de pared para aprobar, relanzar secuencias
anteriores ni convertir datos antiguos en aceptados. Resolver atribución y
presupuesto con evidencia válida antes de merge/tag. Después sigue la auditoría
`014c7da` y la migración completa del control de `living/node.js`. Este diagnóstico
no suma APIs DOM migradas y el objetivo integral continúa abierto.

## Actualización: diagnóstico A/A contrabalanceado sin calibración

Continuar en `feature/native-class-ownership`, PR 80 listo, sobre `main`
`3d37f89976a48203e80cc5c435e099267f4ce346` / checkpoint 67. El código de
producción sigue idéntico al validado; esta entrega agrega un diagnóstico,
sus contratos y resultados, sin completar nuevas APIs Rust. Consultar Git y
GitHub para el SHA publicado y los checks actuales antes de asumir integración.

La review remota de `3bd05b895716c6dd7f04c24e534d5bf254d3a5f7` cerró limpia
(recibo 6323838674). Su matriz general `39654694608` debe consultarse hasta
terminal: al preparar esta actualización, macOS, Windows y los benchmarks
habían aprobado y Linux estaba en Memcheck. El check dedicado `39654694565`
conservó correctamente el fallo del estudio independiente archivado. No se
omitió el gate ni se repitió esa medición.

El recálculo por proceso del método emparejado mostró jsdom A/A de 250 con B
más lento en siete de ocho procesos idénticos. Se declaró un diagnóstico A/A
con ocho combinaciones independientes de carga, asignación física y orden de
muestras por motor, más un probe simétrico. Conserva `sample`/`cleanup`, tamaños,
tres warmups, nueve muestras, 1.000 operaciones y los umbrales anteriores.
La revisión previa cerró un P2 de reserva exclusiva de directorio. Pasaron los
seis contratos originales en Node 22.12.0/24.14.1 y el nuevo focal de reserva en
ambos; la segunda revisión nativa terminó sin hallazgos antes de medir.

La única corrida `94932` terminó con exit 1 entre 18:49:01.443Z y 18:55:21.482Z
del 21 de octubre de 2026. Se verificaron 16 procesos, 576 duraciones, 768.000
copias públicas y las diez fuentes congeladas. Rust A/A varió −2,1335%/−0,3293%
y jsdom −31,7389%/−7,5229% para 250/1.000: no calibró. El contrabalanceo no
bastó; no se ejecutó A/B ni se midió el candidato B. `accepted=false`, el
presupuesto original pendiente y los datos anteriores permanecen intactos.
No relanzar esta secuencia para obtener aprobación ni atribuir causa al SDK.

Los 64 archivos del manifest más su manifest están en
`reports/benchmarks/native-class-ownership/balanced/2026-10-21/`. Los contratos,
logs y fuentes previas están en `reports/validation/native-class-ownership/balanced-method/`.
Cinco pruebas posteriores del verificador pasaron en ambos Node sobre el archivo
real y copias privadas con alteraciones: aceptación falsa, checksum, asignación
y retención nativa se rechazan aun refrescando el hash interno del reporte.
No producen nuevas muestras. El resumen de recursos está en
`reports/memory/native-class-ownership/balanced-aa-2026-10-21.json`; las 768
observaciones tienen dos endpoints finales claros de Window/Document y los
contadores Rust se equilibran. Son escenarios A/A de éxito sobre checkpoint 67;
no cubren sus fugas conocidas durante errores ni garantizan ausencia universal.

Siguiente acción: publicar esta entrega, pedir review del SHA final y seguir
su CI. Merge/tag del PR 80 continúan pendientes del presupuesto; no cambiar
silenciosamente los criterios ni omitir checks. Antes de otra medición hace
falta una hipótesis discriminable adicional, con protocolo acotado y evidencia
que la motive. Carga/asignación por sí solas ya no bastan como explicación.
La implementación siguiente sigue siendo el control completo de `living/node.js`
(clonado y conversión), descrito en la auditoría publicada `014c7da` de
`feature/inventory-node-helpers`; esa rama permanece separada, sin PR, hasta
cerrar ownership. No contabilizar el diagnóstico como avance de migración ni
cerrar el objetivo global: siguen módulos y rutas de plataforma JavaScript.

## Estado actual: corrección aislada de ownership de clases nativas

La base estable es `main`, `3d37f89976a48203e80cc5c435e099267f4ce346`,
`checkpoint-067-xml-serializer-controller`. El PR 79 está mergeado y su rama
integrada está eliminada. Nueve checks y revisión remota limpia cubrieron
`a424bdd7be36af6c894b75c6579dbe3520348b78`; se verificó que el squash conserva
su árbol `9175f0953aba0ad4259bce6d81042dca3783f1bf`. El artefacto del último run
también se conserva en `reports/benchmarks/native-class-ownership/upstream-xml-controller/`.

Continuar en `feature/native-class-ownership`, worktree `native-class-ownership`.
El guard del SDK cubre tanto los class returns de `new_instance<T>` como los
constructores directos de `CallbackInfo::_construct`. La propiedad se transfiere
solo después de un wrap correcto; los errores anteriores destruyen el valor
Rust y los posteriores quedan a cargo del finalizador registrado. No incorpora
las primitivas experimentales del WIP de atributos ni completa APIs DOM.

La referencia inmutable del checkpoint 67 retiene ocho rangos, ocho parsers y
32.824 unidades UTF-16 después de ocho errores de cada constructor en Node
22.12.0 y 24.14.1. La regresión formal falla con ese SDK en ambos Node. El
candidato final `04863365060a1be4fe135880a89bdc1a289a0ae8247a0d3da922a90a9803069f`
registra diferencias cero y mantiene utilizables los receivers originales.
Los probes de ocho workers por Node terminaron balanceados: 1.051/357
asignaciones, respectivamente, sin retención observada.

Pasaron 311 tests Rust, fmt y Clippy en 1.98.1/1.99.1, seis tests del guard bajo
Memcheck y la revisión local del código contra la nueva base sin hallazgos.
Ambos Node completaron 3.743 tests Node, 22 Jest, 33 Vitest, 34 Vitest VM,
16 de validación, 112 del harness, HTML5, WPT, cinco modos generales de memoria
y veinte gates del paquete npm/pnpm. WPT conserva 240 fixtures/83.007 resultados,
1.203 fallos de estándar compartidos, bloqueo/exclusiones y `complete=false`.

La sesión de ejecución `19868`, comando
`.cache/validate-native-class-base67.sh`, runtime Linux
`/home/guido/rustdom-native-class-NMmiki`, terminó con exit 0. El comprobante
terminal y las salidas finales se guardan en
`reports/validation/native-class-ownership/base67/` y ya están archivados en el
worktree. La fuente validada tiene digest `8332276799c5ccc18c7a45a5136a856b039736597d5e104e22f074f8e23f1ddd`.
`manifest.json` enumera 245 reportes, sus compresiones reversibles y las fuentes;
`distribution-lockfiles.sha256` cubre además los locks pnpm. El protocolo ya
declarado en `reports/benchmarks/native-class-ownership/PROTOCOL.md` terminó
con exit 0 en la sesión `3734`: ocho bloques A B B A B A A B por Node, sin
builds/tests simultáneos. El driver conserva `index.json` y cada stdout/stderr/JSON en
`/home/guido/rustdom-native-class-NMmiki/reports/benchmarks/native-class-ownership/local/`.
Los 16 bloques/64 procesos y 4.608 duraciones ya están copiados al worktree en
`reports/benchmarks/native-class-ownership/local/`, con su comprobante terminal.
No repetir ni prolongar esa corrida según sus resultados. La referencia
inmutable está en `/home/guido/rustdom-checkpoint67-reference-0N9EG6`.
Rama de publicación de esta corrección: `feature/native-class-ownership`.
Consultar `git log` y el PR de esa rama para su SHA y estado remoto. Los datos
completos y la revisión local están archivados; merge y tag siguen pendientes
de resolver la precisión/atribución de la fila señalada y de review/CI del
head publicado. No se declara aceptado el presupuesto de rendimiento.

El resumen Node 22 está completo: seis de ocho controles jsdom no calibran.
`range-control-1000/1000` señala +9,4097% Rust con +0,7927% jsdom y requiere
investigación antes del checkpoint; no está aprobado el presupuesto de esa
fila. Node 24 completó ocho bloques: cuatro controles calibran y sus filas
quedan dentro del presupuesto, incluida esa Range con −2,7846% Rust y +1,5285%
jsdom; las otras cuatro filas permanecen inconclusas. Se declaró antes de nuevas
muestras un control negativo acotado en
`reports/benchmarks/native-class-ownership/DIAGNOSTIC-PROTOCOL.md`, sin alterar
los datos ni los umbrales del A/B. No repetir el A/B por ruido ni atribuir al
parche la aparente mejora grande de observers con control no calibrado.

La sesión `81635`, control negativo mediante
`reports/benchmarks/native-class-ownership/run-negative-control.cjs`, revisado
sin hallazgos. Solo seleccionó Node 22 y `range-control-1000`, con ambos tamaños;
ambas etiquetas cargan el mismo binario checkpoint 67. Sus archivos se guardan
en `/home/guido/rustdom-native-class-NMmiki/reports/benchmarks/native-class-ownership/negative-control/`.
terminó con exit 0: ocho bloques/32 procesos y 576 duraciones, archivados en
`reports/benchmarks/native-class-ownership/negative-control/`. Rust varió
−0,3895%/1000 y +0,7013%/250, pero jsdom −5,3452% y −20,5067%: no calibra y no
aprueba el A/B. No quedan benchmarks locales activos. No repetir el control
local hasta aprobar; resolver la precisión/atribución de la fila original antes
de aceptar su presupuesto y crear el checkpoint. Se publican el código probado
y los resultados para revisión, con merge/tag todavía pendientes.

El verificador `reports/validation/native-class-ownership/verify-evidence.cjs`
recalculó 5.184 duraciones de 96 procesos, los hashes de 245 reportes y 86
logs/comprobantes. Con `--staged` también verificó que las 337 fuentes
coinciden byte por byte con el índice Git. La revisión independiente de datos,
límites y herramientas cerró con cero hallazgos; no equivale a aprobar el
presupuesto pendiente ni sustituye la review remota del SHA final.

## Investigación posterior al head inicial del PR 80

El código y los primeros reportes se publicaron en
`8b5431534a6c7b2dbaac6a91bc0ad22a37a740f1`, PR 80 listo para revisión.
La review remota cerró limpia para ese SHA (recibo 6321337456). El run
`39635961966` completó Linux, Windows y los cinco checks de benchmarks;
macOS se canceló sin asignar runner por capacidad arm64 de GitHub. No hubo
pasos macOS ni se acredita esa validación. Los datos de infraestructura están
en `reports/validation/native-class-ownership/ci-39635961966/`.

La investigación local no modificó el SDK ni el arnés original. Se archivaron
los perfiles A B B A de dos versiones del método. La primera carece de marcas
usertiming exportadas y no permite correlación. La segunda exportó 24 marcas
por worker y seis calibraciones: 72 muestras medidas, GC en cero y superposición
garantizada/posible con compilación de fondo en 69. El primer cálculo de cotas
de CPU fue rechazado por review: `tdur` puede superar `dur`. Se preserva como
inválido y se reemplaza por `profiles/v2/analysis-wall.json`, sin inferir CPU
ejecutada a partir de intervalos de pared.

El microdiagnóstico real de `NativeRange.copy` completó 16 bloques A/A y 16 A/B,
72 muestras por etiqueta/fase y 10.000 copias por muestra. Verificó 3.840.000
copias incluyendo warmups, endpoints, independencia y liberación completa de
las copias. A/A +2,0921%; A/B −1,8688%, dentro de los presupuestos de esa
microprueba. No reproduce una penalización del camino modificado del SDK, pero
no sustituye ni aprueba la fila pública original de Range.

`diagnostic-evidence.json` preserva 113 archivos, sus hashes y compresión sin
pérdidas, incluida la invalidación explícita del análisis de CPU anterior.
`verify-diagnostics.cjs` valida los raw, los 32 procesos nativos y vuelve a
calcular el análisis de pared desde gzip. La revisión local cerró el P2 del
análisis tras retirar sus cotas de CPU; los contadores 72/69 y el microdiagnóstico
se recalcularon sin otros hallazgos. Los tres procesos locales terminaron con
exit 0; sus comprobantes están en `diagnostic-terminal-results.json`.

Los diagnósticos se publicaron en `df4ed9aee041157c0a53b884947f86f3f36e8463`.
No hay mediciones locales activas ni cambios de producción posteriores al
head inicial. El run general de ese SHA es `39642115708`; verificar su estado
actual y el del head posterior antes de acreditar CI. El fallo macOS anterior
es terminal y de infraestructura.

La siguiente comprobación está declarada en `HOSTED-PROTOCOL.md`: una sola
secuencia A/A + A/B de la carga pública original en un runner Linux independiente,
Node 22.12.0, ocho bloques por fase y los mismos warmups/muestras/umbrales.
El workflow `Native class ownership performance` construye checkpoint 67 y
el candidato; no cambia la fuente canónica ni reemplaza los resultados WSL.
Consultar sus runs por rama/SHA, esperar el handle existente y descargar/verificar
el artefacto antes de decidir aceptación. No reiniciar por falta de salida ni
repetir una medición completa para seleccionar resultados favorables.
El run independiente `39643090437`, job `119371473366`, terminó con failure
de sus presupuestos después de los 64 procesos y 1.152 duraciones completos.
Ninguna de las cuatro filas calibró. A/A: Rust +4,3101%/−0,4898%, jsdom
+3,6005%/−6,4675% para 1000/250. A/B: Rust +6,4527%/+2,4348%, jsdom
+213,4203%/−24,8075%. No es una falla de infraestructura y no resuelve la
atribución de la fila WSL original.

Los datos y la verificación están en `hosted/39643090437/`. El ZIP del artefacto
`12366716548` coincide con SHA-256
`3f2c2f3e6d03226a5160e77023647e6c52d464244f665abd00b6553625d8a266`.
El merge temporal `ef680ae827b755e5d371faa677c1a1fc4b80f771` y el head
`cdfcd58b89442f4e525dcb42e4265f661f6b613d` tienen el mismo árbol
`264d9afa6771fdfacbf380f9ae44be59a43eb3da`. La review remota del head cdf
cerró limpia, recibo `6322200524`; no cubre commits posteriores.

El workflow selecciona la evidencia existente solo si coinciden ambas fuentes
canónicas y el driver/protocolo. La verifica íntegra y conserva su fallo:
no reejecutar esta carga idéntica para seleccionar resultados favorables.
El presupuesto sigue inconcluso y exige una nueva hipótesis o mejora justificada
del método. Merge/tag siguen pendientes de ese gate, review y CI del head final.

El P2 remoto `4340088863` del positivo histórico se corrigió en
`8bb57b775c517ee4ec0690e9ed16891139c0a3f1`: snapshots reales de A/B, sin
depender del checkout actual ni de objetos Git antiguos. Pasaron 13/13 contratos
por Node 22/24, el verificador histórico y la revisión local. Push verificado,
reply `4340338267` y thread resuelto; nueva review `6323254745` cerró limpia
para `8bb57b775c`, recibo `6323294247`. El CI general de `9c195d88` completó sus
ocho checks con éxito; el de 8bb debe consultarse por su estado actual.

La siguiente hipótesis está fijada en `PAIRED-PROTOCOL.md`: intercalar A/B en
el mismo proceso conserva DOMs nuevos pero reduce variación entre procesos.
Se mantienen 1.000 operaciones públicas, ambos tamaños, tres warmups, nueve
muestras por etiqueta y los umbrales; son 32 procesos y 1.152 duraciones.
Hay copias físicas independientes de A/A, A/B y jsdom, con contadores comprobados.
Cinco contratos reales pasaron en ambos Node y la revisión local cerró limpia.
Los fallos iniciales de limpieza y la corrección previa al estudio están en
`reports/validation/native-class-ownership/paired-method/` y sus diagnósticos
en `reports/memory/native-class-ownership/paired-method/`.

La única corrida, sesión de herramienta `77662`, comando
`.cache/run-paired-study.sh`, terminó con exit 1. Root Linux preservado:
`/home/guido/rustdom-paired-fresh-6RCxVA`. Se verificaron 32 procesos, 1.152
duraciones y 1.536.000 copias incluyendo warmups; los seis archivos congelados
permanecieron idénticos y los endpoints finales de Window/Document quedaron
claros. Los datos están en `reports/benchmarks/native-class-ownership/paired/2026-10-21/`.

`complete=true` y `accepted=false`. A/A 250: Rust −9,3877%, jsdom +105,2222%;
A/A 1000: Rust −6,8094%, jsdom −1,3976%. A/B 250: Rust −6,5941%, jsdom
−38,0951%; A/B 1000: Rust +2,0522%, jsdom −0,9004%. La última fila cumple su
presupuesto, pero no compensa la calibración A/A fallida. No hay un proceso
local de medición activo ni se reinicia este estudio según sus resultados.

El método está publicado en `ec80a0e48358cac640077aa6272b5c58e670afa0`, con
review remota solicitada en `6323437962`. Verificar el head posterior y sus
checks/reviews antes de acreditar validación final. La siguiente investigación
debe considerar la identidad y carga de módulos: esta versión fija A antes de B
y la asignación de copias a etiquetas, aunque invierte orden de muestras/tamaños.
Eso es una condición del diseño, no una causa demostrada. El gate anterior y
el hito siguen abiertos; no hay aceptación global de rendimiento ni tag nuevo.

La auditoría independiente de `living/node.js` está publicada en
`feature/inventory-node-helpers`, `014c7daeb00fe700bb7eb2b5dc86718b7ef148da`,
worktree `migration-inventory`. Siete exports auditados; cuatro módulos híbridos
clasificados, mismos denominadores y porcentaje global desconocido. Pasaron
7/7 contratos en Node 22/24 sobre una copia Linux verificada; conserva un fallo
inicial de timeout en /mnt/c. Revisión local limpia. No tiene PR ni está
integrada; mantenerla separada hasta cerrar la corrección principal.

El runner WPT cierra los realms y cede un turno entre fixtures para permitir
liberar targets débiles. La corrida Node 24 que agotó old-space y sus controles
posteriores se preservan; el límite explícito de 2.048 MiB no limita RSS.
Mantener las exclusiones y los fallos de estándar compartidos visibles.

El inventario global continúa abierto y el runtime es híbrido. Este fix de
memoria no cambia los contadores de migración ni habilita un porcentaje global.
Después de integrar el hito, continuar las fases abiertas de ROADMAP.md y
priorizar responsabilidades completas de construcción, clonado y mutación.
Los WIP `feature/native-attribute-copy` y `feature/native-node-clone` permanecen
separados y no deben eliminarse como si estuvieran integrados.

## Registro: XMLSerializer validado, publicación final del PR 79

La base estable es `main`, `75db9bb095db8457a6ae567f219e2224a55b9f36`,
`checkpoint-066-reference-catalog`. Continuar en
`feature/native-xml-serializer-controller`, worktree `migration-inventory`.
El head de implementación validado es
`62cf726cc0ed0d1487db9dfa2100a78568638108`; los cambios posteriores de esta
entrega publican resultados, memoria y documentación. El alcance global del
inventario sigue abierto: no hay un porcentaje de migración defendible.

Codex revisó `62cf726` sin hallazgos. Su matriz general `39613157914` terminó
con ocho checks aprobados: Linux, Windows, macOS, cuatro shards y agregador.
Windows y macOS confirmaron 3.742 contratos en Node 24.21.0, 305 tests Rust y
los runners. El arnés de benchmarks tiene 112 contratos. Linux también aprobó
la distribución npm/pnpm en Node 24 y 22 y Memcheck completo.

El control dedicado `39613158016`, job `119267080556`, terminó correctamente:
Node 24.14.1/Rust 1.99.1, runner Ubuntu 22.04, AMD EPYC 7763, CPU 0. Se
verificaron 468 procesos (208 A/A, 208 A/B, 52 descriptivos), cada stdout,
medianas, orden, contadores y fuentes. Las trece filas calibraron: máximo
absoluto 1,378%; máximo A/B +3,263%, dentro de ±2%/+5%. El ZIP coincide con el
digest de GitHub. Resultados, verificador, procedencia y manifest están en
`reports/benchmarks/xml-serializer-controller/hosted/39613158016/`.

El merge temporal `e0d6021eefce8ba3a6602e9e2fc3147f29a1473f` tiene el mismo
árbol `80c9cf8bedb2ed6e4e4dd53e070ad113a6233e6b` que el head revisado.
La fuente medida candidata tiene hash
`67523bf38c8bfd32286618de24cee952b684f32fd91a322c407f7111cd73be3f`.
Node 22 local ya había calibrado y pasado A/B con máximo +2,522%. Se completa
la aceptación declarada del hito para esos hosts y protocolos; permanecen
publicados los fallos locales de Node 24 y todos los métodos anteriores.
La referencia del runner conserva costes Rust de 5,03–6,76× jsdom: no hay una
aceleración global demostrada ni un resultado universal entre máquinas.

El primer job tenía límite global de 50 minutos y terminó cerca del límite.
Los siguientes tienen 90 minutos de margen de infraestructura; no cambia el
protocolo, sus muestras, número de procesos ni umbrales. Ver
`reports/benchmarks/xml-serializer-controller/hosted-protocol.md`.

Se trasladó a Rust el control de serializeToString, captura de valores
lanzados, argumentos propios de Array y propagación de errores. El algoritmo
XML ya era Rust. WebIDL, DOMException y el controlador de fragmentos conservan
responsabilidades JavaScript. El inventario acredita tres módulos híbridos,
una API híbrida y un ancla con control Rust completo dentro de su alcance;
no acredita migración completa de sus dependencias.

La validación local conserva 109 focales por Node 22.12.0/24.14.1, 102
contratos públicos también sobre el runtime anterior, 305 tests Rust en
1.98.1/1.99.1, paquetes reales, runners y corpus. Hay 132 observaciones focales
de memoria por Node y ocho terminaciones de workers. HTML5 conserva 1.784
casos comparables y ocho exclusiones; WPT conserva paridad en 240 fixtures /
83.007 resultados, 1.203 fallos compartidos, una suite bloqueada y alcance
incompleto. Leer `reports/validation/xml-serializer-controller.md`.

Memcheck local pasó nueve tests XML; su corrida amplia interrumpida sigue
identificada como incompleta. El control posterior de CI sí completó 305
tests distintos en diez lotes: se verificaron y guardaron los 22 archivos
originales y su procedencia en
`reports/memory/xml-serializer-controller/ci-39613157914/`. Este ejecutable
Rust no sustituye las pruebas del addon real en V8.

Prioridad siguiente de memoria: aislar el guard de construcción del SDK que
estaba en el WIP de atributos. El probe de `NativeRange.copy`, ya integrado
en main, dejó dos rangos vivos después de ocho workers en Node 24. Su fuente,
cuatro salidas y límites están en `reports/memory/native-class-construction/`.
No atribuir esa fuga al controlador XML ni presentar el WIP como integrado.
La corrección aislada está en trabajo local, aún sin publicar, en
`feature/native-class-ownership`, worktree `native-class-ownership`, base 66.
Pasaron 311 tests Rust y Clippy en ambas toolchains, seis tests del guard en
Memcheck y 71 focales por Node. La regresión formal falla con el SDK anterior
y pasa aislada; la matriz amplia está en ejecución. No depende de aceptar las
primitivas experimentales de clonado.

Siguiente acción concreta: publicar esta evidencia, pedir revisión y verificar
los checks del head final del PR 79 antes de merge/tag. Consultar el estado
actual del PR y sus runs, sin relanzar handles todavía activos. Tras el merge,
verificar árbol y base, crear el siguiente tag incremental libre y eliminar la
rama integrada. Después completar la corrección de memoria aislada y continuar
las fases abiertas de ROADMAP.md. No cerrar el goal: siguen muchos módulos y
rutas de plataforma JavaScript pendientes.

Los resultados grandes de compatibilidad se conservan como JSON gzip sin
pérdidas, con manifest de bytes originales/comprimidos en
`reports/compatibility/xml-serializer-controller-archives.json`. Las fuentes de
los protocolos previos se conservan por separado. No ejecutar los archivadores
sobre resultados históricos ni sobrescribir sus muestras.

## Registro: catálogo inicial del inventario

La base integrada al comenzar esta entrega era `main`, `271221abbfeafebebb7dd817b98fd559592696d3`,
`checkpoint-065-attribute-reads` (PR 77). Los cuatro fallos históricos de DOMParser
ya están resueltos desde PR 70/checkpoint 58.

La entrega `feature/migration-inventory` agrega el generador real
`npm run inventory`, sus contratos y el catálogo de jsdom 27.4.0 en
`reports/progress/inventory/`. Incluye Location, constructores sin miembros
propios, APIs de Window, exports del paquete y dependencias; no se limita a
métodos escritos dentro de clases. Leer el README del catálogo para los
denominadores, el alcance abierto y la auditoría pendiente. No interpretar los
registros sin auditar como ausencia de implementación Rust ni publicar un
porcentaje antes de completar esa auditoría.

El WIP independiente `feature/native-attribute-copy` sigue publicado en
`c51f9fb578e30762474152765af01bb980ad2c12`, worktree `native-clone-seeds`.
Conserva la primitiva Rust y el fix de ownership. Su A/A pareado de Node 22
guardó 3.840 observaciones pero no calibró: cuatro filas superaron 5% sin cambiar
el motor. No habilita una nueva aceptación A/B ni un checkpoint de ese motor.
Las fuentes y el diagnóstico están publicados en esa rama; leer su HANDOFF
antes de retomar optimizaciones. El driver de clonado previo sigue preservado
en `feature/native-node-clone`, worktree `native-collection-queries`.

Después de este catálogo inicial, completar la clasificación por rutas públicas,
agrupar anclas en algoritmos y ampliar el inventario de dependencias y contratos
dinámicos. Conservar todas las diferencias y fallos conocidos. Priorizar después
entregas que retiren módulos completos, sin convertir un catálogo en certificación
de compatibilidad o de migración terminada.

## Registro histórico: lecturas de atributos

La base estable es main, commit baa87fa3eb1a62ec6477013bb305b2a79a0c3bb6,
tag checkpoint-064-id-lookups. El PR 76 está mergeado: ocho checks aprobados,
revisión limpia de be90ba1, árbol del squash idéntico al head revisado y rama
integrada eliminada. El índice de Document conserva orden de registro y aliases;
SVG incluye el root y admite un atributo ID vacío explícito. Los cuatro fallos
originales de DOMParser están resueltos desde PR 70/checkpoint 58.

El siguiente hito es feature/native-attribute-reads. getAttribute/getAttributeNS
combinan selección y valor en una llamada Rust; hasAttribute/hasAttributeNS
resuelven presencia sin mapear wrappers Attr. Los helpers de valor reflejado
resuelven el vacío en Rust; title y sus wrappers mantienen su propio fallback
en el host. Se conservan aliases históricos, orden físico NS, folding ASCII,
adopción y UTF-16. No se agregó cache ni ownership persistente.
WebIDL, factories y efectos generales permanecen pendientes; el runtime es híbrido.
Verificar PR, CI y SHA revisado antes de asumir integrado este hito.

La validación local pasó 305 tests Rust en 1.98.1/1.99.1 y, por Node
22.12.0/24.14.1, 3638 contratos Node, Jest 21, Vitest 32, VM 32,
273 focales y 105 de harness. Los veinte diferenciales públicos nuevos también
pasaron contra checkpoint 64, junto a diecisiete contratos previos. Pasaron
32 escenarios nuevos de GC por Node, cinco modos generales, Memcheck y cuarenta
controles del mismo paquete instalado. HTML5 pasó 1784/1784 casos comparables;
WPT ejecutó los 240 fixtures por Node, con paridad, 83007 resultados y 1203
fallos de estándar compartidos, complete=false y exclusiones sin reducir.

Los benchmarks finales guardan ambos órdenes, ocho reportes, 32 workers y
36 muestras por fila/motor/etapa/runtime. Incluyen once tareas públicas de
atributos y cuatro de Document/controles; las regresiones y el ruido se publican.
Un piloto previo de conversión inline UTF-16 se descartó por no mostrar una
mejora consistente; sus fuentes y muestras están archivadas por separado.
Queda optimizar attribute-get-miss: +14,95%/+8,96% en Node 22 a 100/1.000 Attrs
y +6,88% en Node 24 a 1.000. Los hits NS siguen en 0,16–0,82× frente a jsdom.
La tabla completa conserva también los costos de copia de valores largos.

- [Validación e identidades](../validation/attribute-reads.md).
- [Benchmarks](../benchmarks/attribute-reads/README.md).
- [Memoria](../memory/attribute-reads/README.md).
- [Piloto descartado](../benchmarks/utf16-input-pilot/README.md).

Conservar la llamada observable getAttributeNS durante alta/baja del Element:
quitarla rompió 86 trazas de FormData en el hito anterior. Las regresiones,
aliases, excepciones y mutaciones durante ese getter siguen verificadas.
El índice global permanece en 45,8% por áreas y no mide compatibilidad completa.
Continuar con los algoritmos generales de Node/Document/Element, factories,
WebIDL y las familias aún delegadas de ROADMAP.md; el objetivo integral está abierto.

Prompt para retomar:

```text
Retomá rustdom desde feature/native-attribute-reads; si fue mergeada, partí de main.
Leé AGENTS.md, reports/progress/HANDOFF.md, ROADMAP.md y
reports/validation/attribute-reads.md. Verificá el estado remoto, los checks y el
SHA revisado de cada PR antes de dar por integrada una rama.

Los cuatro fallos originales de DOMParser están resueltos desde checkpoint 58.
La base checkpoint 64 incorpora IDs Document/SVG. Terminá CI/reviews del hito de
atributos y continuá migrando los algoritmos de Node/Document/Element y las APIs
aún delegadas. Conservá aliases históricos, namespaces, UTF-16, errores,
identidades y efectos parciales. No elimines el hook observable getAttributeNS
del lifecycle. El fallback generado de title sigue en el host; no presentar
este hito como una migración completa de reflexión o del DOM.

El objetivo sigue siendo 100% Rust y compatibilidad verificable con jsdom;
la versión híbrida es intermedia. Instalá lo necesario sin preguntar.
Validá Node 22 y 24, guardá benchmarks y análisis de memoria observando
Document y Window por separado. Publicá cada hito bien probado con commit,
push y checkpoint. Aplicá codex-autofix-loop en cada PR, verificá revisión
del SHA actual y CI antes del merge y eliminá las ramas integradas.
No publiques paquetes npm automáticamente.
```

## Actualización del 20 de octubre de 2026

Los cuatro fallos originales de DOMParser están corregidos e integrados en
`main` por el PR 70. CharacterData conserva `undefined` en Rust, separado de texto vacío y de
`null`. También se corrigieron los errores de Range y el orden de mutaciones
parciales de `normalize()` que la revisión detectó al ampliar las regresiones.

- Clippy y los **262 tests Rust** pasan en Rust **1.98.1 y 1.99.1**.
- Los **279 casos focales**, incluido el control de GC de Window, Document,
  textos, rangos, grupos y errores, pasan en **Node 22.12.0 y 24.14.1**.
- La revisión independiente confirmó **76 casos adicionales por versión**,
  incluidos rangos vivos durante normalización; terminó sin hallazgos accionables.
- La validación general final pasó: **2.757 contratos Node, Jest 20, Vitest 31 y
  VM 30**, en ambas versiones; corpus HTML5 1.784/1.784, paridad WPT en 221
  fixtures, Memcheck sobre los 259 tests Rust y 40 controles del paquete instalado.
- Los [benchmarks antes/después](../benchmarks/dom-parser/README.md) conservan
  ocho procesos y todas sus muestras. Las variaciones frente al baseline son
  pequeñas en estas entradas; el parsing pequeño y normalize siguen teniendo
  costos frente a jsdom que requieren optimización. No se afirma una mejora general.
- Evidencia e identidades de fuentes/binario/paquete en
  [DOMParser y CharacterData](../validation/dom-parser-undefined.md). Comprobar
  el estado remoto del PR antes de continuar: después del merge, usar `main`.
- Para las pruebas de instalación en Node 22 usar **npm 11.19.0**, como en CI.
  npm 10.9.0 falla en su instalador con `Cannot read properties of null
  (reading 'edgesOut')`; no es un fallo del addon.

El PR **70** contiene el hito. Su primera ejecución de CI detectó que Rust
1.99.1 deprecó `AtomicU64::fetch_update`: los tres sistemas fallaron en Clippy.
Se reemplazó por un bucle CAS con atomics estables y se agregaron tres tests de
unicidad concurrente y agotamiento del espacio seguro de IDs JavaScript.
La suite general y los 40 controles del paquete instalado volvieron a pasar
en Node 22/24. Valgrind pasó los ocho tests del módulo y un control separado,
con los mismos residuos del harness. La evidencia de esta continuación está
en [compatibilidad con Rust 1.99](../validation/rust199-atomic.md); no reemplaza
las mediciones históricas de DOMParser hechas con Rust 1.98.1.

El objetivo integral sigue abierto: el runtime conserva factories, WebIDL,
drivers y otras APIs de jsdom. Estos resultados no equivalen a una reescritura
completa en Rust ni a conformidad completa con los estándares. Continuar con
los pendientes de [ROADMAP.md](../../ROADMAP.md) después de cerrar este hito.

Engram no está disponible en este entorno. No se usó otro sistema de memoria
persistente. Este archivo es el entregable de continuación solicitado por el
usuario; verificar siempre el código, los resultados y el estado remoto actual.

## Registro del traspaso anterior

Estado publicado el 16 de octubre de 2026. La evidencia de ejecución indicada abajo
es del 16 de septiembre de 2026; esta publicación conserva trabajo en curso y no
declara un nuevo checkpoint funcional.

## Punto de partida

- Repositorio: <https://github.com/guidomodarelli/rustdom>.
- Rama para continuar: `feature/native-dom-parser`.
- Último estado estable integrado: `main`, commit
  `c3b0f18a31fcb209fb0a3e66f5a7b7e0ea9f20ca`, tag
  `checkpoint-057-document-implementation`, PR 69 mergeado.
- El objetivo sigue abierto: migrar el 100% de la implementación a Rust con
  compatibilidad verificable con jsdom. La implementación actual es híbrida.
  Leer [ROADMAP.md](../../ROADMAP.md),
  [avance por módulos](native-migration.md) y [AGENTS.md](../../AGENTS.md).
  Las fases históricas completas y los índices de avance de esos documentos no
  certifican compatibilidad total ni terminación de la migración.
- No se creó un tag funcional ni se mergeó este trabajo pendiente a `main`.

## Preparar el entorno

```sh
git clone --branch feature/native-dom-parser git@github.com:guidomodarelli/rustdom.git
cd rustdom
npm ci
npm run build
```

Instalar Node, npm y Rust con Cargo, rustfmt y Clippy si faltan. El usuario autoriza
instalar las dependencias necesarias sin pedirle permiso. Se necesita un linker
y la toolchain nativa de la plataforma; Windows usa MSVC. Para reproducir la
evidencia anterior se usaron Linux x64, Node 24.20.0 y Rust 1.98.1. El paquete
admite Node `^22.12.0 || >=24.0.0`; usar las dependencias de `package-lock.json`
y `Cargo.lock`. El repositorio no fija un archivo `rust-toolchain`.

El addon se reconstruye para la máquina de destino. Los directorios `dist/`,
`target/`, `node_modules/`, `.tools/` y `.cache/` son locales y no forman parte
de esta publicación. Para continuar no hace falta recuperar los antiguos
clones de WSL ni sus rutas absolutas.

## Qué contiene el trabajo pendiente

- [Controlador Rust de DOMParser](../../src/dom/dom_parser.rs): selección MIME,
  creación de documentos con scripting deshabilitado y recuperación XML con
  `parsererror`. Los valores lanzados desde JavaScript se conservan mediante
  handles del scope N-API, incluidos valores primitivos.
- [Puente JavaScript](../../src/dom/dom-parser.cjs): conserva los realms,
  factories y entrada del parser existentes. Mantiene las llamadas observables
  a `String`, `TypeError`, getters, receptor y cantidad de argumentos. Esto
  todavía no migra las factories, WebIDL ni todo el parsing a Rust.
- Integración en build, manifiesto de distribución, exports, tipos y estadísticas
  `getNativeTreeStatistics().domParserOperations`.
- [Tests de contratos](../../tests/dom-parser-controller.spec.cjs) y
  [tests de recuperación](../../tests/dom-parser-recovery.spec.cjs), comparados
  con el jsdom independiente de `node_modules`, versión 27.4.0.
- [Procedencia de la integración](../validation/parser-main57/context.json):
  snapshots `base`, `parser`, `upstream` y `merged`. Son evidencia histórica;
  los archivos activos están en `src/`, `scripts/` y `types/`.

## Validación conservada y límite actual

La primera ejecución usó el controlador DOMParser sobre el commit base
`9f9970297dd28a87500b7faaac1bbe495798728e`, anterior al hito 57:

| Comprobación | Resultado conservado |
| --- | --- |
| Clippy con warnings como errores | Aprobado después de quitar un `to_vec` innecesario |
| Test Rust de selección MIME | 1 aprobado |
| Build nativo y JavaScript | Aprobado |
| Contratos DOMParser, Node 24.20.0 | 170 casos: 166 aprobados, 4 fallidos |
| Los mismos contratos en Node 22 | No ejecutados: el script terminó tras el fallo en Node 24 |

Los [logs](../validation/dom-parser/) y los resultados diferenciales de
[contratos](../compatibility/2026-09-16T03-14-57.103Z-dom-parser-controller.json)
y [recuperación](../compatibility/2026-09-16T03-14-57.103Z-dom-parser-recovery.json)
están incluidos. `clippy-before.log` conserva el fallo inicial ya corregido.

Después se integró el trabajo sobre `main` en el hito 57, preservando tanto
DOMImplementation como DOMParser. **Esta combinación publicada aún no fue
compilada ni testeada.** No se ejecutaron benchmarks, análisis de GC, WPT ni
validación de distribución específicos de DOMParser. Los resultados históricos
de otros hitos no validan esta combinación. En esta publicación no se volvieron
a ejecutar las suites: se guarda el estado pendiente para continuarlo.

## Próximo paso concreto: CharacterData con `undefined`

Los cuatro fallos son los casos XML que lanzan un número o un símbolo desde
`createScriptingDisabledDocument`, en los realms default y VM. Su propiedad
`message` es `undefined`. jsdom crea un Text interno cuyo `_data` conserva ese
valor y recién falla al serializar el `parsererror`. Rustdom falla antes al
convertirlo a `Utf16String`.

La [comparación con el baseline](../validation/dom-parser/undefined-character-data-baseline.jsonl)
demuestra que el problema también existe antes del nuevo controlador. La
[superficie de referencia](../validation/dom-parser/undefined-reference-surface.json)
registra 17 operaciones. Ejemplos que debe conservar la solución:

- `Text.data`, `nodeValue`, `textContent` y `wholeText` de un único Text devuelven
  `undefined`; el `textContent` del padre devuelve la cadena `"undefined"`.
- Longitud, substring, sustitución de datos, normalize y selección de contenido
  por Range conservan sus errores de acceso a `length`.
- Clonar preserva el valor; el clon es igual al original y distinto de Text vacío.
- La serialización XML falla con `InvalidStateError` al acceder a `replace`;
  la HTML conserva su error al acceder a `substring`. `:empty` devuelve false.

No se implementó todavía ninguna representación nativa para ese valor. No
sustituirlo por una cadena vacía ni debilitar los tests. Probar además `wholeText`
con varios Text adyacentes antes de decidir su concatenación: aún no está medido.

Revisar `src/dom/data.rs`, `character_data.rs`, `store.rs`, `napi_string.rs`,
`tree.rs`, `node_comparison.rs`, el puente `src/dom/native-tree.cjs`, las
sustituciones de CharacterData en `scripts/build.mjs` y ambas serializaciones.
El valor debe conservarse de manera coherente en almacenamiento, getters,
igualdad, clones, operaciones de texto y errores de serialización.

## Secuencia para cerrar el hito

1. Reconstruir esta rama y reproducir los fallos sin modificar las expectativas:

   ```sh
   cargo clippy --locked --all-targets -- -D warnings
   cargo test --locked dom::dom_parser::tests
   npm run build
   node --test tests/dom-parser-controller.spec.cjs tests/dom-parser-recovery.spec.cjs
   ```

2. Corregir CharacterData con pruebas diferenciales reales y regresiones sobre
   los consumidores afectados. Revisar también las reglas actuales de constantes
   y documentación antes de cerrar el diff de DOMParser.
3. Ampliar las pruebas de `String`, `TypeError`, acceso al realm/URL, orden de
   efectos, aridad, reentrada y errores de recuperación. Ejecutar en Node 22 y 24.
4. Medir ciclos repetidos de éxito y recuperación, errores primitivos y con
   referencias al DOM. Observar Document y Window por separado, GC, heap,
   memoria externa/RSS y retorno de contadores nativos al baseline. Guardar los
   resultados en `reports/memory/` y describir los límites de la medición.
5. Crear y ejecutar benchmarks equivalentes antes/después, con controles jsdom,
   muestras crudas, versiones, hardware y costo del puente. Guardarlos en
   `reports/benchmarks/`, incluidas las regresiones.
6. Ejecutar `npm run validate`, `npm run test:memory`,
   `npm run test:native-memory` en Linux con Valgrind, `npm run package` y
   `npm run test:package`; revisar Jest, Vitest, VM, corpus y WPT. Conservar
   resultados y cualquier exclusión, sin confundir paridad con conformidad total.
7. Cuando esté validado: commit, push y PR hacia `main`; aplicar las skills de
   descripción, review y `codex-autofix-loop`. Atender comentarios, repetir review
   sobre el SHA publicado, esperar checks, mergear, eliminar la rama integrada y
   crear el siguiente tag incremental sin mover tags existentes. Continuar con
   los módulos pendientes del roadmap; no publicar paquetes npm automáticamente.

MCP `memory` no estuvo disponible al preparar esta publicación. Este documento,
las reglas y la evidencia versionada permiten retomar el trabajo sin esa
integración ni el historial local del chat.

## Prompt original guardado antes de corregir los cuatro fallos

Este prompt se conserva como registro del pedido. Para retomar, leer primero la
actualización del 20 de octubre y la evidencia actual, sin repetir trabajo ya validado.

```text
Continuá el desarrollo de rustdom desde la rama feature/native-dom-parser:
https://github.com/guidomodarelli/rustdom

El avance publicado está en el commit b974df3. Actualizá la rama sin sobrescribir cambios locales ni usar force-push.

Antes de modificar código, leé:
- AGENTS.md y las instrucciones aplicables del entorno.
- reports/progress/HANDOFF.md completo.
- ROADMAP.md.

Seguí las instrucciones del HANDOFF para preparar el entorno. Instalá directamente las herramientas y dependencias necesarias, sin pedirme permiso.

Tu primera tarea es reproducir y corregir los cuatro tests pendientes de DOMParser:
- tests/dom-parser-controller.spec.cjs
- tests/dom-parser-recovery.spec.cjs

La ejecución anterior dio 166/170 aprobados sobre una base anterior. La combinación publicada con el último main todavía necesita compilarse y validarse.

Los cuatro fallos conocidos involucran errores numéricos o símbolos durante la recuperación XML, en los realms default y VM. Exponen una diferencia preexistente de CharacterData cuando su dato interno es undefined. Revisá la evidencia en reports/validation/dom-parser/.

Implementá una solución coherente en Rust que preserve el comportamiento del jsdom independiente, incluyendo getters, clones, igualdad, operaciones de texto y serialización. No debilites las expectativas ni sustituyas undefined por una cadena vacía para hacer pasar los tests. Los snapshots dentro de reports son evidencia histórica, no código activo.

Agregá las regresiones necesarias, ejecutá las pruebas relevantes en Node 22 y 24, analizá retención y liberación de memoria, y guardá los resultados y benchmarks según AGENTS.md.

Avanzá autónomamente. Antes de crear un checkpoint funcional, completá la validación y la revisión exigidas. Hacé commit y push de los avances validados y actualizá el HANDOFF con lo resuelto y lo pendiente. Comunicá el progreso en español.
```
