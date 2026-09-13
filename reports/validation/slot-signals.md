# Cola nativa de señales de slots

Rust conserva el orden de la primera señal y deduplica slots pendientes. La cola
se vacía antes de callbacks de MutationObserver; cualquier señal que encolen ellos
o los listeners queda en el siguiente lote. La programación del microtask, las
colas de observadores y la entrega de eventos siguen en JavaScript.

El bridge agrega un owner V8 solo cuando Rust acepta un slot nuevo y resuelve
todos los IDs del lote antes de soltar los owners pendientes. El snapshot de
entrega mantiene sus referencias durante los callbacks, igual que la lista
original. Los identificadores finalizados de la API raw se filtran al vaciar y
se compactan de forma amortizada, sin desplazar todo el vector por cada nodo.
Los handles liberados nunca se reutilizan; un identificador descartado no puede
convertirse en una señal nueva del mismo lote.

## Contratos y memoria

El contrato inicial se ejecutó en ambos motores antes de sustituir la cola.
Dos ventanas con roots abiertos/cerrados producen un orden distinto al de
creación de observadores. Un observador y un listener mutan y lanzan errores;
se comprueban identidad de los errores, reportes públicos, entregas restantes,
deduplicación y orden del siguiente lote. Otro caso comprueba entrega después
de cerrar la ventana. No hay mocks de Promise, observers ni EventTarget.

Cuatro tests Rust cubren orden, duplicados, lotes independientes, errores y
metadata inválida sin efectos parciales, compactación tras 2.000 slots y 1.000
ciclos de vaciado con un slot todavía vivo. Los cinco contratos Node agregan
la API raw, contadores reales dentro de callbacks y un control de GC.

El [control focal](../memory/2026-09-13T06-51-02.600Z-slot-signals.json) ejecuta
cinco ráfagas de 12 ventanas cerradas, cada una con tres slots y señales repetidas.
Antes del siguiente turno hay 36 señales únicas; se entregan exactamente 36,
y Document, Window y nodos se recolectan por separado. Conteos y capacidades
vuelven al baseline. Es evidencia de esos escenarios finitos, no una prueba
absoluta de ausencia de fugas.

Memcheck aprobó 26 tests de slots/señales con cero errores y cero pérdidas
definitivas o indirectas. El
[log completo](../memory/2026-09-13T07-00-10.174Z-slot-signals-valgrind.log)
conserva 48 bytes posibles y 544 alcanzables de std/libtest, sin supresiones;
también se guardan salida de tests y hash del ejecutable.

El [estrés de cinco modos](../memory/2026-09-13T07-04-06.360Z-linux-x64.json)
aprobó jsdom, rustdom, native, Vitest y Vitest VM. Rustdom liberó los 1.322
documentos y 882 ventanas observados; cada Vitest liberó 1.320 documentos y
880 ventanas. Heap/RSS retenido: 2,80/18,42 MiB rustdom, 4,03/27,72 MiB Vitest y
3,69/88,44 MiB VM. Son mediciones posteriores a warmup, teardown y GC, no memoria
pico ni cantidades totales de allocations.

## Validación integral, distribución y rendimiento

`npm run validate` aprobó 164 tests Rust, 517 contratos Node, 7 Jest, 18 Vitest
y 26 VM, más 1.784 casos HTML5 comparables con 8 script-on excluidos.
El [WPT](../compatibility/2026-09-13T07-01-20.144Z-linux-wpt.json) mantiene
43.708 casos ejecutables en paridad: 42.678 aprobados por estándar y 1.030 fallos
compartidos. Conserva sus límites explícitos, incluido el bootstrap
bloqueado de Range-deleteContents. No acredita compatibilidad integral.

El paquete `9d230e26fce7161f382df86164252b6b266f794c34e9d5bfaab0ad9d5d3b5765`
aprobó 18 controles en [Node 24.14.1](../distribution/2026-09-13T07-03-19.401Z-linux-x64.json)
y 18 en [Node 22.12.0](../distribution/2026-09-13T07-05-36.242Z-linux-x64.json).
Ambos instalan con npm/pnpm fuera del checkout. Los consumidores tipados ejercen
las APIs raw, la eliminación de slots pendientes y el vaciado de una cola real
en un contexto VM.

El nuevo benchmark prepara 100/1.000 slots y Text separados y mide tres
mutaciones públicas por slot, incluidas comprobaciones de identidad/padre y
deduplicación. La entrega se comprueba fuera del timer, con exactamente una
notificación por slot, contenido final y hashes completos. No se presenta como
una medida aislada de inserción en un hash set ni de latencia de callbacks.

El [benchmark completo](../benchmarks/2026-09-13T07-13-15.624Z-linux-x64.json)
conserva 18 muestras por motor/caso, con órdenes alternados y sin otros runners
locales. La ráfaga expuso una regresión importante del recorrido completo:

| Operación | Tamaño | jsdom ms | rustdom ms | Ratio |
|---|---:|---:|---:|---:|
| Ráfaga de señales, tres mutaciones por slot | 100 slots | 5,354 | 32,696 | 0,16× |
| Ráfaga de señales, tres mutaciones por slot | 1.000 slots | 363,883 | 2.681,170 | 0,14× |
| 100 eventos por slots | 25 slots | 1,666 | 2,842 | 0,59× |
| 100 eventos por slots | 100 slots | 1,455 | 2,561 | 0,57× |
| 100 lecturas de caché | 25 slots | 0,087 | 0,207 | 0,42× |
| 100 lecturas de caché | 100 slots | 0,066 | 0,187 | 0,35× |
| 100 consultas frescas, denso | 25 slots | 8,667 | 0,440 | 19,69× |
| 100 consultas frescas, denso | 100 slots | 99,256 | 1,046 | 94,87× |
| 100 reasignaciones, denso | 25 slots | 16,417 | 2,263 | 7,26× |
| 100 reasignaciones, denso | 100 slots | 196,521 | 3,250 | 60,47× |

Ratio = mediana jsdom / mediana rustdom. Las demás operaciones de aplanado,
lookup y retargeting también están preservadas en el informe completo. No se
afirma una mejora universal ni una comparación causal contra el checkpoint previo.

El [perfil de CPU](../benchmarks/slot-signals-2026-09-13.cpuprofile), su
[análisis reproducible](../benchmarks/slot-signals-profile-analysis.cjs) y
[resumen](../benchmarks/slot-signals-2026-09-13-profile.json) cubren 70,29 segundos
del proceso completo, incluidos startup, preparación, warmup, mutaciones,
callbacks y GC. `assignSlotableForTree` reúne 63,46% inclusivo; los frames de
`slotAssignmentPlan` y `commitSlotAssignment` reúnen 34,88% y 17,62%, mientras
`queueSlotSignal` reúne 0,03%. Los porcentajes inclusivos se superponen y no
deben sumarse. V8 atribuye trabajo nativo a los frames de llamada; no es un
perfil de stacks Rust ni una medida aislada de la sección cronometrada.
El analizador interpreta los intervalos en microsegundos conforme a
[Profiler.Profile](https://raw.githubusercontent.com/ChromeDevTools/devtools-protocol/master/pdl/js_protocol.pdl).

La inspección de Node-impl confirma que cada inserción dentro de un ShadowRoot
repite `assignSlotableForTree`. El siguiente trabajo prioritario es migrar ese
driver completo y reducir llamadas por slot, preservando captura, señalización,
commit, backlinks y reentrancia. La nueva cola no resuelve ese costo por sí sola.
