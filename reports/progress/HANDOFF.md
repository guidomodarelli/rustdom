# Continuar rustdom en otra máquina

## Fix del checkout anidado del CI — 2026-10-25

Run40165248396/f2c449e6/intento1 terminó failure6/6: cargo fmt descubre el
Cargo.toml del checkout auxiliar sparse sin src/lib.rs. Los seis preparadores
pasaron; el fallo ocurre antes de compilar. Se preservaron seis artifacts
íntegros autenticados y el ZIP de logs (90 miembros) en el packet
reports/validation/range-combined-ci/20261025-nested-layout-fix/.

Fix propuesto: excluir solo !/Cargo.toml del primer checkout. No modifica el
manifest ni fuentes del candidato. La reproducción con dos Git reales anidados
confirma Cargo falla1 antes y pasa0 después, ambos árboles limpios. Pasaron
315 Rust, build/Clippy, tipos, consumidores y 84 dirigidos. La entrada completa
continúa EN VIVO en sesión96801; antes de reiniciar o darla por terminada,
consultar el mismo handle y /home/guido/rustdom-validation/
combined-ci-nested-layout-20261025/proof/qualification.json. No repetirla.

El workflow ampliará el upload a dist/types/src/manifests íntegros para fijar
el paquete de la futura medición. No se ha activado otro estudio ni elegido un
artifact por rendimiento. Siguiente: publicar el fix probado/revisado, verificar
los seis jobs nuevos y conservar la calificación local final cuando termine.
Mantener599pins/48ajenos/rechazo histórico, sin tag/merge. Autorización permanente;
objetivo general activo, runtime híbrido y migración incompleta.

## CI funcional del candidato combinado preparado — 2026-10-25

Workflow combined-range-candidate.yml: seis jobs Linux/Windows/macOS por
Node 22.12.0/24.14.1, Rust 1.99.1. Base Git real f781c3b7, patch autenticado,
producción/599 pins/48 entradas ajenas intactos. Jobs remotos específicos
pendientes de esta publicación; CI general 2f9275ad/run40163238026 success en
las tres plataformas. No confundir ese CI con la calificación del candidato.

Entrada pública prepare.py + qualify.py completa en Linux/Node 24: 22 comandos
exit 0, 315 Rust, 84 dirigidos, 3784 contratos + 9 de proceso, consumidores,
22 Jest/33 Vitest/34 VM, HTML 1784 y 8 excluidos; WPT 240 fixtures/83007 assertions,
1203 fallos compartidos/complete=false. Ambos probes finitos aprobados;
ELF reconstruido idéntico ce91c742. QA íntegra y fuentes en
reports/validation/range-combined-ci/20261025/; recursos en reports/memory/.

Preparación 8/8 por Windows/Linux y origen shallow depth 2; comandos 5/5 por
Windows/Linux, Actionlint 0. La prueba auxiliar shallow inicial se detuvo porque
clone transportaba historial completo; se preservan parciales/código/árbol.
Setup corregido con objetos compartidos y boundary real pasó sus ocho casos.
La entrada completa no se interrumpió. Sin mocks ni nuevas capturas históricas.

Límites: job 60 min, qualify 40 min, upload 5 min; comando 20 min y cleanup 30 s.
Artifact lector 2f9275ad/run40163238037/id12587437390 autenticado íntegro.
Ownership/run40163238098 sigue rechazado; no aceptación, tag, integración ni merge.
Siguiente: publicar esta CI, seguir los seis jobs del SHA nuevo y corregir fallos
reales. Después fijar/revisar calificación prospectiva del candidato combinado.
Autorización permanente ya registrada y hooks activos; no pedirla nuevamente.
Objetivo general activo/incompleto, runtime híbrido, sin porcentaje defendible.

## Candidato combinado StaticRange/colapso validado localmente — 2026-10-25

Se publicó exploración en f781c3b7. CI lector09b/run40160504234 y
f781/run40161044874 aprobaron; artifacts12585808707 y12586648557 autenticados.
Ambos son lectores offline, no validación del runtime candidato. Captura40154725015
consumida, completa y publicada: no relanzar ni completar muestras.

Nuevo candidato en reports/implementation/range-combined-candidate/; fuente
basef781c3b7 y10preimages/outputs fijados. Combina StaticRange4f3a2d80 con
collapse07edaa89; patch7fe5ec80. ELF Linux nuevoce91c742, conservado completo.
No cambia producción ni paquetes A0/A1/J0/J1/B. Runtime sigue híbrido.

Checkout real Linux privado range-combined-candidate-20261025-f781: source y
roundtrip para suites separadas. Se verificaron los10archivos idénticos y ELF.
315Rust1.99.1 +fmt/clippy0; porNode22.12.0/24.14.1:84dirigidos,3784contratos
+9deprocesoWPT,22Jest/33Vitest/34VM, consumidores CJS/ESM y dos probes de memoria.
HTML1784/1792,8excluidos; WPT240fixtures/83007assertions,1203fallos compartidos,
completefalse y exclusiones/bloqueos íntegros. Ambas suites completas exit0.

Memoria porNode:6ciclos StaticRange,774altas/bajas y768rechazos;6ciclos de
clones/colapso/mutación,384altas/bajas. Window/Document separados, controles
retenidos y22constructores estables. No memoria pico ni garantía universal.
QA/comandos/reportes/fuentes y errores iniciales de preflight/empaquetado en
reports/validation/range-combined-candidate/20261025/. Probes completos en
reports/memory/range-combined-candidate/20261025/. Usar fuentes actuales+patch,
no ejecutar archivados. Revisión inicial código0; cierre integral según recibo.

Siguiente: publicar esta preparación comprobada y verificar CI/revisión del SHA;
preparar CI funcional del candidato y calificación prospectiva de rendimiento,
con procesos/observaciones repetidas/warmup explícitos. No aceptar desde el
análisis post hoc, repetir secuencias históricas ni tocar599pins/48ajenos.
Sin tag/merge ni crédito al inventario hasta aceptación e integración. No pedir
otra autorización; objetivo general activo e incompleto. Preservar watch compartido.


## Variación entre pares y dentro de cada proceso AA — 2026-10-25

El resultado completo se publicó en09b86d33; su CI lector40160504234/job121070864546
sigue en cola según la última observación. No repetir captura40154725015.
Exploración post hoc nueva en reports/benchmarks/native-class-ownership/
range-aa-exploration/40154725015/:128pares,256procesos,192grupos de índice,
768warmup/2304medidas completos. Cinco outputs idénticos Windows/Linux;
8contratos por plataforma y Actionlint0. No DOM, profiling, replay ni mediciones
nuevas. Los599pins, paquete fuente09b y48entradas ajenas se preservan.

jsdom CPU/Node22: mediana agrupada+19.1964% y mediana de diferencias por par
+4.1625% (13de16positivos). Fórmulas distintas, no resultados intercambiables.
jsdom JIT/Node22: mediana del cambio entre primeros/últimos tres spans medidos
+22.9116%, extremos−27.2139%/+99.6612%. Todas las cohortes/pares se publican.
No inferir causa, estacionariedad, nueva aceptación ni reemplazar el estimador
histórico; performanceAccepted=null/gateReevaluated=false. Runtime híbrido.

Siguiente: verificar CI y publicar evidencia final de lectores; preparar el
siguiente candidato funcional Rust y su calificación prospectiva con procesos,
observaciones repetidas y warmup explícitos. No reutilizar estudios consumidos
ni pedir autorización. B/StaticRange siguen sin calificación ni integración.
Sin tag/merge mientras ownership siga rechazado. Objetivo general activo.


## Diagnóstico AA completo, preservado y reproducido — 2026-10-25

Run40154725015/job121053535757/intento1 terminó success. Fuente d5ec4186;
única secuencia consumida, no activar ni completar muestras. Artifact12585116890
autenticado por ID/run/commit/intento/nombre/tamaño/digest: ZIP334895287B
SHAa55d06f0..., tar334797896B SHAc523e4a2..., íntegros en26partes versionadas.
Resultado: reports/benchmarks/native-class-ownership/range-control-telemetry-results/40154725015/.
Conservar599pins, fuentes/paquetes históricos y48entradas ajenas.

Replay estricto completo en checkout Git Linux real limpio d5ec4186, con
Node22.12.0/24.14.1 autenticados:256procesos/2304medidas/768warmup,
3072Window y3072Document separados,128CPU/128JIT, tres rondas por proceso,
512estados finales claros y0primeros no claros, tres snapshots del padre.
Ocho exports idénticos entre SDKs;273deltas CPU negativos conservados.
Seis derivados descriptivos idénticos Windows/Linux. Conservar ausencia de
baseline nativo en jsdom y todos los contadores/endpoints originales.

Tabla AA íntegra en README/descriptive-aa.csv: jsdom CPU/Node22 +19.1964%
entre copias; híbrido CPU/Node22 −0.4837%. Son medianas instrumentadas,
sin decisión de equivalencia ni causalidad. LabelsA/B son copias AA, noB.
Los ticks señalan wrappers cloneRangeData/collapseRange/compareRanges;
V8 no garantiza stacks internos Rust. No adjudicar causas solo por correlación.

Memoria:22constructores antes/final, sin altas; RangeStates7680000 altas/bajas,
live0→0, contadores de proceso entero incluidos fixtures/warmup/teardown.
Informe reports/memory/native-class-ownership-range-aa-40154725015.md.
No afirmar memoria pico ni ausencia universal de fugas. performanceAccepted=null,
gateReevaluated=false; rechazos históricos vigentes, sin tag/merge.

QAreal:5contratos por Node, transporte8Linux/7Windows+1skip, reconstrucción7/7
en ambos, artifact9/9, descripción5/5 en ambos. Calificación end-to-end con
reconstrucción/extracción fresca y replay de ambos SDKs exit0; Actionlint0.
CIprevio be675a21/run40156502665 aprobado, artifacts/logs incluidos. CI del
commit de resultados pendiente tras push. Todos los intentos/fallos previos
están en validation/evidence.zip, solo inspección; usar tools/ actuales.

Narrativa del inventario corregida al catálogo real:531archivos/6auditados,
4331APIs/32auditadas,7246anclas/1auditada. Ningún archivo Rust completo;
una ancla Rust no equivale a un algoritmo normativo completo. Sin porcentaje.
7contratos por Node pasan en checkout Linux limpio con código del inventario
idéntico al actual; conservar timeout inicial de Node22 en volumen Windows y
helper faltante del primer checkout. No se alteró ningún timeout del producto.

Siguiente: publicar este paquete y verificar CI/revisión del SHA final; después
investigar fronteras Range y preparar un candidato nuevo con método prospectivo.
La autorización permanente y hooks siguen activos: no pedirla de nuevo.
No repetir esta captura ni alterar sus599pins. No integrar aún StaticRange.
El objetivo general sigue activo, híbrido e incompleto. Mantener sidecar propio
y preservar el watch compartido; no usar Engram sin registro de identidad.


## Exportador de recursos completo preparado — 2026-10-25

La captura AA sigue vinculada únicamente a40154725015/121053535757/intento1,
fuente d5ec4186. No volver a activar ni completar muestras. El código/fixtures/QA
portable de su análisis están en reports/validation/native-class-ownership/
range-control-telemetry-analysis/20261025/. No se modificaron los599pins.

El exportador añade resources-native.jsonl: baselines, owners, nueve endpoints
y todas las rondas/nativeTree sin seleccionar familias. Sus pins del resultado
nuevo siguen null: artifact, autenticación y replay completo aún pendientes.
Cuatro contratos por Node22.12.0/24.14.1 pasan con128reportes AA Range históricos
y UN control MutationRecord histórico separado para primera ronda no clara.
La fixture conserva los bytes originales, con tamaño/hash/offset contra el
índice versionado. Código archivado en evidence.zip es solo inspección.

QA completa con política histórica40051899308:512procesos/1536snapshots y211
primeras rondas no claras. Siete exports anteriores idénticos al repositorio;
ocho incluyendo JSONL idénticos entre ambos Node. Cinco contratos previos por
Node también pasan. No son resultados nuevos de Range. Se conservan errores
iniciales de fixtures/test y sus correcciones sin cambiar mediciones. Actionlint
aprueba el workflow nuevo de cuatro contratos por Node, timeout10/subida5min;
CI remoto del commit nuevo pendiente. Windows no se ejecutó para esta ampliación.
performanceAccepted=null/gateReevaluated=false; ownership rechazado, sin tag/merge.
Preservar48entradas ajenas/watch y seguir con la misma captura. El objetivo general
sigue activo, híbrido e incompleto.

## Diagnóstico AA activado una vez — 2026-10-25

Seguir únicamente run40154725015/job121053535757/intento1 de guidomodarelli/rustdom,
fuente d5ec4186d2033709e532bc93d6f47d930afe525f, PR80. El step de captura está
en curso al guardar este registro. La etiqueta ownership-range-control-aa-telemetry-v1
se aplicó una vez (evento34161128543, 02:30:44 UTC). No ejecutar activadores,
reaplicar etiquetas, relanzar workflows ni completar muestras faltantes.
La autorización permanente ya está concedida; no preguntar nuevamente.

CI previo: general40152264918 aprobado8/8, incluido Valgrind; método40152264828
aprobado en ambos Node fijos. Se comprobaron seis checks recientes del SHA exacto.
Doce workflows históricos quedaron omitidos. El grafo599, los563pins, métodos,
paquetes preparados y presupuestos55/65/90/15/10 siguen intactos.

Registro portable:
reports/validation/native-class-ownership/range-control-telemetry-activation/d5ec4186/.
Incluye evidencia íntegra/manifest y readers actuales de transporte, probados
con el run real en Windows (7pass1skip) y Linux (8pass). Los pins finales de
artifact siguen null hasta observar/autenticar el archivo terminado. No extraer
ni ejecutar código archivado. El collector solo sigue este run/job y guarda
parciales; nunca ejecuta DOM ni inicia otra secuencia.

La primera invocación local falló antes del POST por conversión Windows→WSL.
Se probó el fix y luego se envió el único POST. El lector WSL también detectó
gh ausente en PATH; se usó el CLI real existente mediante shim local scoped,
sin mocks. Todos los fallos y snapshots incompletos quedan preservados.

Para replay: checkout Git Linux real y limpio de d5ec4186; local preparado
/home/guido/rustdom-validation/range-aa-telemetry-source-d5ec4186, comprobado
en Node22.12.0/24.14.1 con hashes fijados. No leer un gitfile Windows desde Git
WSL, no normalizar sourceCommit/sourceChanges/sourceGitErrors. Este commit de
registro puede ser posterior; la medición permanece vinculada a d5ec4186.

Plan256, medidas2304/warmup768, Window3072/Document3072 separados y128CPU/128JIT
son cantidades planificadas. Las observaciones finales y replay nuevo completo
siguen pendientes. Analizar nativeTree de Range completos y publicar también
regresiones, clocks inciertos, deltas negativos y primeros estados no claros.
performanceAccepted=null/gateReevaluated=false; ownership sigue rechazado.
Sin tag/merge ni integrar StaticRange aún. Preservar48entradas ajenas y watch
compartido; usar sidecar propio. La migración general sigue activa e incompleta.

## Método AA con capacidad configurada — 2026-10-25

range-control-telemetry conserva el mismo plan256 y presupuestos55/65/90/15/10.
captureImplemented=true y mapas finales893por modo. Habilitar el flag no
ejecuta: se exige recibo de revisión íntegra, contexto hospedado exacto, historial
sin otro run no omitido y los seis checks recientes aprobados del SHA publicado
antes de aplicar UNA etiqueta ownership-range-control-aa-telemetry-v1 al PR80.
La autorización permanente ya cubre este diagnóstico, sin otra pregunta.
No se aplicó etiqueta ni se ejecutaron DOM/profiling nuevos en esta QA.

QArealLinux privada limpia55842ac1 sobree61dceac: grafo599/563pins conservados,
17contratos porNode22.12.0/24.14.1, seisPython de derivación y seisreaderLinux.
Planes/preflights byteidénticos, Actionlint0. El contexto válido del colector
usa Git real y evento fixture sin APIs ni run(); diez casos inválidos se
rechazan. El worker rechaza host/intento/run/commit inválidos antes de sidecar,
reporte, fuente u observadores en ambos Node/modos. No simular muestras nuevas.

Evidencia reports/validation/native-class-ownership/range-control-telemetry-enabled/20261025/:
ZIP3af44fc0/19928523bytes/2421miembros, fuentes/derivaciones/contextos/logs.
Paquetes y datos históricos se enlazan íntegros por hash sin duplicarlos.
Windowsreader intacto usa QAprevia5pass1skip por symlink, cubierto enLinux;
no contar esa batería como repetida. No ejecutar código archivado ni normalizar
sourceCommit/sourceChanges/sourceGitErrors. Los commits privados no se publican.

Recibo íntegro registrado en
reports/validation/native-class-ownership/range-control-telemetry-method/review.json,
SHA bdab7f46, grafo599 y revisión aislada cero hallazgos sobre601paths.
publication-proof/ conserva una aceptación y cuatro rechazos por Node del
lector real: privada bb48a085 sobre55842ac1 añade solo el recibo. Se conservan
los ` M` reales de las mutaciones; finally restaura el recibo y Git limpio.
Nunca se alteró el recibo canónico de primary. No APIs/DOM/profiles nuevos.

Siguiente: publicar el método y su recibo, comprobar CI del SHA final y
activar UNA vez solo si se cumplen. No relanzar ni completar un run parcial;
conservar ZIP/tar/API/logs/manifiesto/muestras/warmup y verificar offline con
fuente real limpia del SHA capturado en ambos Node fijados. Aún no existe replay
positivo nuevo. performanceAccepted=null/gateReevaluated=false, ownership sigue
rechazado, sin tag/merge ni integrar StaticRange. Preservar48entradas ajenas y
watch compartido con sidecar propio. La migración general sigue pendiente.

## Contratos portables y workflows AA — 2026-10-25

El método range-control-telemetry ya tiene workflows de contratos y captura,
pero captureImplemented=false. No aplicar etiqueta todavía; la autorización
permanente está concedida. Faltan registro de mapas al habilitar capacidad,
revisión íntegra del método habilitado y CI del SHA exacto antes de una sola
activación. No relanzar los estudios históricos consumidos.

historical-fixtures.py autentica el ZIPsubset3f249e84/15283591bytes con57archivos
originales de ocho procesos MutationRecord del run40051899308. Conserva índice
completo512 sin relabelar, hashes/ordinals y96spans por lector; no es captura
Range. qualify.py crea derivaciones y prueba ambos Node en Git real limpio,
sin DOM/profiling nuevo ni recompilar/instalar paquetes. Usa un probe propio
trackeado, restaurado por los contratos. Límites55/65/90/15/10min intactos.

QArealLinux privado cfa6f167 sobre7b6fca9d: grafo599, mapas893por modo,
17contratos porNode22.12.0/24.14.1, seisPython de derivación y seisreaderLinux.
Windows5pass/1skip por WinError1314 symlink, caso cubierto enLinux.
Planes/preflightsbyteidénticos; Actionlint0. Evidencia en
reports/validation/native-class-ownership/range-control-telemetry-portable/20261025/:
ZIP0f3ced6a/19928725bytes/2424miembros, logs/contextos/derivaciones originales.
Los inputs ya versionados se enlazan por hash en vez de duplicarlos.
No ejecutar código archivado ni presentar el commit privado como publicado.

La capacidad aún está cerrada; no hay replay positivo de un diagnóstico
nuevo. performanceAccepted=null/gateReevaluated=false no modifican el rechazo
histórico de ownership. Sin tag/merge ni integrar StaticRange todavía.
Preservar563pins y48entradas ajenas, sidecar propio y watch compartido intacto.
La migración general sigue activa e incompleta.

## Colector y replay AA implementados, sin captura — 2026-10-25

Componentes en reports/benchmarks/native-class-ownership/range-control-telemetry/:
context/derived/observations/commands/readiness/capture/replay/run. Grafo590,
incluidos563pins históricos y recibo83ef; mapas893por modo. Registran argv/root
originales y fuente real, rechazan extras/recibos reescritos, comprueban checks
recientes, run vivo e historial completo y consumen un recibo exclusivo por run.
Budget55min comprobado antes del worker entero y tras análisis/verificación.
Captura sigue FALSE y workflowSources vacío: no aplicar etiqueta ni ejecutar.
No es autorización pendiente; la autorización permanente ya cubre el trabajo.

QA: reports/validation/native-class-ownership/range-control-telemetry-components/20261025/.
Final17contratos por Node22.12.0/24.14.1 y seis Python; planes/preflights
byteidénticos. ZIPd00ff4d4/5436miembros y818da320/1813miembros preservan todas
las baterías/fuentes/comandos; conteos16/16/17 anteriores se solapan.
QAfinalGitLinux955f3beb es privado/limpio sobre254d0e9f, no un SHA publicado
ni runtime compilado. Los ocho procesos históricos40051899308 conservan96spans,
identidad MutationRecord y hashes; no se presentan como datos de Range y se
rechazan como captura nueva. No hay replay positivo de un run nuevo aún inexistente.
No se ejecutó DOM, profiling o medición nuevos. No ejecutar código archivado.

Siguiente: integrar workflows y CI del método completo, materializar fixtures
portables auténticas para los ocho procesos históricos sin relabelar el índice,
conservar hashes/ordinals y dejar claro que es un subset de regresión del lector.
Reutilizar el transporte actual; no ejecutar scripts del archivo ni extraer
muestras nuevas. Completar registro final de mapas, actualizar guards/tests al
habilitar capacidad, revisión íntegra y checks exactos del SHA antes de una
única activación nueva. Mantener budgets, fila, semillas, warmup y256planificados.

El CIgeneral de la base254d0e9f (40148166722) aprobó8jobs, incluido ValgrindLinux;
no es CI del código nuevo ni aceptación de rendimiento. Sus dos checks offline
también aprobaron. Los CIgenerales obsoletos5f/0dd se cancelaron sin reintentos;
el estudio40137458635 no se tocó y sigue completo/rechazado/consumido.
El futuro diagnóstico mantiene performanceAccepted=null/gateReevaluated=false;
no tag/merge de ownership ni integrar StaticRange todavía. La migración general
sigue activa e incompleta. Preservados563pins y48entradas ajenas; usar sidecar
propio/journal y no sobrescribir watch-80.json compartido.

## Preparación AA de Range, captura deshabilitada — 2026-10-25

Implementados agenda y productor en
reports/benchmarks/native-class-ownership/range-control-telemetry/.
Revisión range-control-aa-telemetry-v1: 256 procesos planificados (AA-only,
Range1000/1000,16 posiciones,ambos Node/motores/labels/modos CPU-JIT). Son
cantidades declaradas, no ejecutadas. La autorización permanente cubre el
trabajo sin otra pregunta; captureImplemented=false refleja implementación
incompleta, no un permiso pendiente. No aplicar ninguna etiqueta ahora.

Procedencia contrastada: profiles/v2 tiene fuente A675 igual a la referencia
actual, pero otros ELF/worker/contexto y solo Node22; fuente B833 distinta.
Sus Git null/errores permanecen originales. Compilación4e1 es parcial/WSL y
40051899308 solo MutationRecord/100. No tratar esos perfiles como datos CPU
del run40137458635 ni descartarlos dentro de su alcance histórico.

El productor autentica563pins y los mapas nativos registrados, conserva el
wrapper/sampler instrumentados y cambia solo el binding revisión/fingerprints.
Evidencia íntegra en reports/validation/native-class-ownership/range-control-telemetry-preparation/20261025/:
ZIPec5e39bc/2711miembros, dos mapas de893archivos. Cinco contratos por Node22.12.0
y24.14.1 y seis Python reales pasan. Planes byteidénticos. Las guardas rechazan
captura antes de observadores/reportes; no se ejecutó DOM ni profiling.
Git realLinux HEAD0dd82141+ocho archivos untracked, registrado literalmente;
no presentarlo como HEAD nuevo/checkout limpio. No normalizar metadatos Git.

Siguiente: implementar colector y replay con autenticación completa, registro
independiente de mapas, guard de historial/activación única y workflows de
contratos/ejecución. Revisar/probar/publicar el método íntegro y CI del SHA
exacto antes de habilitar o consumir una única secuencia nueva. Reutilizar los
lectores/teardown revisados, conservar todos los parciales, clocks inciertos,
deltas negativos y recursos separados. No ejecutar código archivado.

El diagnóstico será siempre performanceAccepted=null/gateReevaluated=false;
no acepta rendimiento. Run40137458635 sigue completo/rechazado y consumido,
sin relanzar. No tag/merge de ownership ni integrar StaticRange todavía.
Los dos contratos CI offline de0dd aprobaron (40147135442); el CI general
40147135396 seguía vivo al observarlo. No confundirlos con checks del futuro
diagnóstico. Los563pins/48entradas ajenas permanecen intactos; goal general activo.

## Calibración desglosada con los datos existentes — 2026-10-25

Código, protocolo, las 64 filas, 1024 pares y QA en
reports/benchmarks/native-class-ownership/range-collapse-calibration/40137458635/.
Autentica tres exports del resultado 5f7765c4; reproduce exactamente las
128 medianas combinadas oficiales sin ejecutar DOM, archivados o muestras nuevas.
Siete contratos reales por OS (Python3.10/Linux y3.12/Windows) pasan y ambos
exports son byteidénticos. El workflow range-calibration-contracts.yml agrega
dos checks offline, con timeout de diez minutos; no activa ningún estudio.

AA Rust Node22 range-control/1000 mantiene -11,442393% oficial. Sus razones
por pares van de -29,342345% a +12,880155%; los segmentos dentro de procesos
varían también entre copias del baseline. Son descripciones, no regresión
del candidato ni estimador alternativo. Posición/semilla/factores están ligados:
no inferir causalidad ni seleccionar una partición para aceptar rendimiento.

No aporta justificación para repetir la secuencia consumida ni cambiar el
estimador. Antes de otra captura, inspeccionar la procedencia de los perfiles
Range históricos y determinar qué incógnita sigue sin datos CPU/GC/JIT de esta
ruta. Cualquier diagnóstico nuevo requiere método/cantidad/límites fijos y
revisión; la autorización permanente ya cubre el trabajo sin otra pregunta.
El resultado completo 40137458635 continúa rejected y los anteriores intactos.
No tag/merge de ownership, no integrar StaticRange todavía. La migración
general sigue activa. Los 563 pins y 48 entradas ajenas están preservados.

## Resultado de collapse íntegro y rechazado — 2026-10-25

Estado vigente: run 40137458635/job 121001909695/intento 1/fuente 02291d6b
terminó completo; verified=true, accepted=false con Node 22.12.0 y 24.14.1.
No timeout: captura de aproximadamente 99 min 25 s dentro de 175 min/job180.
La secuencia está consumida: no relanzar, relabelar, completar muestras ni
cambiar presupuestos. Las secciones antiguas de espera son historia.

Resultado íntegro en reports/benchmarks/native-class-ownership/range-collapse-study-results/40137458635/.
Artifact12579853745; ZIP0c6d63ba/tarf76e90ef, metadata API, logs y manifiesto
19214 miembros/16203 archivos/6 enlaces. 2048 procesos, 18432 medidas,
6144 warmup, 24576 Window y 24576 Document separados, tres rondas y
4096 estados finales claros; se preservan las 253 primeras rondas no claras.
Los cuatro exports offline son byteidénticos entre ambos Node. Solo se
ejecutaron lectores actuales y el código revisado del checkout Linux real
y limpio de 02291d6b; nunca scripts archivados ni DOM durante el replay.

17 controles jsdom fuera de ±2%; diez calibraciones AA y siete decisiones AB
fallan. Esos recuentos se solapan. La única desviación numérica Rust es AA
Node22 range-control-1000/1000, -11,44239282177505%, entre copias del baseline.
Cero filas AB Rust exceden +5%; eso no acepta la decisión global. Publicar
todas las filas y rechazos históricos, sin una atribución causal única.

Recursos en reports/memory/range-collapse-study-40137458635.*: 18 grupos,
baseline nativo Rust22→22 y tres snapshots del padre. No son memoria pico ni
una garantía universal de ausencia de fugas. Lectores: Linux6+8 contratos;
Windows5+7 y un skip por suite por privilegio de enlaces, cubiertos en Linux.
La primera invocación recibió un path incorrecto y se documenta sin log separado;
las ejecuciones finales preservan sus logs completos y pasan.

No tag/merge de ownership: rendimiento no aceptado; no se reevalúa el gate
histórico. El inventario Range ya está integrado (6 módulos/32 APIs auditados,
ninguna nueva aprobación Rust completa); StaticRange es un prototipo aislado,
funcionalmente calificado en Linux, pendiente de integrar y medir. Continuar
la migración y analizar los datos existentes antes de justificar un método o
candidato nuevo. La autorización permanente sigue vigente sin otra pregunta.
No sobrescribir watch-80.json compartido; conservar sus autorizaciones y WIP,
usar el journal privado y el sidecar propio. Los 563 pins y 48 entradas ajenas
permanecen intactos. La migración general sigue activa e incompleta.

## StaticRange en Rust, candidato aislado calificado — 2026-10-25

Patch y fuentes en reports/implementation/static-range-candidate/.
Base 4ea7de1a, patch 4f3a2d80 (aplicar con --unidiff-zero solo tras verificar
sourceBefore), ELF Linux b9ad0d91. El roundtrip reproduce nueve fuentes exactas.
Rust decide tipos, cortocircuito, errores y estado numérico; JS conserva WebIDL,
factories del realm y aristas GC. Dos callbacks síncronos resuelven handles.
No afirmar mejora temporal: no se midió rendimiento de este candidato.

Evidencia en reports/validation/static-range-candidate/20261024/:
313 tests Rust/fmt/Clippy; por Node 22.12.0/24.14.1, 3775 contratos y 9 del launcher,
22 Jest, 33 Vitest y 34 VM, 69 Range existentes y seis públicos finales. Los 74 casos
dirigidos anteriores se solapan y no se suman. HTML: 1784 comparados y 8 excluidos;
WPT: 240 fixtures, 83007 assertions y 1203 fallos compartidos/complete=false, StaticRange 17/17.
Se conservan fallos iniciales y las tres fixtures históricas restauradas
exactamente del mismo commit; el run final de compatibilidad pasa en ambos Node.

Memoria: reports/memory/static-range-candidate-20261024/.
Por Node seis Window/Document separados, 774 estados creados/liberados y 768
rechazos sin estados nuevos; controles retenidos y dos estados finales claros.
Snapshots finitos, sin pico ni garantía universal de ausencia de fugas.

Sigue SIN integrar y sin calificación Windows/macOS o rendimiento. No acreditar
el prototipo al catálogo de producción ni mezclar su ELF con el del estudio.
El estudio 40137458635 terminó completo/rechazado; el archivo y su análisis
íntegro están preservados en la sección vigente de resultados. No repetir la captura ni tag/merge de ownership.
La auditoría canónica de Range ya está integrada; migración general activa.

## Auditoría Range integrada y premisa corregida — 2026-10-25

El catálogo canónico contiene seis módulos y 32 APIs auditadas: 28 APIs híbridas
y cuatro pendientes. Cero aprobaciones Rust completas nuevas; denominadores
531/4331/7246 separados, alcance abierto y migrationPercent=null.

La documentación de 4ea7de1a afirmaba incorrectamente que el test de conteos
estaba congelado. Se consultó el recibo real: tests/validation/migration-inventory.spec.mjs
y los siete paths del catálogo están FUERA de los 563 pins. Se integró la
auditoría y su contrato, con siete tests y CLI DEFAULT aprobados en ambos Node
fijados. Los tres catálogos de referencia/superficie/anclas mantienen sus bytes.
No repetir esa premisa; comprobar la membresía exacta antes de aplazar trabajo.

Evidencia, historial original y corrección verificable:
reports/validation/inventory-range-integration/20261024/.
Los 563 archivos del estudio y las 48 entradas ajenas permanecen intactos.

El estudio 40137458635 terminó completo y rechazado; ya fue autenticado y
reproducido sin DOM en ambos Node. El archivo y análisis íntegros están preservados.
No relanzarlo ni cambiar presupuestos. El candidato StaticRange está aislado,
sin integrar ni medir rendimiento; no acreditarlo al catálogo de producción.
La migración general sigue activa y la autorización permanente está vigente.

## Propuesta auditada de Range, sin cambiar el método — 2026-10-24

Clasificación propuesta en reports/progress/inventory/range-audit-20261024/:
3 módulos híbridos y 31 APIs (27 híbridas/4 pendientes), cero aprobaciones Rust
completas nuevas. No duplica herencia ni cambia denominadores o porcentajes.
La premisa inicial sobre el test congelado era incorrecta: ese path NO está
en los 563 pins. Se integró la auditoría con su contrato y pruebas; ver la
sección de integración y su evidencia. Los archivos del estudio no cambiaron.

QA y archivos íntegros en reports/validation/inventory-range-audit/20261024/.
Node 22.12.0 y 24.14.1 pasan 70 contratos Range, siete del catálogo canónico
y el CLI con las auditorías propuestas. Se preservan ambos intentos: el primero
falló solo por un helper ESM faltante en el directorio temporal (69/70);
el segundo copia ese helper actual y pasa sin cambiar assertions o runtime.
Los catálogos coinciden entre intentos; entre Node solo difieren la versión
del perfil y los globals ECMAScript excluidos de surface.json. El manifiesto
del ZIP preserva los datos.

El SUT es A0 preparado y autenticado, con las 20 fuentes mapeadas de Range
iguales al árbol auditado d6c4404d. Esto NO califica el guard de ownership ni
el candidato aislado de collapse; no atribuir ese HEAD al binario completo.
No se reconstruyeron paquetes ni se ejecutaron benchmarks. Recursos y límites:
reports/memory/inventory-range-audit-20261024.md. No memoria pico ni garantía
universal de ausencia de fugas a partir de estos escenarios finitos.

La única captura de rendimiento sigue siendo run 40137458635/job 121001909695,
intento 1, fuente 02291d6b; no reiniciar, completar muestras ni cambiar método.
No tag/merge de ownership sin aceptación íntegra e integración probada.
La autorización permanente está vigente y la migración general sigue activa.

## Análisis offline preparado; resultado nuevo pendiente — 2026-10-24

Analizador actual: reports/benchmarks/native-class-ownership/range-collapse-study-results/40137458635/tools/analyze.cjs.
Tras autenticar/extraer el MISMO run 40137458635/job 121001909695/intento 1, usar el
script actual con argumento de fuente apuntando al checkout Linux real/limpio
de 02291d6b. Autentica recibo 83ef y  563 archivos ANTES de cargar código, y Node
versión/hash fijados. Ejecutar con Node 22.12.0 y 24.14.1 en destinos nuevos fuera
de captura/fuente; preservar y comparar los cuatro exports. No ejecutar código
archivado ni falsear sourceCommit/sourceChanges/sourceGitErrors.

QA: 12 contratos por Node. Referencia 40113188886/b63 preserva identidad/rechazo,
24576 filas CSV exactas, recursos y 32 comparaciones/8 controles desfavorables/
1 regresión intactos. attempt1 conserva error de expectativa del test (16 frente a 18 grupos);
el protocolo/datos no cambiaron. La fixture correcta conserva AB A0/A1 separados
(64/64 más 128 B por Node). attempt3 autentica además todas las 563 fuentes.
Evidencia: reports/validation/native-class-ownership/range-collapse-analysis-reader/40137458635/.
Recursos/límites: reports/memory/range-collapse-analysis-reader-40137458635.md.

El CLI positivo, decisión y comparación entre exports del artifact NUEVO siguen
pendientes. No repetir captura, completar muestras ni cambiar método/budgets.
Rendimiento sin aceptar, sin tag/merge; runtime híbrido y migración general activa.
La autorización permanente cubre las acciones; no volver a pedir confirmaciones.

## Extracción preparada, artifact nuevo pendiente — 2026-10-24

Lector actual: reports/benchmarks/native-class-ownership/range-collapse-study-results/40137458635/tools/extract.py.
El CLI queda cerrado mientras artifactId/zipSha256/tarSha256 sean null. Al terminar
el MISMO run 40137458635/job 121001909695/intento 1, usar collect.py --collect,
autenticar ID/run/fuente/intento/nombre/tamaño/digest y fijar los pins reales antes
de extraer a un destino nuevo. No ejecutar código del archivo; mantener limpio
el checkout Linux de 02291d6b para study.cjs --verify con ambos Node fijados.

QA de extracción: Linux 6 aprobados; Windows 5 aprobados/1 omitido tras comprobar
privilegio de enlaces ausente, caso realmente cubierto en Linux. La lectura
positiva usa SOLO la referencia histórica 40113188886, protocolo b63cf834 y su
rechazo original, sin relabel ni nueva medición. Los ZIP/tar originales siguen
idénticos. Transporte se volvió a verificar: Linux 8, Windows 7/1 omitido.
Evidencia: reports/validation/native-class-ownership/range-collapse-extraction-reader/40137458635/.
Límites de recursos: reports/memory/range-collapse-extraction-reader-40137458635.md.

La captura nueva continúa pendiente de resultados; no hay extracción/replay ni
aceptación de ese run todavía. Método de 563 pins/511 históricos/arnés de 434
archivos intactos; no repetir secuencia, completar muestras ni cambiar presupuestos.
El runtime sigue híbrido, la migración general sigue activa y no se pide otro permiso.

## Lector actual para seguir el mismo run — 2026-10-24

Usar reports/benchmarks/native-class-ownership/range-collapse-study-results/40137458635/tools/collect.py
con argumentos repositorio y colección propia, agregando --collect solo para
conservar el archivo cuando termine. Fija run 40137458635/job 121001909695/intento 1,
fuente 02291d6b. El push 9d97a2f0 publicó 145 archivos de activación/CI verificados
remotamente; no cambió el método. GitHub actualiza pull_requests[].head.sha al
avanzar el PR; esa referencia mutable NO redefine run.head_sha. El lector actual
ya prueba esa regresión con la metadata real y no depende de scripts archivados.

QA: Linux 8/8, Windows: 7 aprobados/1 omitido por privilegio de symlink, cubierto en
Linux. Preserva snapshots/partiales, salidas ajenas y GH_REPO; no activa nada,
no ejecuta DOM ni escribe el watch compartido. Evidencia y review sin hallazgos en
reports/validation/native-class-ownership/range-collapse-current-reader/40137458635/.
Recursos/límites: reports/memory/range-collapse-current-reader-40137458635.md.

Los pins del artifact siguen null hasta autenticar el archivo real. No hay
extracción/replay ni decisión de esta captura todavía. Mantener source 022 limpio
para replay actual en Node 22.12.0/24.14.1. No relanzar ni completar muestras;
no tag/merge sin aceptación íntegra e integración probada. La autorización
permanente y la migración general siguen activas, sin preguntas operativas.

## Captura única de collapse activada — 2026-10-24

SHA fuente 02291d6b; run 40137458635/job 121001909695/intento 1. Se aplicó
UNA vez ownership-range-collapse-v1 después de los ocho checks aprobados.
Evidencia operativa y CI: reports/validation/native-class-ownership/range-collapse-study-activation/02291d6b/.
Método de 563 pins, incluidos 511 históricos y arnés de 434 archivos, intactos. No repetir secuencia,
reaplicar etiqueta ni completar muestras. Captura de 175 min/job de 180 min/worker de 180000 ms,
presupuestos ±2%/±5%; conservar íntegros resultados, rechazos y parciales.

El journal exclusivo de activación y el sidecar watch-80.range-collapse-02291d6b.json
son autoritativos para esta ejecución; los campos anteriores del watch compartido
no se sobrescribieron para preservar autorizaciones y cambios concurrentes.
Activador con 7 tests/observador con 8 tests y reviews aisladas sin hallazgos. Cuatro artifacts
de contratos autenticados: 14 tests de paquetes/19 del método por Node 22.12.0/24.14.1. Checkout
Linux real limpio de 022 preparado para replay actual, sin ejecutar código archivado.

Próximo paso: observar solo este run/job. Al terminar autenticar ZIP/tar por
ID/run/head/intento/nombre/tamaño/digest; preservar logs, manifiesto completo y
todos los datos. Replay actual study.cjs --verify con los dos Node fijados.
Plan de 2048 procesos/18432 medidas/6144 warmup, 24576 Window y 24576 Document separados,
3 rondas/2 estados finales claros por proceso, baselines y 3 snapshots del padre.
No hay resultado ni aceptación todavía; sin tag/merge hasta decisión íntegra e
integración probada del gate. Autorización permanente, sin nuevas preguntas.
Runtime híbrido; migración general pendiente; 48 entradas ajenas preservadas.

## Método prospectivo de collapse revisado antes de captura — 2026-10-24

Código: reports/benchmarks/native-class-ownership/range-collapse-study/.
QA/review: reports/validation/native-class-ownership/range-collapse-study-method/.
563pins actuales incluyen511históricos y434de arnés intactos. Tar8c430f0b,
distribuciónB0d2c0835/ELF43410883, controles/dependencias calificados sin rebuild.
19contratos del método y14paquetes por Node22.12.0/24.14.1 pasan; --plan y
--preflight son byteidénticos entre versiones. Actionlint y revisión aislada
final0hallazgos. Rondas raw1..4 preservadas, incluido fallo MODULE_NOT_FOUND
cerrado mediante binding autocontenido y --inspect de flags/config sin sampler.

Nueva disposición adjacent-paired-row-v1: pares de labels por fila consecutivos,
frente a distancia ordinal8 en los1024pares del archivo histórico. No es una
mejora temporal medida ni causa demostrada. Se conservan multiset/grupos/filas,
factores/semillas, warmup, medidas y estimador originales. Una vista canónica
para el estimador reproduce exactamente las summaries históricas; los reportes
no se mutan ni se relabelan. Presupuestos±2%/±5% y rechazos históricos intactos.

Siguiente acción: observar los ocho checks del SHA exacto publicado (cuatro
específicos y validate3OS+benchmarks), verificar recibo/sourceFiles y activar
UNA vez ownership-range-collapse-v1 bajo autorización permanente. No preguntar
permiso. Todavía0aplicaciones de esa etiqueta/0capturas de esta revisión; no
usar activadores históricos ni repetir una secuencia ante rechazo/error.
Job180min/captura175min/worker180000ms. Plan2048procesos,18432medidas y6144warmup,
Window/Document separados, baselines y3snapshots del padre; conservar todo,
incluso parciales y controles rechazados. No aceptar sin decisión íntegra.
Runtime híbrido, migración pendiente, sin tag/merge de ownership todavía.

## Paquetes de collapse preparados sin recompilar — 2026-10-24

Preparador/identidades en reports/benchmarks/native-class-ownership/range-collapse-packages/.
Evidencia íntegra en reports/validation/native-class-ownership/range-collapse-package-preparation/20261024/.
B mantiene el ELF43410883 del artifact12574603695 y distribución569archivos/SHA0d2c0835.
A0/A1/J0/J1 y dependencias3531archivos/149eb8f5 conservan los bytes calificados;
package.json3c1570af y locke154f202 de B son idénticos a los originales. Sin
reinstalar ni reconstruir Rust. Se preservan b63cf834+3src/hash8a del snapshot
local y da0f4f80 del artifact hospedado como procedencias distintas.

El tar preparado8c430f0ba568e6b3b48d98f5976cddee875e4d7e70525d3d5b5e8339e0f7b5d3
conserva6981archivos/70441956bytes y6enlaces, en7880316bytes. Lectura íntegra,
extracción segura con código actual y verificación offline en ambos Node pasan.
Pasaron14contratos por Node, consumidores CJS/ESM y probes finitos corregidos:
6Window/6Document y384Range/384NativeRange por Node,12endpoints negativos y12claros.
Raw QA preserva41archivos, también la ronda initial anterior a los dos fixes.
Review final0hallazgos tras cerrar los P2 de loader symlink y probe A0; el grafo
independiente y los tipos regulares evitan cambiar el addon por resolución de Node.
Recursos/límites en reports/memory/range-collapse-package-preparation.{json,md}.

No se ejecutó un nuevo estudio ni se aceptó rendimiento. Siguiente acción:
crear/congelar el método prospectivo de collapse usando este tar exacto, los
434archivos de arnés/511pins históricos y sus nuevas dependencias transitivas,
con pruebas y revisión del SHA antes de activar una única secuencia. Mantener
presupuestos±2%/±5%, filas/semillas/warmup/estimador y rechazos históricos.
La autorización permanente cubre las fases y herramientas: no pedir permiso.
Runtime híbrido, migración pendiente; sin tag/merge de ownership todavía.

## Collapse nativo: seis combinaciones hospedadas verificadas — 2026-10-24

El run40128890776, intento1, head da0f4f80, completó6/6success en
Linux/macOS/Windows con Node22.12.0/24.14.1. La etiqueta funcional ya se
aplicó UNA vez: no reaplicarla ni relanzar este run. ZIP/API/logs y manifiestos
completos647archivos por artifact en
`reports/validation/native-class-ownership/range-collapse-hosted/40128890776/`.
Doce replays offline con los dos Node fijados son idénticos por perfil.
El CI general40128791619 del mismo head terminó success8/8, incluida la
validación nativa de memoria Linux; se conserva su API en el mismo packet.
240fixtures/83007assertions WPT,1203no aprobados compartidos, complete=false;
1784HTML/8excluidos, fallbacks preservados. Recursos y límites en
`reports/memory/range-collapse-hosted-40128890776.{json,md}`:6Window y6Document
separados por perfil,384Range/384NativeRange,12endpoints negativos y12finales
claros por perfil. Son seis capturas leídas dos veces, no doce capturas.

ELF Linux43410883b1fb21dfb3fa35dfefce2a0adc9eaa5fd4a45b684c37c39b344fbdb4
idéntico en ambos Node y distinto del local26ba8690. macOS918667ff idéntico;
Windows22e29a63db y24 53ec979d diferentes, ambos preservados. El perfil prospectivo
linux-node24 se fijó antes de medir. Siguiente trabajo: preparar un método nuevo
para este candidato, con presupuestos originales±2%/±5% y la dependencia/addon
exactos calificados; ZIP sin node_modules, no reconstruir Rust. No repetir las
secuencias consumidas. La autorización permanente cubre el método y las fases.
performanceAccepted=null/gateReevaluated=false: funcional no acepta rendimiento.
No tag/merge de ownership hasta aceptación e integración probada del gate.
El runtime sigue híbrido; la migración general continúa pendiente.

## Candidato aislado: collapse nativo calificado localmente — 2026-10-24

Código, patch, addon local y evidencia en
`reports/benchmarks/native-class-ownership/range-collapse-candidate/`.
El patch sobre b63cf834 añade RangeState::collapse, NativeRange.collapse,
su tipo público y una ruta de una llamada cuando ambos owners son idénticos.
Los nodos distintos conservan la ruta y el orden de referencias previos.
No cambia el guard ni incorpora el patch frío. El runtime principal conserva
sus511pins y sigue híbrido; la variante todavía no está integrada.

Pasaron313tests Rust, formato, Clippy y51tests dirigidos en ambos Node.
Las seis suites completas pasan en Node22.12.0/24.14.1:3780tests+9launcher,
22Jest,33Vitest,34VM,1784casos HTML con8excluidos y240fixtures WPT con
83007assertions/1203no aprobados compartidos. WPT complete=false conserva
range-deletion bloqueado y el fixture test_driver/layout excluido.
Los consumidores CJS/ESM compilaron y ejecutaron el addon real en ambos Node.

El addon Linux local es26ba869062ae4226aa058c13edc43f582cfdfd3e1c519d7a1299bccab62239d3.
El archivo raw-qa.tar.xz conserva245archivos/171574336bytes sin pérdida,
con manifiesto y lectura completa verificados. Recursos específicos y límites
en `reports/memory/range-collapse-candidate.{json,md}`:6Window/6Document por
Node,384Range/384estados por Node,24endpoints finales claros entre ambos y
24retenidos como controles negativos. Se preservan baselines y todos los datos.
No memoria pico ni ausencia universal de fugas; no hay mejora temporal medida.

El preparador y sus seis contratos reales pasan en Linux22/24 y Windows24.21;
la fuente Git de WSL debe ser Linux real mediante RUSTDOM_RANGE_PREPARATION_SOURCE.
El workflow range-collapse-candidate.yml califica seis combinaciones de OS/Node,
con60minutos por job y activación por ownership-range-collapse-functional-v1.
Después de publicar y revisar, aplicar esa etiqueta para calificar el SHA actual
y registrar run/jobs en rangeCollapseCandidate del watch80. La autorización
permanente ya cubre la activación; no volver a pedir permiso operativo.
Autenticar sus artifacts y distinguirlos del26ba local antes del siguiente
estudio prospectivo; conservar presupuestos±2%/±5% y rechazos históricos.
No tag ni merge de ownership sin aceptación de rendimiento e integración probada.

También se conservaron dos artifacts reales del CI40125948926 en
`reports/validation/ci-report-transport-hosted/40125948926/`:unos177KB por
shard frente a2GB anteriores, con diez reportes íntegros por artifact. Sus
manifiestos registran el merge sintético fe01733f, vinculado al head6e1db099
por logs y API; no normalizar sourceCommit. Esto demuestra reducción de payload,
sin atribuir mejora causal de tiempo ni aceptar rendimiento del DOM.
El CI40125948926 de6e1db099 terminó success en sus ocho jobs, incluidos
Windows/macOS. final-run.json y final-jobs.json conservan esa consulta posterior.

## CI: alias Windows 8.3 corregido — 2026-10-24

El CI40125425193 de1c3a041b falló en Windows/job120965695524 al comparar
la ruta larga de Git runneradmin con el alias RUNNER~1 conservado por
fs.realpathSync. El colector usa ahora fs.realpathSync.native en raíz,
padre de salida y archivos, preservando límites y rutas originales.
Evidencia en `reports/validation/ci-report-short-path/2026-10-24/`.

La misma suite nueva reproduce el error en el colector previo obtenido de
Git:11pass/1fail/1skip; el fix pasa12pass/0fail/1skip en Windows y ejerce
un alias8.3 real. El skip corresponde al privilegio de symlink de archivo.
Linux Node22.12.0/24.14.1 pasa12contratos y omite solo el caso Windows.
Revisión aislada sin hallazgos; comprobar CI hospedado del nuevo SHA.
Los511pins y la captura fría rechazada siguen intactos; no nueva captura,
tag ni merge. La autorización permanente y la migración general siguen activas.

## Estudio frío completo y rechazado — 2026-10-24

El run40113188886/job120928996128, intento1, del SHA b63cf834 terminó
con captura completa y exit1 por rechazo de rendimiento, sin timeout.
La evidencia íntegra está en
`reports/benchmarks/native-class-ownership/cold-cleanup-study-results/40113188886/`:
ZIP/tar originales, API, logs, manifiesto completo, muestras/warmup, replays,
lectores probados y análisis. Artifact12572122750; ZIP SHA b82e1d3d9af43d7c0d2f39924cdfa9a6fd277bbe74ffcc9ab5d7150df2499eaf.

El replay estricto y los exports coinciden en Node22.12.0/24.14.1 con
511pins y434fuentes:2048procesos,18432duraciones medidas,6144warmup,
24576Window y24576Document por separado. Ocho controles jsdom exceden±2%
y una fila Rust excede+5%: Node24 AB range-control-1000/250,+6.5743%,
con su control jsdom también rechazado,+3.5261%. No atribuir causalidad
al candidato ni aceptar ownership. Preservar los rechazos históricos.
No relanzar esta secuencia ni completar muestras; no tag ni merge.

Se conservan264primeras rondas no claras,4096estados finales claros,
baselines nativos y3snapshots del padre. Recursos y límites en
`reports/memory/cold-cleanup-study-40113188886.md` y JSON adyacente:
son observaciones finitas, no memoria pico ni ausencia universal de fugas.
Pasaron18contratos de transporte en Linux/Windows,5del artifact completo,
10del lector en cada Node y lectura positiva de la versión a publicar en
ambos Node. La revisión aislada se conserva en el paquete.

La autorización permanente de fb18f6a0 sigue vigente para el siguiente
trabajo justificado, sin pedir permiso operativo. Los hooks ya están
instalados/trusted; no restablecer el bloqueo histórico por autorización.
El CI general40121155551 de fb18f6a0 aprobó sus ocho jobs. La migración
sigue pendiente y el runtime sigue híbrido; el candidato no está integrado.

## Autorización permanente y estudio en curso — 2026-10-24

El usuario indicó: «porfavor deja de pedir autorizacion, estas autorizado
para hacer todo lo que tengas que hacer, absolutamente todo». AGENTS.md
registra la autorización permanente para el trabajo necesario de rustdom,
incluidos estudios nuevos justificados y las siguientes fases. No volver a
pedir permisos operativos. Conservar el método de las mediciones en curso,
sus presupuestos y todos los resultados, incluidos rechazos y regresiones.

Los hooks versionados en .codex/hooks/ refuerzan la autorización mediante
SessionStart, UserPromptSubmit y PreToolUse. Están instalados para los cinco
roots de este repositorio y sus worktrees, y sus tres definiciones quedaron
registradas como trusted mediante la interfaz normal hooks/list y
config/value/write. Se preservaron la política, los hooks y la confianza
previos, así como el symlink del config del usuario. La suite real aprobó
15 pruebas en Linux y 14 en Windows; Windows omite crear un symlink por falta
del privilegio, pero el enlace existente del config real se verificó intacto.
Los hooks emiten únicamente additionalContext, con entrada acotada a 1 MiB;
no almacenan los argumentos de las herramientas.

ownership-cold-cleanup-v1 está autorizado y activado UNA vez: run40113188886,
job120928996128, intento1, commitb63cf834de153c3b033d88ad961afb6329c19f5a,
PR80. El usuario corrigió «No ejecutar» con «perdon, si ejecutar» y después
ratificó la autorización. La captura comenzó a las16:48:57UTC del24/10 y
sigue en curso en la última observación, sin decisión de rendimiento.
Mantener los límites de175min de captura y180min por job; no reaplicar la
etiqueta ni relanzar esta secuencia. El CIgeneral40072309873 y los cuatro
checks del método/preparación del SHA b63cf834 aprobaron.

El seguimiento seguir-estudio-fr-o-de-rustdom consulta ese run cada10min.
Su estado y autorización están en coldCleanupStudyMethod del watch80 del
checkout principal. Hay un checkout Git Linux real y limpio del SHA b63cf834
para replay de solo lectura, autenticado en ambos Node con511pins y434fuentes;
la ubicación se registra en .cache/cold-study-replay-source-b63cf834.json.
Los lectores .cache/cold-study-result-tools/ están preparados y revisados,
con regresiones de ownership y optimización de Python. Los pins del artifact
y las pruebas positivas sobre el archivo final siguen pendientes hasta que
termine el run. La colección propia es
.cache/cold-study-collection-owned-40113188886; conservar también la colección
inicial sin marcador. Nunca ejecutar código archivado.

Esta actualización solo cambia instrucciones y el handoff. Los511pins y
el método de la captura siguen siendo los publicados en b63cf834. El runtime
continúa híbrido y el candidato sigue sin integrar. No tag ni merge antes de
una aceptación íntegra de rendimiento y su integración probada en el gate.

## Método de limpieza fría preparado, sin activar — 2026-10-24

Código y protocolo en reports/benchmarks/native-class-ownership/cold-cleanup-study/.
QA en reports/validation/native-class-ownership/cold-cleanup-study-method/:
17 contratos offline por Node 22.12.0/24.14.1 y Actionlint aprobados; review
aislada final sin hallazgos. Se preservan los fallos de setup y del lector,
sus recibos/hashes y todas las QA previas. El P2 del manifiesto canónico se
cierra con pin independiente y recálculo de las 434 entradas. Hay protección
probada contra pyc hostil, rechazos de ejecución local/intento 2 y reproducción
exacta del rechazo histórico, sin datos falsos ni muestras nuevas.
El control de publicación real pasa tres contratos adicionales por Node;
se conservan el fallo inicial del wrapper de paths y sus dos ejecuciones
corregidas. El CI general 40069648258 de la base 4aba8018 terminó en verde,
incluida memoria nativa; eso no sustituye el QA del nuevo SHA del método.

Los paquetes siguen siendo los del artifact 12549521134/B0a949. Se conserva
el diseño original: 2048 procesos, 18432 duraciones, 6144 warmup, CPU 2,
semillas 1..16, ocho filas y presupuestos ±2%/±5%. El step de captura fija
175 minutos dentro del job de 180 minutos.
Antes de pedir autorización independiente, comprobar QA del SHA publicado
en ambos Node y la preparación autenticada. No aplicar la etiqueta
ownership-cold-cleanup-v1 ni activar/repetir workflows todavía. No reutilizar
las autorizaciones históricas consumidas. No tag/merge sin aceptación.
El runtime sigue híbrido, el candidato no está integrado y la migración falta.

## Addon exacto de CI: suites completas en ambos Node — 2026-10-24

La evidencia está en
`reports/validation/native-class-ownership/cold-cleanup-hosted-compatibility/40065437939/`.
Los seis comandos completos aprobaron en Node22.12.0 y24.14.1 con el addon
exacto0a949fb3 y los568archivos de dist autenticados del artifact12549521134.
Compatibilidad, Jest, Vitest, VM, HTML y WPT conservan conteos, exclusiones y
fallos compartidos reales en summary.json/README. No hubo rebuild ni benchmark.
Los recursos finitos están en
`reports/memory/cold-cleanup-hosted-compatibility-40065437939.json`.
El lector ancla el SHA declarado al índice autenticado de CI; su regresión
rechaza metadatos coherentes alterados y un archivo vuelto a sellar.

El siguiente paso es preparar, probar, revisar y publicar un método prospectivo
independiente que fije estos paquetes antes de pedir una ejecución nueva.
Las autorizaciones previas siguen consumidas. Preservar26/46pins y434fuentes
congeladas del árbol principal, rechazos históricos y48archivos ajenos.
No tag ni merge sin aceptación de ownership. El candidato sigue aislado y
el runtime sigue híbrido; Windows/macOS del candidato y la migración faltan.

## Preparación de CI autenticada:40065437939 — 2026-10-24

El run40065437939/job120787588512,intento1,f559d37a terminó success.
Archivo íntegro autenticado: artifact12549521134; evidencia en
`reports/validation/native-class-ownership/cold-cleanup-build-preparation/40065437939/`.
ZIP21a79f0d/tar045d0035,7889miembros,7043regulares,6links. Lectura offline
idéntica en Node22/24, SHA4b807020. Pasan17tests de transporte por plataforma
y5de replay por Node, sin DOM;17incluye sustitución de bytecode cache real.

El addon de CI es0a949fb3, distinto del9bablocal. Pasaron14pruebas nativas por
Node con el0a949 real. La regresión de MutationRecord está ahora en tests/ para
ejecución habitual. Memoria canónica:30Window y30Document observados por separado,
20estados finales claros; no memoria pico ni garantía universal de ausencia de fugas.

Sigue pendiente completar Jest/Vitest/VM/corpus con el binario exacto0a949 y
preparar un método prospectivo separado antes de solicitar una secuencia nueva.
No repetir estudios consumidos ni aceptar rendimiento por este build/replay.
No tag/merge. Mantener el runtime principal y el trabajo ajeno intactos.

## Preparación fresca corregida: tag y commit — 2026-10-24

`cold-cleanup-build/` reutiliza el productor existente y fija baseline067 más
checkout8dba217b/patchd869ec4a. Localmente pasaron build, probes canónicos de15
Window y15Document por Node22/24 y ocho contratos por versión, incluidos runtime
real relocalizado, reseña de fuentes, identidades y endpoints adulterados.
Archivo íntegro y recursos en
`reports/validation/native-class-ownership/cold-cleanup-build-preparation/local-2026-10-24-attempt2/`
y `reports/memory/cold-cleanup-build-local-2026-10-24-attempt2.json`.

La preparación no es un sampler y su evidencia local no es un recibo autenticado
de CI. Seguir el workflow nuevo de preparación, autenticar su artifact y preparar
un método separado antes de solicitar una secuencia nueva. Mantener los rechazos,
autorizaciones consumidas y el runtime principal. No tag/merge ni aceptación por
un build/probe funcional. La migración completa permanece activa y pendiente.

## Preparación fresca de paquetes para ownership — 2026-10-24

`cold-cleanup-build/` reutiliza el productor existente y fija baseline067 más
checkout8dba217b/patchd869ec4a. Localmente pasaron build, probes canónicos de15
Window y15Document por Node22/24 y ocho contratos por versión, incluidos runtime
real relocalizado, fuentes con hashes adulterados, identidades y endpoints alterados.
Archivo íntegro y recursos en
`reports/validation/native-class-ownership/cold-cleanup-build-preparation/local-2026-10-24/`
y `reports/memory/cold-cleanup-build-local-2026-10-24.json`.

La preparación no es un sampler y su evidencia local no es un recibo autenticado
de CI. Seguir el workflow nuevo de preparación, autenticar su artifact y preparar
un método separado antes de solicitar una secuencia nueva. Mantener los rechazos,
autorizaciones consumidas y el runtime principal. No tag/merge ni aceptación por
un build/probe funcional. La migración completa permanece activa y pendiente.

## Candidato de ownership: suites completas en Linux — 2026-10-24

La evidencia adicional está en
`reports/validation/native-class-ownership/cold-cleanup-compatibility/`.
Los seis comandos completos pasaron en Node22.12.0 y24.14.1 con el mismo
addon9bab7909: compatibilidad, Jest, Vitest, VM, HTML y WPT. Los conteos y
exclusiones reales están en summary.json/README; no equivalen a migración completa.
Se conservan el intento con loader ausente, su interrupción, el error de conteo
del controlador Node22 y las correcciones probadas, sin repetir las suites exitosas.
Los snapshots finitos de recursos WPT están en
`reports/memory/cold-cleanup-compatibility.json`; no son GC final ni memoria pico.

El prototipo publicado antes en fb4bb26c sigue sin integrar, sin rendimiento
medido y sin validación del candidato en Windows/macOS. Las secciones de abajo
conservan el estado histórico previo a esta calificación Linux. No aceptar el
gate, tag ni merge. Preparar un protocolo independiente revisado y publicado
antes de solicitar una nueva ejecución; no reutilizar autorizaciones consumidas.

## Variante de ownership aislada, sin medir — 2026-10-24

En reports/benchmarks/native-class-ownership/cold-cleanup-candidate/ hay un patch
experimental que añade cold/inline(never) solo al Drop de PendingClassValue.
Se compiló base y variante desde f44f5dd0 en la misma ruta, con Rust 1.99.1.
ToNapiValue de MutationRecord pasa de 713 a 681 bytes; no demuestra mejora temporal.
La hipótesis antigua del wrapper adicional no se aplica al binario actual.

Pasaron 6 tests del guard por variante, 311 tests Rust del candidato, formato/Clippy y
14 tests del addon real por variante/Node 22.12.0 y24.14.1, incluyendo fallo real
de wrap de MutationRecord y preservación UTF-16. Memcheck conserva 0 pérdidas
definitivas/indirectas y 0 errores; 48 bytes posibles y 548 alcanzables en ambas,
visibles en logs, con stack de libtest/std. Alcance finito; no memoria pico.

NO se aplicó el patch al runtime principal, no se repitió ningún estudio ni se
midió rendimiento. La variante no está calificada por suites completas Jest/
Vitest o Windows/macOS. El siguiente paso es completar su calificación y un
protocolo separado antes de pedir autorización independiente para una medición.
No aceptar el gate, tag ni merge por reducción de tamaño de código.


## Diagnóstico nativo terminado y verificado — 2026-10-24

El usuario autorizó una sola secuencia de native-mutation-telemetry-v1, ya consumida:
run40051899308, job120746185254, intento1, fuente0211bba042e8f6d72dd303e8b23c53c68b32df92.
Terminó success. No relanzar, reaplicar etiqueta ni agregar procesos/muestras.
La autorización y el archivo íntegro están en `reports/benchmarks/native-class-ownership/native-mutation-telemetry-results/40051899308/`.
Las secciones prospectivas de abajo conservan estados históricos anteriores.

Ambos replays estrictos (Node22.12.0/24.14.1) son idénticos, SHA256
`91b8c7b101a3a6020e3f6fd90c6173a20cb133cf1511bce27d3400619128ff46`:512 procesos,4608 medidas,1536warmup,
6144 Window+6144 Document separados,211 primeras rondas no claras,1024 finales
requeridas claras,256 CPU profiles y256 logs JIT. ZIP/tar preservados sin pérdida
en46 partes; artifact12545165372, ZIP SHA57448f31f6256a9e696af544ed68369c8ca4ba6d740958e5572a376f2f50325d.
Se conservaron los235deltas CPU negativos y todos los datos de warmup/perfiles/logs.

Los siete exports finales coinciden entre ambos Node. Pasan14tests de transporte
por plataforma,5contratos por Node y7oráculos sobre todos los registros exportados.
Se corrigieron el OOM del lector derivado, ausencia convertida en cero y salida
dentro del corpus. Historial y validaciones están en el paquete. Recursos y límites
en reports/memory/native-mutation-telemetry-40051899308.{md,json}. Los contadores
napiClasses son referencias a constructores, no asignaciones de instancias.

**No acepta rendimiento**:performanceAccepted=null ygateReevaluated=false.
Ambos rechazos históricos siguen vigentes; no tag ni merge. El runtime sigue
híbrido y la migración completa está pendiente. No pasar a otro módulo antes de
cerrar ownership. Usar estas observaciones para investigar el costo de las rutas
muestreadas; no inferir causalidad solo por emisiones JIT o frames V8 y no repetir
capturas sin una autorización distinta. El README detalla reproducción usando
un checkout limpio real de0211bba0 y código actual, sin ejecutar scripts archivados.


## Timeout explícito del CI habitual — 2026-10-23

`.github/workflows/ci.yml` ahora limita `validate` a 60 minutos por OS,
`benchmark_shards` a 45 por shard y el agregador `benchmarks` a 5. Antes no
tenían timeout explícito. Actionlint aprobó el workflow real y se contrastaron
16 jobs exitosos de dos runs: máximos 34 min 34 s / 22 min 36 s / 5 s.
Evidencia y límites en `reports/validation/ci-timeouts/2026-10-23/`.
Los 26 pins y las 434 fuentes congeladas siguen intactos. Los límites nuevos
no cambian un run ya iniciado, el protocolo del estudio ni su rechazo.
No hubo captura nueva, cambios de runtime ni aceptación de rendimiento.

## Estudio autorizado terminado y rechazado — 2026-10-23

La autorización humana posterior al método publicado permitió exactamente una
ejecución de `ownership-shared-fixtures-v1`. Terminó el run `40012710923`, job
`120616868608`, intento 1, commit `14c2cc236ebcf68abc7c9d06f4b5b88e35e57ab4`.
No relanzar el workflow, reaplicar la etiqueta ni repetir mediciones. La sección
prospectiva de abajo conserva la situación histórica anterior a esa autorización.

Resultado completo: 2048 procesos, 18432 duraciones medidas y 6144 warmup;
integridad verificada, `accepted=false`. Ambos replays offline en Node 22.12.0
y 24.14.1 son byte-idénticos, SHA256
`a2bf8c0238ec36213dbc7e4370fb5da3b589bd461c5f985b39e9a889d23d544a`.
Once controles jsdom exceden ±2% (nueve en Node 22, dos en Node 24). Node 22 AB
`mutation-records-collect/100` registra +10.3053% del candidato frente a +5%;
su control jsdom también excede el presupuesto, por lo que no demuestra una
regresión causal de Rust. Se conservan todas las filas y los rechazos históricos.

Artifact `12536755023`: ZIP 24890432 bytes, SHA256
`da8bc23906f2961e8e0c75ca5d5c823fd6f51b51e24cb184d4e2b4c53d620a9e`;
tar 24942664 bytes, SHA256
`09a49f6d126028c2ab870fc9cd5d7c748da22f3beb827705367852c45ff51e38`.
Archivo íntegro, metadata, logs, manifiesto de todos los miembros, lectores,
CSV y análisis en
`reports/benchmarks/native-class-ownership/shared-fixture-study-results/40012710923/`.
No ejecutar scripts archivados. El replay exige un checkout Git real y limpio
del commit fuente 14c2cc23; no falsear `sourceCommit/sourceChanges/sourceGitErrors`.
El README incluye comandos de reproducción offline. Los 26 pins del método y
el grafo congelado de 434 archivos permanecen sin cambios.

Recursos: 24576 Window y 24576 Document separados, 228 primeras rondas no claras
preservadas, 4096 estados finales requeridos claros y baseline nativo 22.
Snapshots del padre y límites en
`reports/memory/shared-fixture-study-40012710923.{md,json}`. No son memoria pico
ni garantía universal de ausencia de fugas. El runtime sigue híbrido.

El timeout global de 180 minutos no se agotó: la medición duró 2 h 48 min 9 s
y el job 2 h 51 min 39 s. Exit 1 fue rechazo numérico, no un test colgado.

El análisis descriptivo posterior en
`reports/benchmarks/native-class-ownership/shared-fixture-study-diagnostics/`
reutiliza el lector estadístico existente sobre todas las muestras publicadas:
64 combinaciones y 128 tratamientos. Node 22/24 producen bytes idénticos,
SHA256 `76167f6d72197415610a1e3f1cd34c2eaf49a0babfcf53ff2218ccd9c02ab51a`.
La fila Rust con exceso presenta oscilaciones también en AA. En AB hay doce
diferencias positivas y cuatro negativas al comparar descriptivamente medianas
de proceso por seed, desde -21.1927% hasta +44.9204%. Son descripciones, no un
estimador nuevo ni una recalibración del gate. Sin eventos GC/JIT del candidato,
estos tiempos no identifican una causa ni justifican tocar el runtime a ciegas.
Se conservan todos los procesos y warmup; no hubo nueva ejecución DOM ni captura.

El método específico `native-mutation-telemetry-v1` está en
`reports/benchmarks/native-class-ownership/native-mutation-telemetry/`, con wrapper,
colector, replay y workflows. `captureImplemented=true` significa capacidad del
código, no autorización. No se creó/aplicó su etiqueta ni se ejecutó el diagnóstico.
Selecciona MutationRecord/100 y conserva todos los seeds, AA/AB, motores y labels,
CPU/JIT por separado: 512 procesos propuestos, ninguno ejecutado. Requiere revisión
local íntegra, CI de contratos del SHA final y autorización humana independiente
antes de una única activación en PR #80. No reutilizar permisos de otros estudios.

Pasaron cuatro contratos Python y quince por Node con datos históricos reales,
derivaciones, corrupción de código/metadata y guardas de contexto. Ambos preflights
solo leen/autentican archivos; no prueban el profiler nativo end-to-end ni un replay
positivo de una captura nueva. Evidencia actual en
`reports/validation/native-class-ownership/native-telemetry-method/`; la fase anterior
sin productor de `05814530` se conserva en `native-telemetry-preparation/2026-10-23/`.
Metodología y límites de recursos en `reports/memory/native-mutation-telemetry-method.md`.
El protocolo completo fija 3 minutos por worker, presupuesto del colector 110 minutos,
step 130 y job 180; ante error/timeout preserva parciales, sin retry ni muestras extra.

No hay tag ni merge ni aceptación nueva para integrar al gate. No continuar
con otro módulo antes de cerrar este hito. Investigar los datos existentes;
cualquier estudio distinto requerirá su propio protocolo y autorización,
sin reutilizar esta autorización consumida. La migración completa sigue pendiente.

## Método prospectivo completo, sin ejecutar — 2026-10-23

`reports/benchmarks/native-class-ownership/shared-fixture-study/` implementa el
estudio separado `ownership-shared-fixtures-v1`. El protocolo fija la matriz
original completa: 1024 procesos por Node, 2048 en total, semillas1..16,
AA/AB, ocho filas, presupuestos jsdom±2%, RustAA±5% y RustAB+5%, estimador
original sin cambios. El sampler derivado debe ser byte-idéntico al ya
calificado en 80 procesos; solo cambia la identidad del wrapper externo.

Pasaron 15 contratos por Node22.12.0/24.14.1 y preflights completos de la
preparación oficial. Ambos preflights finales son idénticos. Se verifican
los dos binarios antes de iniciar workers y otra vez después de cada perfil.
Actionlint aprobó ambos workflows. Revisión independiente final del método:
cero hallazgos. Datos y todos los logs en
`reports/validation/native-class-ownership/shared-fixture-study-method/`.
Los contratos usan reportes auténticos guardados; no equivalen a ejecutar
end-to-end la secuencia nueva, que todavía no ocurrió.

El colector conserva solo copias de los valores del estimador entre workers,
en vez de retener todas las listas de módulos y trazas. Se ejerció con 80
reportes reales sin nuevo DOM: JSON completos45339618bytes, vistas39791bytes,
720duraciones preservadas. Son tamaños serializados, no heap/RSS/peak ni una
medición de mejora de memoria. Informe en `reports/memory/shared-fixture-study-method.*`.

El workflow de contratos corre en PRs. El de captura solo responde a la
etiqueta nueva, exige QA del mismo SHA, revisión publicada y un único run
no omitido en el historial completo. No se creó ni aplicó esa etiqueta.
No iniciar una captura antes de autorización humana explícita para este
estudio nuevo: el pedido anterior fue analizar sin repetir la captura y la
autorización posterior alcanzó solo al diagnóstico CPU/GC/JIT ya terminado.
Primero publicar/autenticar el método y verificar su CI sobre el SHA final;
después pedir esa autorización con el protocolo concreto disponible.

Ownership histórico sigue accepted=false; el método no concede aceptación.
El runtime/harness congelados permanecen intactos. Sin tag ni merge; no avanzar
a otro módulo antes de cerrar este hito. El objetivo completo sigue activo.

## Integración funcional del worker derivado — 2026-10-23

`reports/benchmarks/native-class-ownership/shared-fixture-worker/` integra los
fixtures compartidos en una copia derivada del sampler. Solo cambia dos
factories y agrega spans después del stop clock. El runtime source5ef y el
harness congelado `97284800` permanecen intactos.

Una única calificación funcional ejecutó 80 procesos exit0: cinco paquetes
físicos por ocho filas, en Node 22.12.0 y 24.14.1, posición 0/seed1. Conservó
los 960 spans (240 warmup + 720 medidos), hashes públicos originales, flags,
afinidad, orden, warmup por realm y teardown. Cada fila de mutación/delivery
ejerció 48 fixtures con consumidores compartidos; Range registró cero.
No es aceptación de rendimiento ni demuestra estabilidad de JIT.

Archivo íntegro y recibo canónico en
`reports/validation/native-class-ownership/shared-fixture-worker/`: 784 archivos,
61981992 bytes crudos; tar.xz 874000 bytes, SHA256
`955c0b75b7aaf5f1f87ccc534ecfa9fa29856c14d3c67bd47e6a951d91f4c28d`.
Los snapshots originales del método se preservaron. Se corrigió después un
P2 del lector: exige pins externos versionados y contrasta el grafo congelado,
sin repetir el sampler ni ejecutar código archivado. Pasaron 15 contratos por
Node y ambos replays producen SHA256
`f44053b0dda5e7894495083dbb49709e164c5c107bc586266d5ecc7d4211690d`.
Revisión independiente final: cero hallazgos accionables. El workflow nuevo
`shared-fixture-worker.yml` solo extrae y verifica evidencia, sin recapturas.

Memoria: 960 Window y 960 Document por separado; se conservaron nueve primeras
rondas no claras y 160 estados finales requeridos claros. Baselines nativos
preservados, napiClasses.live=22. Informe en `reports/memory/shared-fixture-worker.*`.
Son observaciones finitas tras GC, sin memoria pico ni garantía universal.

Siguiente acción: preparar un protocolo prospectivo concreto para evaluar
esta variante del harness y revisarlo antes de cualquier estudio nuevo de
aceptación. No repetir los estudios consumidos ni cambiar presupuestos,
estimador o filas/semillas para obtener verde. El diagnóstico autorizado ya
terminó; esta calificación funcional no autoriza otra captura de aceptación.
Ownership histórico sigue accepted=false; candidato performanceAccepted=null.
Sin tag ni merge. No avanzar a otro módulo Rust antes de cerrar este hito.

## Candidato y CI publicados: 81b27131 / 8c464147

El candidato funcional de fixtures está publicado en `81b27131`. El workflow
`8c464147` autentica la preparación oficial y ejecuta los paquetes reales en
Ubuntu 22.04, con Node 22.12.0 y 24.14.1. La revisión cerró un P1 de propagación
de errores: Bash explícito con pipefail y un control negativo impiden que
tee oculte un fallo. Seis comprobaciones locales del comando real pasaron.

El run 39988794384 terminó success en ambos jobs, con cuatro tests funcionales
y cinco de evidencia por Node. Artifacts 12516188121 / 12517565598 y logs
completos se conservaron y autenticaron en
`reports/validation/native-class-ownership/shared-fixture-ci/39988794384/`.
Ambos lectores offline producen bytes idénticos. Los siete archivos de cada
ZIP incluyen la evidencia completa y el control negativo esperado; no volver
a ejecutar scripts archivados para leer estos datos.

CI observó 76 Window y 76 Document por separado, 59 primeras rondas no claras
y 152 estados finales requeridos claros; recursos nativos al baseline 22.
Es un conjunto separado del local, que tiene 58 primeras rondas no claras.
Memoria: `reports/memory/shared-fixture-ci-39988794384.*`. No es memoria pico,
ausencia universal de fugas ni evidencia de rendimiento aceptado.

Siguiente acción: integrar los consumidores en una copia prospectiva del
worker y calificar la integración, preservando HTML, primeras mutaciones,
campos, orden, rondas, preparación, entropía, afinidad y teardown. No modificar
ni recapturar el sampler consumido, no cambiar presupuestos o estimador.
Ownership sigue accepted=false; candidato performanceAccepted=null.
Sin tag ni merge; todas las fases restantes siguen pendientes.

## Candidato funcional: consumidores compartidos sin mutar los nodos medidos

`reports/benchmarks/native-class-ownership/shared-fixture-candidate/` agrega
fixtures de mutaciones y entrega con métodos de prototipo compartidos. Las
factories anteriores creaban métodos por fixture; eso no prueba que V8 no
reutilizara código. Los callbacks bound siguen siendo distintos aunque su
target sea común. No presentar la hipótesis como causa demostrada.

La calificación reutiliza el warmup original de tres rondas y los helpers
Range originales. Verifica las ocho cargas y los tamaños canónicos con el
HTML/Range original, primeras mutaciones intactas y hashes públicos del
jsdom independiente. Corrieron dos ciclos por carga en jsdom J0 y candidato
híbrido B de la preparación oficial, en Node 22.12.0 y 24.14.1.

Pasaron cuatro tests funcionales y cinco tests de evidencia por Node. La
calificación final observó 76 Window y 76 Document por separado: 58 primeras
rondas no claras, 152 estados finales requeridos claros, recursos nativos
al baseline (`napiClasses.live=22`). Incluye error de validación, carga no
soportada, entrega encolada cancelada, fixtures descartados y promesas
pendientes retenidos deliberadamente. Datos y todos los intentos/logs en
`reports/validation/native-class-ownership/shared-fixture-candidate/`; memoria
en `reports/memory/shared-fixture-candidate.*`. Evidencia finita, sin afirmar
memoria pico ni ausencia universal de fugas.

Esta variante todavía no está integrada al worker de rendimiento congelado.
El siguiente paso es preparar y calificar esa integración prospectiva sin
alterar el sampler consumido, sus presupuestos/estimador ni el runtime.
No hubo capturas nuevas, no se eligió otra cantidad de rondas y no se concede
aceptación por compartir métodos. Ownership sigue accepted=false; candidato
performanceAccepted=null. Sin tag ni merge. El objetivo completo sigue activo.

## Atribución offline de funciones V8 por scriptId

El CI general 39962409292 del commit `0a9e851a` terminó success en sus ocho
jobs, incluidos Linux con Valgrind, Windows, macOS y benchmarks. El turno
anterior produjo avance verificable: captura autorizada, evidencia publicada
y verificador portable; no fue una espera ni una repetición de estado.

`reports/benchmarks/native-class-ownership/jit-origin-analysis/` atribuye por
scriptId todos los 1.107.823 registros function de los 32 logs JIT originales:
384 intervalos, 96 warmups y 288 medidos. Los otros 32 procesos son CPU y no
tienen log JIT. Lectores Node 22/24 byte-idénticos; seis contratos por Node.
No se ejecutaron nuevas capturas, DOM, perfiles ni ciclos de GC.

En operaciones medidas, Node 22 tiene 196 registros jsdom/turbofan posibles
y 171 contenidos para todos los offsets del envelope observado; el arnés
tiene 21/18. En Node 24, jsdom/maglev tiene 88/79 y jsdom/turbofan 74/68;
el arnés también registra tiering. Son registros de emisión, no funciones
únicas ni CPU de compilación, y no identifican causalidad sobre los trece
controles rechazados. Se conservan acciones y fuentes desconocidas.

La revisión siguiente del calentamiento debe cubrir código de jsdom y sus
consumidores del arnés. Los datos no justifican elegir arbitrariamente más
rondas: hay actividad posterior al warmup en ambos. Mantener fronteras y
resultados públicos, memoria y todos los controles antes de plantear una
secuencia prospectiva revisada. No modificar ni relanzar el sampler consumido,
no cambiar presupuestos/estimador y no aceptar por observar eventos JIT.
Ownership sigue rejected/accepted=false; este análisis accepted=null.
Sin tag ni merge; el objetivo de migración completa sigue pendiente.

## Captura adicional terminada y verificada: 39959175058

El diagnóstico autorizado ya se ejecutó una sola vez sobre `22aeb0ba`:
run 39959175058, job 120432514538, attempt 1, success. No volver a aplicar
`ownership-jsdom-telemetry-v1` ni repetir sus 64 procesos. Las afirmaciones
anteriores de “no se lanzó” describen el momento de publicación del método.

Node 22.12.0 y 24.14.1 leyeron los 64 reportes y produjeron filas idénticas:
768 intervalos (192 warmups, 576 medidos), 52 deltas CPU negativos conservados,
768 Window y 768 Document observados, tres primeras rondas no claras y 128
endpoints finales claros; 32 Inspectors detenidos y desconectados.
Artifact 12504756416, ZIP 97613352 bytes, SHA256
ef50c0b640187ce67739c27ce8f95d139a7e2ccab9266748f9f14bbede7c6cd8.
Está completo en cuatro partes reconstruibles en
`reports/benchmarks/native-class-ownership/jsdom-telemetry-results/39959175058/`.
Se conservan todos los perfiles/logs, replays, fuentes, hardware y metodología.
Memoria: `reports/memory/jsdom-telemetry-39959175058.{json,md}`.

Hay JIT durante operaciones medidas y variación sin GC observado en algunas
cargas. Los modos CPU y JIT son procesos distintos, con incertidumbre temporal
explícita. Esto permite investigar calentamiento/tiering por carga, pero aún
no identifica la causa suficiente de los trece controles originales rechazados.
`accepted:null` para este diagnóstico; ownership conserva `accepted:false`.
No cambiar presupuestos, no recapturar el estudio consumido y no conceder tag
ni merge. El objetivo de migración completa sigue pendiente.


## Diagnóstico adicional autorizado el 23 de octubre de 2026

El usuario respondió «Autorizar el diagnóstico nuevo» a la pregunta sobre un
experimento separado de CPU/GC/JIT de jsdom en Node22/24. Ya no está pendiente
esa decisión. La autorización no acepta el estudio rechazado ni cambia sus
presupuestos. El CI general de c71ede39 terminó con sus ocho jobs aprobados,
incluido Linux con Valgrind, Windows, macOS y shards/aggregate; XML aprobó.

El método nuevo está en `reports/benchmarks/native-class-ownership/jsdom-telemetry/`.
Fija 64 procesos jsdom-only, ocho cargas, posiciones0/15, ambas etiquetas y
Node22/24. CPU+GC y JIT+GC se observan en procesos separados porque V8 desactiva
su file logger mientras Inspector tiene activo el CPU profiler. El sampler
productivo, la fuente5ef y el estudio39921160254 siguen intactos.

La herramienta completó 32 procesos de calificación y 384 intervalos, con
384 Window y 384 Document por tipo y 64 endpoints finales claros; también
conserva tres primeros endpoints no claros. Pasaron 12 contratos por Node22/24
con los datos originales y trasladados. Se preservan los dos parciales previos
y la recuperación del lector, sin repetir los cuatro children ya completados:
los 14 deltas negativos siguen firmados. El P2 de identidad quedó corregido y
Node/PID se contrastan con el proceso observado, con regresiones reales.

Los 2094 archivos de QA están en
`reports/validation/native-class-ownership/jsdom-telemetry-method/qualification.tar.xz`,
43372036 bytes / SHA256 031d4e51c517d131bd76eb86e986b3b3a2701aee4bd3a877fa449106871b6962.
Su extracción verificó todos los miembros y el replay en ambos Node. Memoria:
`reports/memory/jsdom-telemetry-method.{json,md}`. La captura completa no se lanzó
al redactar este bloque; consultar el workflow antes de actuar. Publicar y
autenticar el recibo de revisión del método antes de aplicar una sola vez
`ownership-jsdom-telemetry-v1`. No presentar QA como aceptación ni reiniciar
capturas anteriores. Engram sigue sin identidad registrada para escrituras.

## Estado actual: terminó el estudio de ownership; presupuesto rechazado

El único run `39921160254`, job `120306452464`, terminó sobre `eafe4109`.
No hay una medición activa. No volver a aplicar `ownership-current-source-v1`
ni reiniciar el estudio o sus capturas anteriores. Ambos Node completaron
1024 workers con exit0 y 9216 duraciones por perfil: 2048 / 18432 en total.
Sus dos drivers terminaron exit1 por presupuesto. La verificación completa
en Node 22.12.0 y 24.14.1 reprodujo el resultado original: `verified:true`,
`executionComplete:true`, `accepted:false`.

Trece controles jsdom exceden ±2%: siete en Node 22 y seis en Node 24.
Ningún punto Rust sale de ±5% en AA ni supera +5% en AB; eso no concede
aceptación cuando el control no calibra. Se conservaron todas las 32 filas,
muestras, semillas, orden y límites. No convertir este resultado en éxito
ni aceptar un subconjunto favorable.

El ZIP oficial `12495305796` tiene 25045959 bytes y SHA256
`97cd554d9a56c62005cd2ce303898b160fd329fe107950dce2d6c7cfb93e7d79`.
Contiene el tar original con 14058 archivos regulares / 1392246717 bytes y
seis enlaces relativos. La preparación completa sigue siendo
`b1412b0b-da1f-4147-9879-c38a821b43da`; fuente A `67523bf3`, B `5ef668c4`,
arnés `97284800`. Las 434 fuentes por Node coincidieron con el grafo revisado
publicado: 868 comprobaciones. Los datos, lectores, tablas y metodología están
en `reports/benchmarks/native-class-ownership/current-source-results/39921160254/`.

Memoria: 24576 Window y 24576 Document observados por separado, incluidos
6144 owners de warmup por tipo. Se preservan las 259 primeras rondas no claras;
los 4096 endpoints finales requeridos quedaron claros antes de salir.
`napiClasses.live=22` coincide con baseline 22 en los workers rustdom. No es
memoria pico ni ausencia universal de fugas. Ver
`reports/memory/current-ownership-39921160254.{json,md}`.

El CI general de `eafe4109`, run `39920996839`, aprobó sus ocho jobs,
incluido Linux con Valgrind, Windows, macOS y shards/aggregate. El gate XML
también aprobó. Los dos hilos de review de GitHub están resueltos. El gate
anterior rechazaba las fuentes actuales contra el estudio histórico. El nuevo
consumidor `current-ownership-evidence.cjs` verifica el ZIP actual completo,
sus miembros, preparación, fuentes/build inputs actuales y arnés; reutiliza
los lectores existentes y conserva el resultado original. En Node 22/24 pasó
ocho contratos por perfil: exit1 por presupuesto rechazado y exit2 para fuentes
o transporte inválidos y Python optimizado. No ejecuta DOM, GC ni sampler.
CI mantiene los 35 contratos históricos y ahora usa este consumidor como gate;
continúa rechazando el presupuesto de calibración, sin cambiar sus límites.
La revisión aislada terminó sin hallazgos. Logs y metodología en
`reports/validation/native-class-ownership/current-evidence-gate/`.

Esta publicación preserva el resultado completo y su revisión independiente
sin hallazgos accionables. Continuar analizando la variación usando estos logs
y muestras, sin recapturar ni transformar el rechazo en aceptación.

El diagnóstico posterior está en
`reports/benchmarks/native-class-ownership/current-source-diagnostics/39921160254/`.
Incluye las 18432 duraciones mediante 64 combinaciones Node/fase/carga/motor
en total y 128 celdas, todas
las medianas por índice y proceso y las copias físicas. En jsdom Node 22 AA,
mutation-records-collect/100 baja de 2,372 a 1,941 ms por índice en A y de
2,614 a 1,976 ms en B; el contraste agrupado sigue rechazado en +3,6199%.
Cada índice es un realm nuevo. Esto muestra variación dentro y entre procesos,
sin identificar JIT, GC o scheduler como causa. El control no carga el addon;
no atribuir su variación únicamente al guard Rust. Pasaron diez contratos por
Node 22/24 y ambos CLI descriptivos produjeron bytes idénticos, sin muestreo.
CI ejecuta ese diagnóstico y conserva el JSON antes del gate de la captura
actual. Los contratos del estudio histórico y los presupuestos se conservan.
La inspección de los 2048 reportes confirmó que no hay campos por intervalo
de CPU, JIT o GC; stderr solo contiene warnings de ESM en los 1024 procesos
Node 22. Las trazas históricas de compilación son parciales, de otro host y
otro método: no permiten atribuir causalidad al resultado actual de Azure.
El usuario autorizó después un diagnóstico separado y sin aceptación; ver el
bloque superior. El candidato consumido sigue sin autorizar una recaptura de
su estudio ni un ajuste de presupuesto.

No hay tag ni merge. El hito no está cerrado y el objetivo total de Rust sigue
pendiente, sin porcentaje global auditado defendible. Engram permanece sin
identidad runtime registrada; no inventar una sesión ni usar otra memoria.

### Registro previo al lanzamiento (histórico; no ejecutar otra secuencia)

## Candidato actual: protocolo de ownership pendiente de ejecutar

El check XML de113a1aec aprobó en GitHub (`39917369584`). Los35contratos
de ownership pasaron por Node22/24 también en CI; el gate final sigue
rechazando las fuentes actuales antes de consumir el archivo histórico.
No confundir ese rechazo de identidad con una nueva regresión funcional.

La preparación oficial39906777389/artifact12481226791 corresponde al runtime
actuala5a1379d/fuente5ef668c4, no al antiguo candidatoB0d67. Se autenticó su
ZIP completo y se verificaron fuentes, inputs de raíz, distribuciones completas,
dependencias y probes públicos de Node22/24. Sus datos están en
`reports/validation/native-class-ownership/current-source-preparation/39906777389/`.

`CURRENT-OWNERSHIP-PROTOCOL.md` declara una sola secuencia para este runtime
ya cambiado, con etiqueta exclusiva `ownership-current-source-v1` y workflow
`ownership-current-source.yml`. Reutiliza row-isolation: ocho cargas, dos fases,
16posiciones, semillas1..16, mismos warmups, nueve muestras y mediana agrupada;
jsdom±2%, RustAA±5%, RustAB+5%. Son1024procesos por Node22/24. El ensayo no se
ha lanzado al redactar esta sección: consultar el workflow antes de actuar.
No repetirlo ni repetir estudios anteriores si el resultado no calibra.

La factory existente admite una preparación explícita sin alterar su default
histórico. La revisión detectó y cerró dos P2 antes de medir: repetir la etiqueta
ya no evita el guard de historial de runs, y el hash del arnés incluye todas las
dependencias de la preparación actual. Los dos contratos nuevos pasaron por
Node22/24. También pasaron12tests públicos por Node, con40workers por perfil,
las cinco copias reales, las ocho cargas y liberación de Window/Document.
Estos tiempos de calificación no aceptan presupuesto ni seleccionan muestras.

La regresión de los archivos históricos también pasó35contratos por Node y
conservó todos los rechazos. Los505archivos de QA, fuentes revisadas y límites
están en `reports/validation/native-class-ownership/current-ownership-method/`;
el informe de memoria observa480Window/Document por Node y80endpoints claros.
También pasaron seis contratos de inputs de build por perfil y el CLI vinculó
los inputs completos del checkout con la preparación oficial, antes de medir.
Antes de lanzar: publicar y autenticar arnés/recibo. El runtime productivo y su
fuente5ef668c4 siguen sin cambios; no hay tag ni merge. El CI general113a1aec
seguía activo en la última comprobación. Consultar el estado remoto original.
La cuota de review remoto está agotada y Engram continúa sin identidad runtime.

## Cierre del PR80: XML medido y aprobado; ownership sigue pendiente

La única ejecución `xml-native-properties-v1`, run `39907233079`, terminó
`success` sobre `a5a1379d2d59827f557c44b94e7660db43619b04`. Su archivo completo
se autenticó y recalculó: 7972 archivos regulares, 85334021 bytes, 6 symlinks,
468 workers, 14976 duraciones medidas y 33408 de warmup. Los trece controles
AA pasan ±2% (máximo absoluto 1,062616%) y las trece filas AB pasan +5%
(máximo +3,387522% en `xml-serializer-getter-error/1`). No volver a ejecutar
este protocolo. Los datos, transporte original y límites están en
`reports/benchmarks/native-class-ownership/xml-native-properties-results/39907233079/`.
El híbrido tarda 4,422–5,998 veces jsdom en sus trece filas de referencia;
pasar el presupuesto no demuestra que sea más rápido que jsdom ni permite
comparar causalmente los dos candidatos B medidos en hosts separados.

El CI general de a5a1379d, run `39906777387`, aprobó sus ocho jobs. El gate
XML de ese SHA todavía fallaba por fuentes desactualizadas; se agregó un
consumidor del ZIP completo y una receta separada para la fuente medida.
Los archivos históricos y sus decisiones conservan su validez original.
Los 28 contratos de selección/transporte/CLI pasaron por Node 22.12.0 y
24.14.1; el perfil de rendimiento registrado sigue siendo únicamente Node24.

El review ampliado encontró un bypass de integridad con Python -O. Se
reprodujo sobre una copia alterada y ambos lectores ahora rechazan -O, -OO
y PYTHONOPTIMIZE antes de consumir entradas. Once tests de observaciones
pasaron en Python Linux3.10/Windows3.12; cuatro tests de la CLI completa
pasaron por Node22/24, con ocho variantes optimizadas rechazadas por perfil.
La salida numérica normal conserva las observaciones originales.

Ownership: el test de replay del CI de a5a1379d esperaba exit1 sobre datos
históricos pero ejecutaba desde la implementación actual, que correctamente
devuelve exit2 por fuentes diferentes. Ahora el replay usa la copia física
medida, y una regresión comprueba el rechazo de una implementación cambiada.
Esto no acepta el presupuesto: los siete controles históricos rechazados
siguen rechazados y el gate final sobre las fuentes actuales sigue pendiente.
Los 35 contratos de replay/transporte/CLI pasaron por Node22/24 con `TMPDIR`
separado por perfil. El CLI real sobre el checkout actual conserva exit2
por fuentes diferentes. Los resultados, intentos iniciales y límites están en
`reports/validation/native-class-ownership/recorded-workflow-current-source/`.
No crear tag ni mergear hasta resolverlo y verificar CI/review del SHA final.
No ampliar PR80 con inventario ni otras migraciones. El objetivo completo
permanece activo, sin un porcentaje auditado defendible.

El probe de memoria del run nuevo observó 15 Window y 15 Document con
endpoints finales claros. Los 442 workers rustdom terminaron con sesiones
XML live/references/cleanupErrors en cero, pero `xmlParsers.live=1` en todos.
No inferir liberación total ni fuga desde ese contador aislado. Ver
`reports/memory/native-class-ownership-xml-native-properties-39907233079.md`.
Los cambios de gate/lector/test no modifican el runtime medido ni introducen
referencias persistentes al DOM. Conservan las limitaciones del análisis finito.

Engram no tiene identidad runtime registrada y sus operaciones atribuidas al
agente siguen deshabilitadas. No inventar sesión ni usar otro sistema.

### Contexto del candidato ya publicado (anterior a la medición)

Continuar en `feature/native-class-ownership`, PR 80. Se implementó lectura
N-API directa para las tres propiedades de objetos/funciones de la ruta de
error XML. Se conserva la exportación `xmlSerializerOperation` y sus callbacks;
el binding público usa `xmlSerializerOperationWithNativeProperties`.
No hay caches/referencias persistentes nuevas. Fuente canónica:
`5ef668c47a78bb73ef5b0881fbf20e6d36c4d4cc9686198c26e722d8fc9c6806`.

QA real Linux/glibc 2.35 en Node 22.12.0 y 24.14.1: 753 tests XML por Node,
3774 de compatibilidad, 9 de procesos WPT, Jest 22, Vitest 33 y VM 34; corpus
HTML 1784 con 8 exclusiones script-on, WPT completo 240 archivos por Node,
21 contratos de preparación por Node, 311 tests Rust, formato y Clippy.
Los JSON WPT mantienen fallos compartidos y `complete:false`; no equivalen
a cumplimiento total de estándares. Ver los crudos e intentos de setup en
`reports/validation/native-class-ownership/xml-native-properties/`.

Memoria: 132 estados por Node, 114 endpoints incluyendo warmup, 57 fixtures
por engine. Window y Document separados, retención intencional y liberación;
todos los endpoints llegaron a sus baselines observados. No es una prueba
universal de ausencia de fugas ni memoria pico. Crudos en
`reports/memory/native-class-ownership-xml-native-properties/`.

El CI general de la base `e1e8188d` terminó con sus ocho jobs aprobados:
run `39902558587`. No confundirlo con el CI del candidato nuevo tras el push.
El review aislado Codex del delta de código/protocolo cerró sin hallazgos.
La cuota de review remoto sigue agotada: no enviar otro `@codex review`.

Siguiente acción: publicar/autenticar fuentes y recibo del candidato, comprobar
el build XML remoto y lanzar una sola vez `xml-native-properties-v1` con el
workflow `xml-native-properties-evidence.yml`. El método existente, las trece
filas, AA ±2%, AB +5%, muestras y estimador no cambian. Ver el PLAN versionado.
No afirmar mejora hasta leer y verificar todos sus resultados originales.

El estudio anterior `39896591561` está consumido y rechazado: AA válida,
`xml-serializer-getter-error/1` +5,6064051645%; el híbrido tardó 4,640–6,301
veces jsdom en sus trece filas. No reiniciar `xml-full-inputs-v1`, capturas V8
ni estudios anteriores, cambiar presupuestos o repinear un archivo rechazado.
Ownership sigue sin aceptación; no hay tag ni merge. El alcance del PR sigue
congelado, sin inventario ni migraciones ajenas a su cierre. El objetivo total
de migración permanece activo y no tiene un porcentaje defendible auditado.

## Windows WPT: corrección del timeout validada localmente

El falloWindows70fc preserva2808asserts correctos idénticos, pero la referencia
jsdom tardó137427.7593ms y devolvióstatus2 al superar el límite largo120s.
La política upstream timeout_multiplier ahora es3 para ambos motores:180s
harnesslargo,210s fixture y240s proceso. Comparación y corpus siguen intactos;
una regresión conserva el rechazo del informe original. No cambia benchmarks.

Pasaron nueve contratos de procesos reales por Node22.12.0/24.14.1 sobre Linux,
incluidos ambos motores, timeouts reales y procesos reapados. La referencia
WindowsNode24.21.0 pasó sus2808asserts yestado0. Reviewindependiente0hallazgos.
reports/validation/native-class-ownership/ci-windows-timeout/39894045206/
conserva crudos, QA y límites; falta CI remoto del ajuste. El ZIP original se
leyó parcialmente porrangos/CRC, sin afirmar autenticación del ZIP completo.

## XML: protocolo calificado y ejecución original remota activa

Se agregó xml-current-run.cjs y el workflow xml-current-evidence.yml para una
única secuencia con la etiqueta xml-full-inputs-v1. Reutiliza el experimento
XML existente, corpus, estimador y presupuestos sin cambios. Antes/después
compara fuentes, inputs de raíz, dist, node_modules, compilador y ejecutable
Node con la preparación completa. No convierte integridad en aceptación ni
accepted:null en false. El wrapper espera al coordinador sin timeout adicional.

Nueve contratos reales por Node22.12.0/24.14.1 pasaron usando el ZIP oficial
XML39886057332; actionlint pasó. Revisión read-only independiente cerró dos P2
y terminó sin hallazgos. El recibo y logs están en
reports/validation/native-class-ownership/xml-current-method/. Antes de medir:
publicar/autenticar recibo y fuentes, comprobar QA remota de xml-build y que
el protocolo no tenga otra ejecución no omitida. Todo ello quedó confirmado:
92dd067c autenticó15payloads y6fuentes; XMLbuild39896156334 terminósuccess.
La única ejecución remota39896591561 comenzó desde92dd, con etiqueta
xml-full-inputs-v1. En la última consulta preparaba sus inputs completos;
no asumir que seguirá activa: consultar el run original. No relanzar ni cambiar los gates
históricos sin verificar independientemente el resultado completo nuevo.

El CI general70fc run39894045206 agregó un fallo Windows: la referencia jsdom
de Range-mutations-dataChange.html devolvió harnessstatus2, exit0 de proceso,
137427.7593ms, Node24.21.0. La comparación lo conserva como fallo; no dar por
pasados todos los assertions o atribuir causa sin leer los datos. Los shards
y macOS pasaron. Linux seguía activo en la última consulta. Este fallo queda
separado de los dos gates anteriores; no repetir capturas V8 o benchmarks.

## Prioridad de cierre del PR80 y estudio original terminado

El usuario pidió explicar por qué el PR no termina. Se reconoció el exceso de
alcance y se congeló el trabajo accesorio: no agregar inventario u otras líneas
paralelas al PR80. Su cierre requiere resolver los gates de rendimiento de
ownership y la evidencia XML desactualizada, con los límites vigentes. No
eludir checks, repinear un resultado rechazado o mover el objetivo completo.

El estudio original de afinidad auxiliar terminó: sesión 19732 exit 1; ambos
Node completaron 1024 workers con exit 0 y verify-set dio exit 0/integridad true.
La aceptación global y por perfil es false. Son 13 controles jsdom fuera de ±2% y
un exceso numérico Rust en Node 24/AB/mutation-records-collect/1000, +5,62685%.
Esa fila también falla su control, +2,04545%; no permite atribución causal.
No repetir la secuencia. Ya no hay medición activa ni restricción de carga local.

Archivo completo en reports/benchmarks/native-class-ownership/background-affinity-results/2026-10-22/:
7425 archivos, 1355361715 bytes crudos. El transporte publicado study.tar.xz ocupa
6684604 bytes, SHA 0cb8a43985aa92e5dfff64420a36c6be1453f2a300e94aa3f31d0fef520e7d25.
La captura gzip inicial de 265296558 bytes y sus ocho fragmentos se conservan
localmente; ambas compresiones contienen exactamente el mismo tar. Sus recibos
originales se preservan. Todos los miembros se verificaron por readback; el CLI
verificador pasó sin ejecutar experimentos. Conserva las 32 celdas, no solo rechazos.
Los 24576 Window y 24576 Document observados llegaron a endpoints finales claros;
incluyen 6144 owners de warmup por tipo. Son pruebas finitas, no ausencia universal
de fugas o memoria pico. El arnés ya carga un solo paquete por proceso: las
otras entradas de loadedBefore/After están vacías; no corregir un defecto inexistente.

## Calificación de inventario completada en GitHub

El workflow nuevo inventory-qualification.yml validará las propuestas estáticas
de DOMTokenList y DOMStringMap sobre el runtime real del PR80, en Node22.12.0 y
24.14.1. Herramientas/tests vienen del snapshot inmutable a89ce898; el runtime
se compila desde el HEAD del PR, pues la rama de inventario todavía difiere en
seis archivos N-API. Tras comprobar once fuentes auditadas, el snapshot usa el
dist y node_modules reales del PR mediante symlinks. No se mezclan fuentes
productivas ni se compila el runtime antiguo de inventario.

Los jobs ejecutan filtros Rust, catálogo y suites DOM públicas/nativas reales,
CLI y helpers finitos de memoria. Regeneran catálogo en carpeta aparte y copian
solo reportes nuevos. Se conservan versiones, commits, hashes y fallos parciales.
Ver reports/validation/inventory-qualification/PROTOCOL.md. El run39888943268
pasó sobre e17c3937 en ambos Node: 279 tests Node y filtros Rust de cuatro tokens
y tres dataset por versión, sin fallos o skips. Pasaron 24 ciclos de memoria
entre listas/mapas y ambos Node, más dos endpoints de snapshots nativos. Los
ZIP completos, logs, contexto y ocho reportes nuevos crudos se conservan en
reports/validation/inventory-qualification/39888943268/. Cuatro catálogos son
idénticos entre perfiles; las cuatro exclusiones ECMAScript adicionales de
Node24 se validaron contra el contrato y un realm real, conservando ambas
superficies. Los tests diferenciales son subconjuntos, no casos extra.

El ledger conserva sus 105 auditorías; integrar las propuestas TokenList31 y
StringMap12 requiere actualizarlo y validar su nueva salida, sin acreditar
Rust nuevo. La calificación está fuera de las 422 fuentes del estudio original
y no ejecuta benchmarks o carga local. No crear otro PR ni tag/merge por esto.

## Preparación XML: validación remota completada

Se agregó `Prepare XML packages`, con baseline checkpoint-066-reference-catalog,
captura completa de inputs y cinco paquetes físicos. Reutiliza el productor real
mediante una factory que conserva la política checkpoint067 por defecto. El
workflow construye y ejecuta probes de liberación, cuatro suites XML y doce
contratos de integridad/CLI en Node 22.12.0 y 24.14.1. Conserva logs parciales,
paquetes con symlinks y reportes estructurados de compatibilidad.

La revisión estática independiente cerró dos P2 de filtros y conservación de
reportes, sin hallazgos restantes. `actionlint` y `git diff --check` pasan. Las
422 fuentes del estudio activo conservan exactamente sus hashes publicados;
ninguno de los doce archivos de implementación nuevos o modificados pertenece
a ese grafo. El commit 385072cce0f292458ecbb03fc9efb6b0a2d719fa pasó XML
run39886057332 y ownership run39886057190. Cada Node pasó 455 tests XML y doce
contratos nuevos, además de catorce contratos actuales y diecisiete históricos
de ownership. Se usaron paquetes reales y CLI trasladado, sin suites locales.
La evidencia cruda vive en reports/validation/native-class-ownership/xml-build-ci/39886057332/.
Conserva ZIP XML completo, metadata, logs, probes y cuatro reportes nuevos
seleccionados por el intervalo del paso; los históricos incluidos en el ZIP no
se cuentan como nuevos. Son 60 Window y 60 Document observados en cuatro
perfiles, todos liberados bajo el contrato finito. No prueba todos los ciclos
XML ni ausencia universal de fugas. No confundir esta preparación con aceptación
de rendimiento: los gates rechazados siguen vigentes, sin checkpoint ni merge.

Estado observado del estudio original: Node 22 terminó sus 1024 workers con
exit 0, pero su decisión completa fue exit 1. El mismo coordinador ya ejecuta
Node 24 (PID 24226); el estudio conjunto sigue incompleto y su aceptación es
null. No reiniciarlo ni sustituir su SUT. Analizar el resultado completo cuando
ambos Node y verify-set finalicen, conservando también cualquier rechazo.

## Correspondencia de compilación y arnés verificada

Se recalcularon desde bytes reales los alcances canónicos de la preparación
antigua333archivos/0d67 y del arnés medido336archivos/0b485. Solo difieren tres
helpers nuevos de benchmarks y benchmarks/worker.cjs. Dentro del alcance capturado,
src, scripts, third-party/napi, locks y Cargo.toml coinciden. La diferencia de
package.json es adicional, fuera del hash canónico: solo scripts.test:compat.

Los índices oficiales antiguo39720077911 y fresco39872143199 describen los mismos
569archivos por A0/A1/B y531por J0/J1, salvo B/package.json. Las dependencias
descritas también coinciden. La comparación de distribuciones frescas sigue
siendo de metadata; no se releyó su árbol físico completo. No cambia elegibilidad
XML, SUT del estudio ni aceptación de rendimiento. Ver
reports/validation/native-class-ownership/build-correspondence/2026-10-22/.
Conserva ambos índices, hashes canónicos por archivo, manifiestos reales,
publicación del arnés y productor. Revisión estática sin hallazgos; ninguna
ejecución nueva de producto, suite, compilación, GC o medición.

Después del estudio original, verificar físicamente el build fresco antes de
usarlo o afirmar igualdad de sus árboles. Esta evidencia explica los dos hashes
de alcance; no autoriza repinear datos rechazados ni sustituir paquetes medidos.

## Inventario: auditoría estática publicada durante la espera

La rama separada feature/inventory-node-helpers publicó5f7759030a08756dba1dc3e894850d95ca5d5364:
propuesta DOMTokenList de31filas y corrección del README a18/32/55auditadas.
Se autenticaron13payloads GitHub y los seis blobs del catálogo/ledger siguen
idénticos a11f9597. El inventario conserva12151IDs y scopeClosed=false;
no se ejecutaron suites, addon, generador, GC ni benchmarks en esa auditoría.
Siete anclas propuestas ya eran Rust; no hay implementación nueva ni filas
incorporadas al ledger. Revisión estática sin hallazgos; ver su HANDOFF y
reports/validation/inventory-dom-token-list-audit/ para fuentes y límites.
Validar comportamiento y catálogo en Node22/24 después del estudio activo,
antes de incorporar; no abrir otro PR ni migrar runtime hasta cerrar ownership.

## Inicio histórico del estudio de afinidad auxiliar original

5e6ac005036922bd9965849c84b3876bfa92a8fd está publicado en PR80. Se autenticaron
17payloads del commit y422blobs de fuentes calificadas contra el árbol GitHub;
el launcher coincide con el tar de QA revisado. Recibo operativo en
.cache/background-affinity-publication.json, transporte SHA54c1e92548c93ab123bbd061d49bf1ba8d282eacac77d8a07bca72ec5f87372c,
launcherSHA12681be6c6d009a64ad5b873e956a5843b43a9706badd5877b2ae03f2fa6b32e.

Se lanzó UNA secuencia nueva después de esa publicación, ahora terminada y
rechazada como consta al inicio de este documento. Session19732,
driverPID692, raíz persistente /home/guido/rustdom-validation/background-affinity-study-k98_55yo,
Node22 padrePID955. El preflight confirmó ambos ejecutables exactos antes del
primer worker y guardó hashes. Al observar, había12entradas de1024 en Node22,
la última aún activa; no hay decisión de aceptación parcial. Node24 se ejecutará
después por el mismo coordinador. Revalidar handle19732,/proc y execution.json
para obtener el estado actual. Una ausencia de salida no autoriza reiniciar.

Marcador consumido: .cache/background-affinity-study.started.json. Nunca repetir
este estudio por timeout, cambio de máquina o pérdida del handle de observación.
Los datos viven en/home persistente; no usar/tmp para el corpus. No editar las
fuentes medidas ni ejecutar trabajo intensivo mientras el proceso esté activo.
Esperar ambos Node y verify-set íntegro, luego preservar todos los datos,
analizar/publicar aceptación o rechazo y revisar CI sobre el SHA final. Los
estudios anteriores permanecen rechazados; no hay tag ni merge todavía.
Esta nota operativa es WIP propio posterior al commit5e6ac005.

## Contraste prospectivo de afinidad auxiliar calificado

La evidencia remota de ownership quedó publicada en417dd2a04b2e569bcc39687e28829207310ab960:
12blobsGitHub autenticados y seis fuentes funcionales idénticas a f7eaa047.
No repetir CI ni generar nuevos commits de evidencia por cada ejecución que
solo cambia metadatos. El rechazo presupuestario original sigue vigente.

Hito posterior: siete archivos background-affinity bajo
reports/benchmarks/native-class-ownership/ (constants, helper, worker, experiment,
spec y BACKGROUND-AFFINITY-PROTOCOL.md). No cambian las415fuentes previas. El método
conserva el estudio completo y mueve los hilos auxiliares existentes a0-1,3-15
antes del sampler principalCPU2. No demuestra causalidad ni aislamiento físico.
Usa el mismo build oficial antiguo, restaurado y verificado físicamente, no el501f.

Calificación final ORIGINAL completa: session68460 terminó0, coordinadorPID960,
.cache/background-affinity-qualification-sg5ldgtp/ y marcador consumido
.cache/background-affinity-linux-fifo-qualification.started.json. Ambos Node
aprobaron13/13 sin skips y40workers reales por versión. Las422fuentes quedaron
idénticas, SHA46b2e7cc0db55660f9c82a37866c43a7af32cb627de2bd339ebdc055f39edbff;
las415fuentes previas tampoco cambiaron. No reiniciar esta calificación.

La revisión corrigió una carrera que podía sobrescribir un archivo ajeno. Una
segunda revisión reforzó el sentinel negativo a JSON válido, para distinguir
la implementación anterior. El primer intento funcional se detuvo solo en sus
PIDs propios verificados y se conserva íntegro en
.cache/background-affinity-qualification-fcgcc3q5/, con interruption.json;
session79561 terminó1 y no cuenta como calificación aprobada. El segundo intento,
session39071, terminó1 con12/13: sus40workers Node22 pasaron, pero /mnt/c no admite
FIFO. Se corrigió el test para usar un FIFO temporal Linux y limpiarlo, sin mocks
ni omisiones. Todo ese intento permanece en.cache/background-affinity-qualification-9epqf_1k/.
Ningún intento funcional se presenta como aceptación de rendimiento.

Paquete QA completo en reports/validation/native-class-ownership/background-affinity/:
1885miembros regulares,19100717B, SHA9276029a57b768156a2b1675f3c1ae0456bf2549af895be3ffba1ac834926cd7.
Todos los miembros se releyeron; conserva los tres intentos, procesos, fuentes,
muestras y coordinadores. Memoria en reports/memory/native-class-ownership-background-affinity-qualification-2026-10-22.*:
960Window y960Document observados, incluidos240owners de warmup por tipo; los
últimos dos endpoints de tres fueron claros antes de salir. No demuestra fuga
universal, memoria pico ni pendiente de crecimiento en un proceso.

El empaquetador ya terminó. .cache/authenticate-background-publication.py y
.cache/run-background-affinity-study.py exigen revisión final, commit/push y
autenticación antes de una única secuencia nueva en almacenamiento Linux persistente.
El launcher verifica ambos ejecutables exactos y sus hashes antes del primer
worker. Su marcador será.cache/background-affinity-study.started.json: si existe,
inspeccionar ese proceso y nunca repetirlo. Consultar el estado real de Git/marker
para distinguir publicación de medición; al redactar este hito aún no se lanzó.
Conservar todos los negativos y no cambiar umbrales. Sin tag, merge ni crédito
de migración mientras el hito siga rechazado. El CI general f7 terminó success
en sus ocho jobs (run39876191361); ownership y XML siguen pendientes por separado.

## Publicación y verificación remota de la integración ownership

f7eaa04748a37bef765f76c050f623afe6365ab6 está publicado en PR80 y autenticado:
24blobsGitHub,6fuentes calificadas idénticas; workingtree limpio en ese hito.
Run39876191401 completó ambos jobs. Los pasos de contratos pasaron en ambos
Node y los gates reales terminaron exit1, verified=true, accepted=false.
Los outputs coinciden exactamente con los32resúmenes del estudio original;
ya no falla ownership por inputs obsoletos2. Los siete controles siguen rechazados.

ZIPs CI12468801985(Node22) y12468288930(Node24) autenticados con los digestsGitHub:
f6d9d2fdf1f0a5655d5f46c8a18086b90ea65e6be064762ef2098b337c8d8013 y
2f8346c196ba3e78316f4075a9ed3ce75e0f43d309e5df3fe9e9c2913d53e157.
Copias completas, metadata/run.log y recibos en
reports/validation/native-class-ownership/recorded-workflow-ci/39876191401/
(publicados en417dd2a0). No repetir las pruebas ni
el estudio para capturar esta confirmación; no mapear el rechazo a un check verde.
CI general f7:39876191361, XML39876191349, preparación39876191352 en seguimiento.
El general previo501f39872143130 terminó success en sus8jobs.

XML aún fija su evidencia antigua incompatible. Dos estudios ya guardados,
39839886242 positivo y39844860696 posterior con AA rechazado, usan fuente0b485,
baseline993a1e y el mismo candidateBinary221e6754e8e6ef461007f5d6834cb586ebbf0f0a6d8556651ab93b64e6b9c0f5.
Ese hash aparece también en el índice del artefacto oficial actual501f para
dist/rustdom.node; por ahora solo se cotejó metadata, no todo el árbol físico.
Sus sourceCommit son3905893d92d00364591257946f25e1b94364b1a0 y
782b73d02340e898a17a4f2b42685651107e213c. Conservar ambos, no elegir solo el aprobado.
Archivos fuente en.cache/xml-ci-dd75-artifacts/ y.cache/xml-ci-a099-failure/,
también preservados dentro del tar seeded publicado. Falta recalcular ambos
estudios con su verificador offline y resolver elegibilidad sin inventar
contexto de build ausente ni disparar mediciones automáticas.

## Integración de CI validada localmente, posterior al commit publicado501f1845

501f184577b62ea0f3d78cba24c91a3cb6afae09 está publicado y autenticado:
38blobsGitHub,9fuentes calificadas idénticas y workingtree limpio en ese hito.
Los gates antiguos de ese SHA fallaron de nuevo por evidencia obsoleta;
CI general39872143130 sigue en seguimiento y el build39872143199 terminó success.

WIP propio posterior: workflow ownership actualizado para Node22.12.0 y24.14.1,
constants/row-isolation-evidence.json, constants/recorded-fixtures.json,
row-isolation-evidence.cjs, prepare-recorded-fixtures.py y recorded-workflow.spec.cjs.
Todo bajo reports/benchmarks/native-class-ownership/ salvo el workflow existente.
No cambia las415fuentes, muestras, estimador ni presupuestos. Reconstruye el
archivo íntegro y conserva exit1 de presupuesto frente a exit2 de integridad.
El workflow exige accepted=true y por ahora debe fallar con los siete controles;
esto corrige el enlace de evidencia actual, no acepta rendimiento.

La revisión detectó rutas relativas de fixtures heredadas por hijos con cwd
distinto: corregidas usando github.workspace en ambas variables. El nuevo
contrato exige rutas absolutas. Calificación incompleta anterior session60522
fue detenida solo en su grupo propio verificado688/1147/1149; no había sampler.
Se conserva.cache/recorded-workflow-qualification-a3hvwgpg/interruption.json
y todos sus logs/snapshots. Los43contratos históricos ya habían terminado
pass43y se reutilizan; las fuentes históricas y415siguen intactas.

Calificación ORIGINAL corregida: session28167, PID1173,
.cache/recorded-workflow-qualification-iykkfojr, marcador consumido
.cache/recorded-workflow-path-fix-qualification.started.json.
Session28167 terminó exit0. Actionlint y baseline Git pasaron; ambos Node
aprobaron34/34sin omisiones y sus CLI reales terminaron exit1 con verified=true,
accepted=false y los siete controles originales. Los datos y logs están en
Windows y resisten la parada de WSL; no hubo benchmarks ni capturas nuevas.
Las seis fuentes nuevas y las415anteriores siguen iguales a sus snapshots.
No reiniciar la calificación ni convertir su rechazo presupuestario en éxito.

Paquete QA en reports/validation/native-class-ownership/recorded-ownership-workflow/:
260archivos, tar2235025B, SHAdef517c2902ba40e84f819d367ccf42598669d65abfff7675059b29e28ca6973,
con readback completo, todos los outputs de tests/gates, fuentes y antecedentes.
Solo omite copias grandes de inputs que ya están publicados íntegramente en
las8partes y el tar seeded; sus declaraciones, hashes y receta de reconstrucción
se conservan. Revisión estática del fix y revisión final del paquete quedaron
sin hallazgos; ambos paquetes conservan review.json, sin aprobación remota
GitHub. Consultar Git y CI para identificar y validar el SHA de publicación.
La aprobación del replay no acepta el presupuesto del estudio rechazado.

El artefacto oficial actual12466637940 del run39872143199 está autenticado por
digestGitHub y preservado en
reports/validation/native-class-ownership/hosted-build-ci/39872143199/ (WIP propio).
ZIP14962495B SHA24a902eff4586839304b03ba8362d84eb390c5d3107a58e71e50e840fe4e3ad8;
tarSHA1858a8898c6b0538f4b12d771239dcaadb71a353a5a8b5d5b9bcfe249a2e6b1b.
Preparación c70ffb83-606d-47df-bd85-2a692e3fdbaa, inputs estables, fuente B compilada
0b4855490382ab18b7e96851dbdef95e7596268690ae169850daf097498687e9,
fingerprint B0d723e9ec7987f65ab873450c4340a8f2d6211b21f5eebd9233817dd70f35f5f.
No sustituirlo en estudios antiguos. Probes15Window/Doc por Node pasan y se
documentan por separado en reports/memory/native-class-ownership-hosted-build-39872143199.*.
La recolección no ejecutó localmente paquetes ni recompuso sus árboles físicos;
hacerlo antes de usarlos en una hipótesis futura. XML sigue sin modificar.

## Hito publicado501f1845: estudio rechazado y calificación offline aprobada

La secuencia original session56332 terminó con exit0 de verificación. Ambos
padres terminaron exit1 por presupuesto, con1024workers completos exit0 por Node
y9216duraciones por Node. Resultado conjunto verified=true, accepted=false.
Hay siete controles jsdom fuera de±2%: cuatro en22 y tres en24; ninguna fila Rust
excede su límite numérico. Eso no acepta ownership ni habilita tag/merge.

Node24 rechazó AA mutation-records-collect/1000−2.2221592592%; AB
mutation-records-collect/100+4.4938907504%; AB
observer-delivery-records/100+2.4843249360%. Sus cambios Rust respectivos fueron
+1.1419376500%,−1.5191454170% y+3.3886532027%. La tabla Node22 aparece abajo,
con las32filas completas en el nuevo summary.json.

Evidencia completa en reports/benchmarks/native-class-ownership/row-isolation-results/2026-10-22/.
El tar conserva todos los bytes originales y su copia produce el mismo resultado:
264854969B, SHAa0643d2c1ff7431f0aea1200e66b2a8bd51a9b4059a51e382b2daf277d0e981c.
Se dividió byte a byte en8partes de hasta32MiB, con archive-parts.json, hashes
individuales y global, sin cambiar ninguna muestra. El tar completo se conserva
en.cache/row-isolation-study-full-a0643d2c.tar.gz: publicar las partes y
materializarlo al consumirlo, sin stagear un archivo que excede el límite GitHub.
receipt.json, raw-files.json, build-inputs.json y compiled-package.json conservan
las identidades; summary.json y reports/memory/native-class-ownership-row-isolation-2026-10-22.json
ya se derivaron de la copia verificada.

Después del cierre, WSL apareció Stopped y su/tmp vacío. El archivo completo,
partes y reportes sobrevivieron en Windows. Se perdieron los recibos temporales
de la primera calificación21aunque el coordinador session93708 terminó exit0;
no usarlos como prueba final. No repetir ningún benchmark ni captura.

La recuperación offline materializó y verificó el tar y restauró ambos datasets
en/home/guido/rustdom-validation/recorded-evidence-8g_5cu_3. Un intento falló antes
de los tests por el ref mal escrito checkpoint067: corregido a
checkpoint-067-xml-serializer-controller, confirmado en Git y workflow. El
intento permanece en.cache/recorded-evidence-durable-35uo1ozx y marcador inicial.
La continuación --resume reutilizó esos datos, comprobó hashes y baseline vacío
y preservó logs nuevos: session67722 terminó exit0; output
.cache/recorded-evidence-durable-tfz3dsem y marcador
.cache/recorded-evidence-durable-resume.started.json. Los28contratos reales
pasaron en Node22.12.0 y24.14.1 sin omisiones, mocks ni mediciones DOM nuevas.
Logs/PIDs, fixtures y fuentes se escribieron directamente en Windows.

La evidencia QA está en reports/validation/native-class-ownership/recorded-evidence/:
229archivos, tar1487833B, SHA1101b31782bddb3d39fbd89ad2552654e4a8bf282ca82e79afc561b8e4317872,
readback de todos los miembros y9fuentes calificadas. Las415fuentes congeladas
del estudio siguen intactas. Se conservan guards vivos originales, intentos
fallidos y sus límites; los recibos perdidos no se cuentan como evidencia final.

El diagnóstico enlazado autentica2051archivos y conserva128celdas completas.
La revisión detectó y se corrigió la falta inicial de contraste con los hashes
de raw-files.json. El resultado previo se conserva como histórico no autoritativo.
Dos pruebas reales alteraron un informe y un índice en copias propias: ambos
CLI rechazaron los cambios y conservaron el resultado positivo. Productor,
recibos y logs están en el QA; no hubo otra captura ni muestreo de rendimiento.

El transporte probado es constants/recorded-archive.json,
materialize-recorded-archive.py y recorded-archive.spec.cjs, junto a los seis
archivos recorded-evidence ya preparados. Los workflows siguen sin modificarse:
CI general verde, ownership/XML rojos por evidencia obsoleta. El objetivo Rust
integral sigue abierto; esta evidencia no agrega implementación Rust. La revisión
independiente final quedó sin hallazgos, con recibos en ambos paquetes. También
se corrigió el estado obsoleto de ownership-row-isolation-proposal.md. El commit
501f1845 y sus38blobs están verificados en el remoto; no tag ni merge de ownership mientras
los controles de rendimiento no acepten el conjunto completo.

## Histórico: seguimiento antes del cierre del estudio original

Secuencia ORIGINAL session56332, root/tmp/rustdom-row-isolation-study-s_tqvw17,
driver716796 y Node24padre745171. Método publicado/autenticadoa0346b13.
Node22padre716797 terminó exit1:1024workers exit0,9216tiempos; accepted=false.
Cuatro controles jsdom rechazaron ±2%, ninguna fila Rust excedió su límite:

| Fase | Carga | Cambio jsdom (%) | Cambio Rust (%) |
| --- | --- | ---: | ---: |
| AA | range-control-1000/250 | +3.1312514131 | -0.1223331930 |
| AB | range-control-1000/1000 | +2.7107127480 | -3.1625944357 |
| AB | range-state-lifecycle-1000/1000 | -2.7474026406 | -0.9956979548 |
| AB | range-state-lifecycle-1000/250 | +2.8401337078 | -1.2534506621 |

Índice Node22SHA65d0722e8e4bcc9e73561563afe605c0887992184663c5174b0324ecc3d0eb62.
Resumen/lector offline en .cache/row-isolation-node22-terminal/. Allí se conserva
la observación de presencia de10variables de entorno en driver/Node24/unworker:
ninguna estaba presente; no se recogieron valores ni se observaron caches por API.
No hay inferencia causal ni aceptación completa a partir de esos datos.

Node24 ya arrancó en el MISMO driver y debe continuar completo. Comprobar
procesos/handle actuales: silencio no autoriza reinicio. Marcador consumido
.cache/row-isolation-study.started.json. NO repetir seeded ni captura V8, ni este
ensayo. No CPU intensiva ni cambios en415fuentes SHA7b13cad926da839fc5650dc0d7a49e9e49c1c71af7fdf9192df5359ee6da51df.
Esperar ambos Nodes, preservar todos los crudos y negativos y verificar el conjunto.
No hay aceptación de ownership, tag o merge. El objetivo integral sigue abierto.

El CI general39857277961 de a0346b13 terminó success en sus8jobs. Metadata completa
incluido snapshot terminal en .cache/ci-a034-overview/. No es aceptación del gate
ownership ni prueba del adaptador WIP. El XML bc26939855479776 pasó contratos y
rechazó evidencia incompatible sin volver a medir; rawen.cache/ci-bc269-checks.

El pedido humano más reciente es corregir CI. Se confirmaron los dos fallos de
a034: ownership39857277890/job120098649449 y XML39857277990/job120098649471.
Ambos salen2 por inputs incompatibles con su evidencia fijada; los43contratos
del job ownership pasan sin omisiones. Logs descargados con gh --log-failed,
como texto UTF8, en .cache/ci-a034-overview/gate-failures/ y copia adyacente
.cache/ci-a034-gate-errors/. No se cambiaron presupuestos, pins ni workflows.

Aclaración al usuario: no existe un resultado local aprobado de ownership que
CI rechace por error. Las suites funcionales pasan en ambos entornos; los gates
actuales salen2 por evidencia obsoleta y el Node22 local original ya rechazó
calibración jsdom. Son causas distintas y no se debe afirmar que «pasa local».

Archivador preparado en .cache/archive-row-isolation-study.py con configuración
.cache/constants/archive-row-isolation-study.json. Revisión estática0hallazgos.
Su --check-ready fue probado contra driver real vivo y rechazó exit1 sin crear
marker/output, en .cache/row-isolation-archive-guard-live/ y -live-v2/. Ambos
conservan logs, recibos y fuentes exactas por SHA; v1 se reconstruyó al mismohash
tras añadir logging de PID, con esa procedencia documentada. Guard v2 tienehelperSHA
7f4cf6ec01dca39e2287f35af7a0a447404c0ff9ba2083899c2bacb9f094f196 yconfigSHA
ea66e9a824e332963c1fbf8420cae7464ca43db4f08c1114e5551228484478a6.
La operación de archivado completo TODAVÍA NO SE EJECUTÓ. Solo hacerlo cuando
originaldriver yambospadres estén terminales y exista verificación original0.
Registra suPID yelverificador offline antes dewait; preserva copia/readback,
receta ysidecar compiled-package.json auténtico de la preparación original.
Guardar también losguardreceipts yelresumenNode22 con la evidencia QA posterior.

El plan de integración está en reports/progress/ownership-gate-integration-proposal.md.
Se mantienen compilado0d67 y arnés0b485/415fuentes, sin cambios de runtime/build
salvo test:compat en package.json. No modificar las415fuentes ni gate activo.

## Adaptador del gate preparado fuera del grafo: WIP sin ejecutar

Se preparó recorded-evidence.cjs y su decoder recorded-evidence-extract.py,
constants/recorded-evidence.json, recorded-evidence.spec.cjs,
recorded-evidence-fixtures.py y recorded-evidence-contract-cli.cjs bajo
reports/benchmarks/native-class-ownership/. Los seis archivos están FUERA415.
No se conectó el workflow ni se cambió el gate actual. No hay política final
ni fixtures de datasets porque la secuencia original todavía sigue activa.

El adaptador exige fuentes/harness actuales y su vínculo explícito con cada
índice archivado, preparación compilada original y todos los inputs adicionales.
El package.json compilado debe acompañar al archivo como sidecar; su hash se
contrasta con la declaración histórica congelada. Solo se permite el cambio
scripts.test:compat; cambios de build/exports/dependencias se rechazan aunque
la política actualice su hash. El decoder rechaza links, escapes, duplicados,
cobertura/digests inválidos y PYTHONOPTIMIZE. Limpia su temporal en finally.
La salida CLI compartida distingue presupuesto rechazado1 de integridad/inputs2.

Revisión estática: los hallazgos de enlace de arnés y Python optimizado fueron
corregidos y la revisión de esos fixes quedó sin hallazgos. Hay21contratos
funcionales preparados con dos datasets reales, CLI real y tar inválidos reales,
sin mocks. La revisión estática final, incluidos CLI y21contratos, quedó sin hallazgos. NO SE
EJECUTARON los contratos: hacerlo en ambos Node solo después de terminar el
estudio para no competir con sus mediciones. No commitear este WIP sin pruebas.

Después: archivar todos los crudos/negativos y verificar copia offline, preservar
compiled-package.json desde prepared/sources/package.json (hash histórico del
manifiesto), derivar receta final y crear fixtures fresh para seeded rechazado
y row-isolation completo. Env de tests: RUSTDOM_RECORDED_EVIDENCE_FIXTURE, JSON
con scenarios en orden seeded,rowIsolated y outputRoot vacío/nuevo por Node.
Cada escenario define kind, baselineRoot, candidateRoot, archiveRoot, policy y
expectedAccepted original. Policy requiere archive/rawManifest (filename,sha256),
archivePrefix, nodeDirectories, sourceHashes, compiledSourceHashes, harnessSha256,
buildInputHashes (10inputs por label) y compiledPackageManifest (sidecar relativo
al archiveRoot). No inventar resultados ni usar datos parciales para completarla.
El helper row-isolation y su guard están preparados como se describe arriba.
El de seeded sigue siendo histórico: nunca ejecutarlo de nuevo para otra medición.

Preparación nueva, todavía sin ejecución: .cache/qualify-recorded-evidence.py
exige primero --check-ready del archivador, el archivo completo y su readback;
solo entonces crea fixtures propias desde ambos datasets reales y snapshots
medidos409/415. Usa los10inputs adicionales, sidecar compilado autenticado,
salida propia y21contratos por Node22.12.0/24.14.1. Revisión estática sin hallazgos;
no equivale a pruebas ejecutadas. No modifica los archivos históricos.

.cache/analyze-row-isolation.py está preparado para derivar todas las32filas
y memoria por fila/proceso desde la copia completa verificada. No calcula una
tendencia entre lotes dentro del proceso: este método tiene solo un lote por
proceso. .cache/finish-row-isolation-ci-evidence.py espera al driver original
sin trabajo pesado, verifica pins de helpers, exige guard terminal y ejecuta
una sola vez archive, analyze y qualify. Preserva logs/PIDs y se detiene ante
cualquier fallo, sin reintentos automáticos ni mediciones nuevas. La revisión
estática de ambos scripts terminó sin hallazgos. Coordinador ORIGINAL activo:
session93708, PID758772, root/tmp/rustdom-row-isolation-ci-followup-zrbeis4v;
marcador consumido .cache/row-isolation-followup.started.json. No reiniciarlo.
Está esperando al driver716796; todavía no ejecutó archive/analyze/qualify.
No hay aceptación de rendimiento por preparar o iniciar estos helpers. El
estudio original sigue siendo la única medición activa. Última lectura de Node24:
600workers completos,601iniciados, faseAB, observado1792709150.7784102.

Diagnóstico adicional preparado en .cache/diagnose-row-isolation.py, revisión
estática0, sin ejecutar. Exige el mismo guard terminal y archivo verificado;
describe128celdas con16procesos/nuevemuestras, todos los procesos físicos y
máscaras de afinidad registradas en los extremos. No modifica el estimador,
presupuestos ni aceptación; no infiere causalidad, independencia o estado estable.
Ejecutarlo después del archivado sin interferir con ninguna medición activa.
Una lectura acotada del primer worker jsdom Node22 confirmó principalCPU2 y
hilos de fondo0-15 en ambos extremos: no prueba actividad de scheduler ni causa.

## Histórico: método row-isolation calificado y revisado

Doce contratos por Linux Node22.12.0/24.14.1 aprobaron sin omisiones. Se validaron
84workers DOM reales, cinco copias oficiales,112lotes y1008tiempos funcionales;
esos tiempos NO aceptan rendimiento. Window/Document suman1344observaciones por
tipo, con endpoints requeridos liberados antes de terminar cada worker.
Los índices seeded previos siguen verificados y rechazados con las factories
actualizadas; no pueden relabelarse como evidencia del método nuevo.

Fuentes:415archivos, SHA7b13cad926da839fc5650dc0d7a49e9e49c1c71af7fdf9192df5359ee6da51df.
Evidencia: reports/validation/native-class-ownership/row-isolation-method/.
El arnés usa una carga por proceso y mantiene16posiciones,4factores globales,
ocho cargas, ambas fases, mismas144muestras por celda y presupuestos2%/5%.
GC inicial/arranque/teardown se repiten por carga; no hay equivalencia de historia
GC/JIT ni afirmación causal. Son1024workers y9216tiempos por Node en el estudio
previsto, aún NO EJECUTADO. La revisión independiente final terminó sin hallazgos.
Publicar y autenticar antes de medir una sola
secuencia nueva. Nunca reiniciar seeded ni la captura V8 ya consumidos.

La corrección XML y todo el ensayo seeded rechazado están publicados/autenticados
en bc269e63. Storage quedó publicado/auth en11f9597e de feature/inventory-node-helpers:
13contratos por cuatro perfiles y ledger18módulos/32APIs/55anclas auditadas, sin
Rust nuevo, alcance cerrado ni porcentaje. Ownership sigue sin aceptación/tag/merge.
El objetivo integral continúa abierto. Los apartados siguientes son históricos.

## Histórico: ensayo rechazado preservado y corrección XML validada

La sesión original30376 terminó con exit0 de verificación. Ambos padres Node
terminaron con exit1 presupuestario; los256workers terminaron con exit0. El
resultado completo es verified=true, accepted=false: dos controles jsdom fuera
de ±2% por Node, cuatro en total. No hay filas Rust fuera de su límite numérico;
los controles rechazados impiden aceptar el conjunto. NO reiniciar esta secuencia.

Se preservaron2033archivos con readback en
reports/benchmarks/native-class-ownership/seeded-pre-gc-results/2026-10-22/.
El tar tiene38684023bytes, SHA39299c4ae809e5a4386a9963f2c35dde657e188404012ed46c8824c26be5a10f.
La verificación original y la copia son iguales; todas las muestras y negativos
permanecen. Fuentes medidas737a2ba1/grafo409/SHA7ab4948d4f717b0cc7eaeb7c5e127f28e8417c63f667ed955a341c1fbb071981.
Memoria:24576observaciones de cada tipo Window/Document, sin supervivientes en
los endpoints finales, con límites en el reporte de memoria adyacente.

El fix de replay XML ya pasa22contratos por Linux Node22.12/24.14 y18por Windows
Node22.12/24.22.1, con cuatro omisiones Linux-only explícitas. Actionlint1.7.12
aprobó. Evidencia en reports/validation/native-class-ownership/xml-replay-only-ci-fix/.
No se repinea un positivo ni se oculta el XML posterior con accepted=null.
La revisión independiente final no dejó hallazgos: cotejó ambas calificaciones,
archivos, medianas y memoria, sin ejecutar mediciones. Se publica este hito de
corrección CI y evidencia; ownership sigue rechazado, sin tag ni merge.
El CI general39844860686 y preparación39844860784 de a09924e4 terminaron success.
Esos checks corresponden a a09924e4, no al commit posterior de esta corrección.
Los apartados históricos siguientes describen estados anteriores; no son órdenes
para reiniciar procesos o repetir pruebas ya consumidas.

Storage está validado aparte en Linux22.12/24.14 y Windows22.12/24.22.1:13tests
por perfil y tres ciclos de memoria por Node Linux. Falta publicar sus derivados
y evidencia en feature/inventory-node-helpers. La propuesta de aislar cargas sigue
SOLO documental: no está implementada ni calificada ni medida. No hay código Rust
nuevo, aprobación de ownership, merge o tag. El objetivo integral sigue abierto.

## Histórico: XML y el fix durante la ejecución original

El run XML39844860696 sobre a099 ejecutó una medición nueva: selector devolvió
reuse=false con exit0 al comparar fuentes actuales con el archivo viejo; el
workflow usó esa respuesta para volver a calibrar. La calibración AA terminó
rechazada (accepted=null), sin AB. No relanzar ni escoger solo una corrida verde.
Se preservaron ambos ZIP originales con su digest GitHub: run39839886242,
artefacto12454047296, SHA6e618c74e56c967f833f44b09adc3aa903cb02f831e0d000d8075056f3169703;
y run39844860696, artefacto12455698885,
SHAeccb15865ec506363a701b7a8d8f55d21ef123a1956defc2912c14baa5c16a7b.
Rutas en .cache/xml-current-inputs-studies.json. No se extrajeron completos
ni se verificaron de nuevo: hacerlo cuando termine el ensayo local activo.

Fix preparado en cuatro archivos fuera del grafo409 congelado:
.github/workflows/xml-controller.yml solo reproduce evidencia; xml-history.cjs
exige elegibilidad antes de emitir selección; constants/xml-history.json actualiza
solo el hash de esa política; xml-history.spec.cjs agrega regresiones CLI reales
para fuentes/build inputs distintos y ejercita la selección positiva original
con el workflow actual. No se cambió el archivo de mediciones fijado ni presupuestos.
Actionlint1.7.12 pasa y la revisión estática quedó sin hallazgos. Faltan los
contratos/CLI Node22/24 y la revisión final; no commitear sin esas pruebas.
Debe detener el CI ante evidencia incompatible, no volverlo verde
sin sustento. No toca el método de ownership que sigue ejecutándose en Node24.

## Histórico: estado parcial del ensayo

La secuencia original session30376/root4zryergi completó Node22:128workers,
cero fallos de ejecución, exitCode=1 y accepted=false. Dos controles jsdom de
AB exceden ±2%: mutation-records-collect/1000 +2.9466313394961086% y
range-control-1000/250 +2.41581572440559%. Ninguna fila Rust excede el
presupuesto numérico de su fase; eso no concede aceptación al conjunto.
Node24 arrancó en la MISMA secuencia, padre PID687730, driver671903,
y fue confirmado vivo al registrar este estado. Node22 PID671904 ya terminó.
No reiniciar ni omitir Node24 por el negativo anterior. No ejecutar CPU intensiva
ni cambiar fuentes medidas. Esperar ambos resultados y verificación del conjunto
antes de archivar/revisar/publicar el ensayo; todavía no está completo.
Dos lectores offline de .cache conservan todos los grupos y filas de Node22,
sin modificar aceptación, en seeded-pre-gc-node22-*-diagnostics.json. La propuesta
reports/progress/ownership-row-isolation-proposal.md es WIP solo documental:
no está implementada, calificada ni medida. No aplicar otro método hasta terminar
y preservar el ensayo activo, incluidos ambos Node y sus negativos.

## Check ownership confirmado: esperar y preservar la secuencia original

El usuario confirmó que el fallo a corregir es Native class ownership Node22
del PR80. El run39839886330 aprobó los contratos del verificador y rechazó
después fuentes B distintas del archivo paired-inline histórico. No corregir
ese rechazo cambiando únicamente los hashes: aquel estudio también conserva
accepted=false. La aceptación nueva depende de la secuencia seeded ya iniciada.

El CI general39839886220 de dd75a22c terminó success: ocho jobs aprobados,
Linux/macOS/Windows, cuatro shards y agregación. Metadata original en
.cache/ci-dd75-complete/run.json; log original Windows en .cache/ci-dd75-windows/.
El job120037788326 usó Node24.22.0 (confirmado también por ambos workers WPT),
no24.21.0/24.22.1. El caso Range-mutations-dataChange conserva2808 resultados
comparados; referencia31430.9888ms y candidato14818.6822ms. Son diagnósticos de
compatibilidad, no aprobación del presupuesto ownership ni prueba de fugas.
El helper de archivado conservará esas fuentes de evidencia junto al ensayo.
La copia versionada de metadata, log y diagnósticos está en
reports/validation/native-class-ownership/ci-dd75-followup/; su revisión
independiente y los hashes no conceden aceptación al gate ownership.

El helper local .cache/archive-seeded-pre-gc-study.py está preparado y revisado
estáticamente sin hallazgos. Su --check-ready rechaza el padre Node22 vivo antes
de copiar, comprimir o verificar; el archivado NO se ejecutó. Al finalizar ambos
Node y verificarse la integridad, preservará todo el root original y sus negativos,
recalculará --verify-set sobre una copia sin nuevos workers de medición y exigirá
el mismo resultado. El marcador se crea exclusivamente y el tar verifica cada
archivo de vuelta. Revisar los resultados reales antes de integrar evidencia al
gate, hacer commit/push o afirmar que ownership pasó. No modificar las409fuentes
congeladas ni relanzar captura/ensayos. Storage permanece como WIP aparte sin
validar; la auditoría Event/EventTarget solo se leyó, sin cambios ni ejecución.

## Ensayo con semillas iniciado: no reiniciar

Método publicado y autenticado en `737a2ba1c2cf5994561c3b739232f5e3cb6fb257`: 409 blobs y recibo
GitHub coinciden con la calificación. SHA del arnés:
7ab4948d4f717b0cc7eaeb7c5e127f28e8417c63f667ed955a341c1fbb071981.
Una sola secuencia está iniciada en `/tmp/rustdom-seeded-pre-gc-study-4zryergi`, session30376,
Node22 PID671904, driver PID671903. Se confirmó vivo al
registrar esta instantánea; comprobar procesos reales y process.json antes de
actuar. `reports/progress/seeded-pre-gc-start.json` guarda el momento.

El marcador `.cache/seeded-pre-gc-study.started.json` está consumido.
NO reiniciar por silencio, timeout de observación o un lock. Esperar el mismo
handle/PID si está vivo. No ejecutar tareas CPU intensivas ni modificar fuentes
medidas mientras corre. Node24 debe seguir al finalizar Node22, incluso si
rechaza presupuestos. Un fallo de integridad detiene y conserva lo parcial.
Guardar todos los crudos y la decisión del conjunto completo, también negativos.
Todavía no hay una aceptación o mejora nueva ni autorización de merge/tag.

La captura de optimización y los ensayos anteriores están terminales y no se
repiten. La auditoría de geometría eaf1a736 está publicada por separado;
ningún algoritmo nuevo Rust se acredita por este método o esa clasificación.
Las instrucciones de calificación históricas siguientes no autorizan relanzar
esta secuencia. Sus fuentes efectivas permanecen en el snapshot publicado737a2ba1;
este registro de inicio solo modifica documentación fuera del arnés medido.

## Histórico: CI corregido y calificación del método con semillas

El CI general 39828339458 de 343efdc8 pasó sus ocho jobs: Linux/Windows/macOS,
memoria, paquete, Valgrind y benchmarks generales. XML 39828339502 y preparación
39828339498 también aprobaron. El worker remoto WPT usó Node 24.21.0;
localmente se validó 24.22.1 además de 22.12.0. Logs y límites observados en
`reports/validation/native-class-ownership/wpt-ci-followup-343efdc8/`.
El gate ownership 39828339560 sigue rechazado; no repinear para ponerlo verde.

La auditoría de geometría está publicada por separado en eaf1a736, rama
`feature/inventory-node-helpers`: 16 módulos, 45 anclas y 23 APIs auditados.
Denominadores 531/4374/7246 intactos, sin Rust nuevo ni porcentaje global.
La antigua mención de ese WIP sin validar quedó superada por ese commit.

El método `seeded-pre-gc` está CALIFICADO, todavía NO MEDIDO. Node 22.12.0 y
24.14.1 pasan 11 tests cada uno: cinco paquetes oficiales con semillas y dos
workers default, 56 lotes/504 tiempos funcionales por Node, 672 owners de cada
tipo. Fuentes: 409, SHA 7ab4948d4f717b0cc7eaeb7c5e127f28e8417c63f667ed955a341c1fbb071981.
Archivo de 501 crudos/fuentes: SHA f2a955c51ed094401c492c452811fc6f51559daf62c3397ee5cdae346588bc67.
Detalles en `SEEDED-PRE-GC-PROTOCOL.md` y
`reports/validation/native-class-ownership/seeded-pre-gc-method/`.

Controla semillas 1..16 por posición, iguales entre A/B y ambos motores.
No desactiva JIT/compilación/GC concurrentes, no usa predictable ni garantiza
control del hash incorporado en snapshots. Probes RNG reales, flags efectivos
y endpoints verificados. Conserva sampler, ocho filas, 16 posiciones y las
combinaciones de cuatro factores, 3 warmups/9 muestras y presupuestos 2%/5%.
No atribuir todavía la variación previa a las semillas.

Antes de medir: revisión final, commit/push y autenticación de los 409 blobs y
recibo. Usar un marcador nuevo exclusivo, raíz nueva y ambos Node. Si sigue
activo, no reiniciar por silencio ni ejecutar CPU intensiva o modificar fuentes
medidas. No relanzar la captura o estudios históricos consumidos. El ensayo
pre-GC anterior sigue íntegro y rechazado (11 controles jsdom); no mezclar sus
tiempos. Hasta aceptar un conjunto completo, ownership sigue sin merge/tag.

## Histórico: ensayo pre-GC terminal y corrección WPT de Windows

La secuencia `/tmp/rustdom-pre-gc-warmup-study-x5ykpauj`, session23748,
está TERMINAL. Ambos drivers terminaron con exit1, con128/128 workers
completos por Node. La verificación original y la reconstrucción offline
terminaron con exit0 y el mismo resultado: verified=true, accepted=false.
Node22 rechaza4 controles jsdom y Node24 rechaza7;0 puntos Rust exceden sus
presupuestos numéricos. No aceptar, repetir ni reinterpretar esta secuencia.
Se preservan1992 archivos,256 workers,18432 duraciones y403 fuentes congeladas
en `reports/benchmarks/native-class-ownership/pre-gc-warmup-results/2026-10-22/`.
Archivo SHA-256:4e33dceb5f42555c1536e096be2af3c985909ee1d31ad53acb3bbc76c0541670.
La captura de optimización y el ensayo anterior también siguen terminales.
PR80 continúa sin aceptación de rendimiento ni merge/tag de ownership.

El CI39817139002 pasó Linux/macOS y los shards generales, pero Windows falló
en el estado global TIMEOUT(2) de la referencia jsdom del WPT Range. Node del
job:24.22.1. `test:compat` ahora limita el lote general a2 procesos y ejecuta
la suite WPT después, aislada del lote. No se cambian límites, fixtures,
aserciones ni cleanup. El helper nuevo conserva ambos reportes si la
comparación falla; antes se perdían esos temporales. Esto no cambia Rust.
La prueba de correspondencia284+8 describe los heads históricos indicados;
este cambio posterior modifica package.json solo en el comando de tests.
`src/`, `scripts/`, Cargo y build.rs permanecen iguales al paquete Windows
7d5ada1f usado para validar, con hashes del paquete y addon verificados.

Validación local terminal: Node22.12.0 pasa3 tests de diagnósticos y8 WPT;
Node24.22.1 pasa3748 generales+8 WPT=3756, sin fallos ni omitidos. La referencia
Range tarda40.00s/28.82s respectivamente, con2808 casos comparados y estado OK.
Los timeouts intencionales siguen verificándose.
La validación local y procedencia se conservan en
`reports/validation/wpt-ci-isolation/`. Consultar sus process.json y logs,
y los checks del SHA publicado, antes de afirmar que el CI remoto está verde.
El WIP de geometría en el worktree de inventario continúa sin validar y no
forma parte de esta corrección. No stagear cambios de otros worktrees.

## Histórico: inicio del ensayo GC antes del warmup

Método publicado y autenticado en `a558e472`:403 blobs Git y recibo de GitHub
coinciden, hash del arnés8798e3f0420e7bf78fe6dc9051bc4bda787fe2ccf047cc5a12a97b9381ad3543.
Se inició una sola secuencia sin tracing en
`/tmp/rustdom-pre-gc-warmup-study-x5ykpauj`, session23748, Node22 PID615481.
El proceso fue confirmado vivo al registrar esta instantánea. Driver, publicación
y momento están en `reports/progress/pre-gc-warmup-start.json`; esto no garantiza
que siga activo al leerlo después. El marcador exclusivo
`.cache/pre-gc-warmup-study.started.json` está consumido. NO relanzar.

Consultar primero el handle y los procesos reales, archivos process.json e
índices Node22/24 de esa raíz. Esperar la secuencia existente si sigue activa.
No confundir silencio o timeout de observación con terminación. Completar ambos
Node y guardar íntegros crudos y rechazos; fallo de integridad detiene la
secuencia conservando lo parcial. No modificar código ni ejecutar tareas CPU
intensivas locales mientras mida. Aún no hay decisión de rendimiento nueva.

La captura de optimización y el ensayo caliente anterior siguen terminales y
no deben repetirse. Ownership permanece abierto, sin aceptación, merge/tag o
crédito de migración. Las instrucciones de preparación siguientes documentan
la calificación previa; no son autorización para iniciar otra secuencia.

## Histórico: calificación de GC antes de calentar

La variante explícita `warmupGcOrder=before-warmup` mueve las mismas dos
colecciones major asincrónicas y una síncrona antes de las tres rondas en la
ventana actual. No fuerza GC entre warmup y reloj; GC natural y asignaciones
temporales siguen formando parte del método. Defaults frío y warmup anterior
conservados. No hay cambio de algoritmos Rust ni causa de variación demostrada.

Node22/24:23 tests por versión pasan, con las cinco copias oficiales, ambos
órdenes, ocho hashes públicos, CLI/Vitest/VM y endpoints Window/Document/nativos.
Evidencia en `reports/validation/native-class-ownership/pre-gc-warmup-method/`:
491 crudos/fuentes,403 fuentes del método autenticadas, fallos de preparación
conservados. Protocolo en `PRE-GC-WARMUP-PROTOCOL.md`. Los tiempos de estos
tests son funcionales y no deciden presupuestos. Calificación local terminal
`/tmp/rustdom-pre-gc-method-exroua90`, sin captura o benchmark de aceptación activo.

Antes del ensayo nuevo: revisión final de evidencia, commit/push y autenticación
de los403 blobs publicados y recibo. Usar los wrappers guardados en el tar:
`authenticate-pre-gc-warmup.py` y `run-pre-gc-warmup-study.py`. Mantener las ocho
cargas y límites±2%/±5%/+5%, ambas versiones y todos los factores. El launcher
usa un marcador exclusivo `.cache/pre-gc-warmup-study.started.json`; si existe,
consultar primero el proceso real y sus informes. NO reiniciar por silencio.
Guardar handle y resultado completo. No modificar código ni ejecutar tareas
CPU intensivas locales mientras mida. Sin aceptación, merge/tag ni crédito Rust.

## Estado vigente: corrección CI calificada y warmup rechazado

El productor de CI ya no intenta aceptar fuentes actuales con la huella de
tiempos históricos. La preparación v2 registra su propia identidad; v1 conserva
los pins originales y ambos lectores rechazan intercambiar sus archivos.
Builds reales A/B, 14 contratos actuales + 17 históricos por Node22/24 y los
workers reales pasan. Seis contratos de inputs pasan también en Windows24.
Actionlint con shellcheck pasa. Código y evidencia están en
`reports/validation/native-class-ownership/current-build/`. Después de calificar
solo cambiaron la agrupación equivalente de GITHUB_ENV y el estado documental.
Verificar los checks de GitHub sobre el SHA publicado antes de dar ese CI por verde.

La secuencia única `/tmp/rustdom-realm-warmup-study-m5hpgvcr`, session10086,
está TERMINAL. Los 256 workers terminaron con exit0; cada driver Node terminó
con exit1. La verificación de integridad exit0 confirma `verified=true`,
`accepted=false`: once controles jsdom exceden ±2%, cinco en Node22 y seis en
Node24. Todos los puntos Rust cumplen los límites, pero el ensayo completo
sigue rechazado. No cambiar presupuestos ni volver a ejecutarlo.

Crudos completos y fuentes: `reports/benchmarks/native-class-ownership/realm-warmup-results/2026-10-22/`.
18.432 duraciones medidas; 24.576 Window y Document por tipo, incluyendo 6.144
warmups exteriores por tipo. Los contadores trackedOwners son acumulativos por
worker: usar el último valor de cada worker, no sumar sus lotes. Memoria y límites:
`reports/memory/native-class-ownership/realm-warmup-results.json`. Endpoints
finitos claros no prueban ausencia absoluta de fugas. Estado terminal legible
en `reports/progress/realm-warmup-terminal.json`.

La captura de optimización anterior también está terminal; NO repetir ninguna.
No hay aceptación de rendimiento, merge, tag ni crédito Rust adicional.
Siguiente: verificar publicación y CI del arreglo; resolver la calibración con
un cambio concreto, prospectivo y probado antes de medir. Cerrar el hito80
antes de avanzar a otra implementación de producción. El objetivo completo
permanece activo y el porcentaje global sigue sin denominador auditado.

## Histórico: inicio registrado del ensayo de warmup; no reiniciar

Método publicado y autenticado en4a57f334,397 fuentes Git y recibo GitHub
coincidentes. Se inició una única secuencia sin tracing desde el arnés congelado
en `/tmp/rustdom-realm-warmup-study-m5hpgvcr/harness`, session10086,
Node22 PID565153. El PID del driver, momento de inicio y publicación exacta
están en `reports/progress/realm-warmup-start.json`. El marker exclusivo local
`.cache/realm-warmup-study.started.json` está consumido. NO relanzar.

Este registro es una instantánea del inicio, no garantiza que siga activo.
Consultar primero procesos y node-22/node-24/index.json, archivos process.json
y verification.json bajo esa raíz; esperar el proceso existente si sigue vivo.
El driver completaba Node22 y después Node24, conservando rechazos completos y
deteniendo ante fallo de integridad. Al registrar este inicio no había decisión.
La captura de optimización anterior sigue terminal y tampoco debe repetirse.

## Actualización: variante de warmup por ventana calificada

Lectura completa de la captura única publicada en4e3a1113; NO repetirla.
El nuevo método opt-in está en REALM-WARMUP-PROTOCOL.md: tres rondas de
operaciones fuera del reloj en la misma ventana; temporales removidas y GC
antes de medir. No es el costo de primer uso ni cambia los rechazos anteriores.

Node22/24:23 tests por versión pasan, con cinco paquetes oficiales, hashes
públicos históricos y liberación separada de Window/Document y baseline nativo.
El test inicialmente fallido confundía rangeClones con rangeStates: corregido
y conservado el fallo en el histórico. Evidencia completa en
reports/validation/native-class-ownership/realm-warmup-method/.
Revisión read-only del código sin hallazgos. Publicación autenticada y secuencia completa de realm-warmup iniciada una
vez, con las ocho cargas, factores y presupuestos originales; ver registro superior. Todavía sin aceptación,
sin merge/tag y sin crédito Rust. El gate actual conserva su rechazo.

## Actualización: captura de optimización terminal, no repetir

La única captura del launcher publicado en8d4dcf67 terminó con exit0. Raíz
`/tmp/rustdom-optimization-capture-zyog41xf`, session49422/PID494010 terminal.
El marker está consumido: no borrarlo ni relanzar --capture. Completaron
Node22 J0/J1 y Node24 J1/J0: cuatro procesos,32 lotes,384 Windows incluyendo
96 warmups y288 duraciones medidas conservadas. El sampler original no
cambió; preparación, ejecutables y fuentes quedaron iguales antes/después.

Los423 archivos del índice se autenticaron. El lector offline en
`reports/benchmarks/native-class-ownership/optimization-log-results/` conserva
138.028 encabezados completos, clasifica optimización, bailout e invalidación,
y mantiene payloads en los logs crudos. Las lecturas anteriores y la vigente
están separadas bajo la raíz local; no son nuevas capturas.

Se ven invalidaciones para código llamado cloneRange por weak objects y
otros motivos, y recompilaciones en generated/Range.js y Range-impl.js.
Los registros no alinean eventos con los temporizadores del DOM. No sumar
sus duraciones como CPU/pausas, no atribuirles el rechazo de Azure y no usar
los tiempos instrumentados para aceptar presupuestos. Los rechazos anteriores
siguen vigentes. Lectura y publicación completas en4e3a1113; el contraste prospectivo nuevo
conserva presupuestos y declara su alcance de operaciones calientes.

## Histórico: launcher calificado antes de la captura (superado)

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
