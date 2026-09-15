# Estado escalar nativo de Event

Rust mantiene tipo UTF-16, fase, timestamp, confianza y flags de Event, junto
con cancelación, propagación y reinicialización. preventDefault respeta
cancelable y listeners pasivos; returnValue/cancelBubble conservan sus setters
de una sola dirección. initEvent no modifica un evento en dispatch y preserva
composed/timestamp al reinicializar, como el jsdom fijado.

El constructor conserva el loop original para datos de subclases y usa su
defaultInit real. Los flags base se inicializan juntos; la confianza y Date.now
del host se aplican en el punto final original. Document.createEvent y los
consumers de flags del dispatch siguen usando sus propiedades, ahora nativas.
Los targets, currentTarget, path y datos específicos de subclases siguen en JS.
No se supone que todo EventTarget sea Node.

## Contratos y memoria

El [baseline](event-state/baseline.log) guarda ocho tests públicos aprobados
en jsdom y rustdom antes de migrar: defaults, UTF-16, timestamp, cancelación
pasiva, propagación, redispatch, initEvent durante dispatch, eventos sin
inicializar y subclases CustomEvent/MouseEvent/KeyboardEvent/MessageEvent.

Tres tests Rust cubren transiciones y preservación de campos. El contrato raw
verifica flags, fase/timestamp, receptores ajenos y entradas inválidas. Se
ejecutaron 19 tests focales con Event, retargeting y señales reales. Una primera
invocación usó un nombre de archivo de retargeting inexistente; se localizó el
archivo correcto y se ejecutó tests/event-retarget.spec.cjs antes de cerrar
esa cobertura.

El [control de cinco ciclos](../memory/2026-09-13T14-51-25.365Z-event-state.json)
retiene NativeEventState mientras el evento público, target, Document y Window
se recolectan. El estado conserva sus escalares y puede reinicializarse sin
mantener esos objetos vivos; soltarlo devuelve los contadores al baseline.
Los endpoints generales incluyen eventStates.live. Son pruebas finitas, no
una garantía absoluta de ausencia de fugas.

## Regresión de BeforeUnloadEvent

La prueba pública adicional detectó que el setter generado de BeforeUnloadEvent
convierte returnValue a DOMString. Event-impl compartido por jsdom actúa solo
ante el booleano false; el primer binding nativo rechazaba strings con
BooleanExpected. El [fallo reproducido](event-state/beforeunload-before.log)
conserva jsdom aprobado y rustdom fallido.

El binding acepta ahora cualquier valor y aplica la transición solo para
booleanos; no retiene el argumento JavaScript. El core mantiene su contrato
booleano. Se verifican valores no booleanos sin conversión y cancelación forzada
por onbeforeunload aun en eventos no cancelables. Las [21 pruebas focales
posteriores](event-state/after-fix.log) pasan, incluida la recolección de objetos
y eventos reales de Shadow DOM. El consumidor TypeScript instalado también
ejerce el setter público y el binding corregido.

## Paquete y análisis nativo de memoria

El artefacto corregido tiene SHA-256
`c879019873b7b73c58742553241d58638fe968faad4ef9f7a0b4a1f4baf06b7c`.
Pasaron 18 controles instalados en [Node 24](../distribution/2026-09-13T15-11-59.472Z-linux-x64.json)
y 18 en [Node 22](../distribution/2026-09-13T15-14-11.161Z-linux-x64.json):
npm/pnpm, TypeScript, CommonJS, ESM/VM, Unicode del host, workers, Jest y Vitest.
Las corridas anteriores al fix se conservan por separado y no acreditan el
setter corregido.

El [Memcheck del ejecutable recompilado](../memory/2026-09-13T15-09-18.065Z-event-state-valgrind.log)
ejerció los tres tests Rust de Event: cero errores, cero bytes definitivamente
perdidos y cero indirectamente perdidos, sin supresiones. Se conservan 48 bytes
posiblemente perdidos y 544 todavía alcanzables cuyos stacks pertenecen a
std/libtest. Esta corrida no ejecuta V8 ni certifica todas las dependencias.
El [GC posterior al fix](../memory/2026-09-13T15-09-41.331Z-event-state.json)
complementa ese control con eventos y roots reales.

El [control general posterior al fix](../memory/2026-09-13T15-16-49.371Z-linux-x64.json)
aprobó jsdom, rustdom, native, vitest y vitest-vm con el mismo binario nativo del
paquete, `bec81a510d556058fbb5517b5ae898d972a00f1e123a1f49a4613e972a73dffd`.
Rustdom liberó los 1.322 documentos y 882 ventanas observados; cada entorno
Vitest liberó 1.320 documentos y 880 ventanas. Todos los contadores nativos
controlados, incluido eventStates.live, volvieron al baseline. El delta RSS
final fue 18,94 MiB en rustdom, 27,86 MiB en vitest y 88,62 MiB en vitest-vm:
los roots observados se liberaron, pero este resultado no significa que RSS
deba volver a cero ni prueba ausencia absoluta de fugas.

## Validación general del estado corregido

La [validación completa](event-state/validation.json) pasó formato, Clippy,
194 tests Rust, 583 contratos Node, 7 tests Jest, 18 Vitest y 26 Vitest VM.
HTML5 mantuvo 1.784 casos comparables aprobados y ocho casos con scripting
excluidos. El [WPT ejecutable](../compatibility/2026-09-13T15-15-14.964Z-linux-wpt.json)
mantiene 43.708 resultados en paridad entre motores: 42.678 aprobados por el
estándar y 1.030 fallos compartidos. Range-deleteContents continúa bloqueado
durante el bootstrap de la referencia, por lo que no se declara completo el
corpus ni se presenta la paridad como conformidad total con estándares.

## Benchmark completo de las operaciones afectadas

La [corrida aislada](../benchmarks/2026-09-13T15-20-21.339Z-linux-x64.json)
conserva 18 muestras por motor y operación, en dos procesos por motor con tres
warmups cada uno y orden alternado. El ratio es mediana jsdom / mediana rustdom;
solo valores mayores que uno favorecen a rustdom. Los tamaños de lifecycle y
dispatch representan eventos; los demás siguen sus fixtures documentados.

| Operación | Tamaño | jsdom ms | rustdom ms | Ratio |
|---|---:|---:|---:|---:|
| construct-native-eligible | 25 | 10,493 | 11,032 | 0,95× |
| construct-native-eligible | 250 | 30,195 | 41,389 | 0,73× |
| construct-native-eligible | 1000 | 72,455 | 123,578 | 0,59× |
| shadow-retarget-events-100 | 10 | 15,147 | 16,808 | 0,90× |
| shadow-retarget-events-100 | 30 | 174,114 | 43,515 | 4,00× |
| slot-events-100 | 25 | 1,631 | 4,729 | 0,34× |
| slot-events-100 | 100 | 1,375 | 4,375 | 0,31× |
| observer-delivery-slots | 100 | 0,587 | 1,743 | 0,34× |
| observer-delivery-slots | 1000 | 4,309 | 16,890 | 0,26× |
| event-state-lifecycle | 100 | 0,470 | 1,009 | 0,47× |
| event-dispatch | 100 | 0,561 | 1,273 | 0,44× |
| event-state-lifecycle | 1000 | 3,413 | 8,126 | 0,42× |
| event-dispatch | 1000 | 3,348 | 10,750 | 0,31× |

La migración escalar todavía no satisface el objetivo de rendimiento: lifecycle,
dispatch simple y slots son más lentos que jsdom. El dispatcher original conserva
consultas y escrituras individuales a los flags nativos; el siguiente trabajo debe
migrar su control y agrupar transiciones para reducir cruces. La ventaja con árboles
de shadow profundos incluye migraciones previas y no se atribuye a este cambio.
No se interpreta la comparación entre corridas separadas como prueba causal del
costo de un componente, ni estas cargas sintéticas como aceleración de una suite.

## Alcance

Esta etapa migra el estado escalar y las transiciones base. El armado y
filtrado del path, composedPath, registro de listeners, control de dispatch y
algoritmos específicos de subclases siguen pendientes de migración. Los
bindings actuales agregan cruces por propiedad y las operaciones anteriores se
midieron antes de publicar el cambio. El objetivo integral continúa abierto.
