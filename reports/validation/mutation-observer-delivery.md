# Driver nativo de entrega de MutationObserver

Rust captura el lote de observadores y señales, selecciona cada paso, omite
colas vacías y devuelve Observer, Slot o Complete. Las colas se vacían al llegar
a cada observador, de modo que callbacks anteriores pueden agregar registros
a observadores posteriores del mismo lote. Los slots capturados se entregan
después, incluso si fueron retirados durante un callback.

El driver contiene iteradores de IDs y una identidad débil del árbol. No
retiene objetos JavaScript ni datos del árbol, y rechaza otro forest antes de
consumir sus colas. Completar o cancelar libera buffers; un error nativo cancela
el resto sin descartar colas de observadores todavía no visitados.

El bridge conserva los owners capturados para el trabajo síncrono mediante
WeakRef.deref, reemplaza los contenedores globales para el siguiente lote y
ejecuta cada efecto después de que el paso Rust termine. El callback y el
reporte de errores usan las funciones reales de jsdom; el finally cancela el
driver si un efecto escapa. Las instrucciones completas evitan un cruce final
redundante cuando el último efecto ya agotó el lote.

## Contratos y memoria

El [baseline público](mutation-observer-delivery/baseline.log) reproduce en
ambos motores el orden de callbacks, reporte de error y entrega de un slot
capturado que fue retirado. Los tests raw verifican pasos, identidades, drenaje
tardío, clases/forests incorrectos y buffers finales.

Cuatro tests Rust cubren lotes reentrantes, slots capturados, cancelación que
preserva colas no visitadas, identidad débil del origen, rechazo sin consumir
otro árbol y 1.024 observadores vacíos omitidos en un solo paso. Los 37 contratos
focales de entrega, notificaciones, colas, registro y señales aprobaron antes
de agregar los dos controles adicionales descritos abajo.

El caso de reporter que lanza se ejecuta en procesos Node aislados, usando
VirtualConsole y unhandledRejection reales. El lote abortado no entrega su
slot capturado; los registros pendientes de otros observadores llegan con el
job posterior. No se mockean Promise ni los reporters.

El [control de GC](../memory/2026-09-13T12-34-41.676Z-observer-delivery.json)
retiene drivers completos, pendientes y cancelados mientras sus árboles y
wrappers originales se recolectan. Un pendiente no puede reanudarse con otro
árbol después de perder el origen; sus buffers se liberan. Al soltar cada
driver, sus contadores vuelven al baseline. Los seis tests del archivo
aprobaron con estos controles incluidos. Son pruebas finitas, no una garantía
absoluta de ausencia de fugas.

Memcheck aprobó los quince tests nativos de observadores sin errores ni pérdidas
definitivas o indirectas. El [log completo](../memory/2026-09-13T12-38-45.796Z-observer-delivery-valgrind.log)
conserva 48 bytes posibles y 544 alcanzables de std/libtest, sin supresiones,
junto con la salida de tests y el hash del ejecutable.

El [estrés de cinco modos](../memory/2026-09-13T12-41-16.111Z-linux-x64.json)
aprobó jsdom, rustdom, native, Vitest y Vitest VM. Rustdom liberó 1.322 documentos
y 882 ventanas; ambos modos Vitest liberaron 1.320 documentos y 880 ventanas.
Heap/RSS retenido tras warmup y GC: 2,76/17,94 MiB rustdom, 4,04/25,58 MiB
Vitest y 3,67/26,02 MiB VM. Los contadores de drivers también volvieron al
baseline; no se mide memoria pico.

El paquete
`4f86206725ec84f6f7e99f15891e83fac1ce970370d62bb46ca0a4a1bfce9154`
aprobó 18 controles en [Node 24.14.1](../distribution/2026-09-13T12-41-19.438Z-linux-x64.json)
y 18 en [Node 22.12.0](../distribution/2026-09-13T12-43-37.389Z-linux-x64.json).
Los consumidores npm/pnpm comprueban un lote raw real, pasos y buffers finales,
exports CJS/ESM y un callback público de VM que incrementa el contador de
drivers, además de tipos, assets y runners reales.

La validación integral aprobó 187 tests Rust, 564 Node, 7 Jest, 18 Vitest y 26 VM,
además de 1.784 casos HTML5 comparables. El
[WPT](../compatibility/2026-09-13T12-44-34.191Z-linux-wpt.json) conserva 43.708 casos
en paridad, 42.678 aprobados por estándar y 1.030 fallos compartidos. Se mantienen
las exclusiones y el bootstrap de Range-deleteContents bloqueado; no acreditan
compatibilidad integral.

## Alcance

El control del lote ya es nativo. Los efectos conservan bindings JS para
wrappers, callbacks, creación/despacho de Event y reporte de excepciones.
La familia general de eventos, otros algoritmos DOM y rutas delegadas de
parsing siguen pendientes; este hito no completa el objetivo integral.

## Benchmark

Se agregaron casos que miden el microtask y callbacks después de preparar las
mutaciones: observadores con registros, muchas colas previamente vaciadas más
un sentinel y entrega combinada de un observador con slots. La validación de
campos, identidades y hashes queda fuera del timer.

La primera ejecución falló en un control compartido que aplicaba el recuento
de shadow hosts a los casos nuevos de entrega. Se corrigió el recuento esperado
para estos casos: cero raíces en records/empty y una en slots. El
[diagnóstico fallido](../benchmarks/2026-09-13T12-48-22.115Z-linux-x64-0d203925-7eaa-4311-862e-600699bcd2b3-failed.json)
conserva contexto y salidas; los controles de callbacks y payloads se mantienen.

La [medición corregida](../benchmarks/2026-09-13T12-53-43.230Z-linux-x64.json)
conserva 18 muestras por motor/caso y órdenes alternados. Los casos de entrega
incluyen el microtask y el mínimo trabajo real de callbacks; las mutaciones se
encolan antes del timer. Los otros casos conservan su metodología anterior.

| Operación | Tamaño | jsdom ms | rustdom ms | Ratio |
|---|---:|---:|---:|---:|
| Entrega con registros | 100 observers | 0,272 | 0,237 | 1,15× |
| Entrega con registros | 1.000 observers | 13,021 | 2,180 | 5,97× |
| Colas vaciadas y un sentinel | 100 observers | 0,252 | 0,043 | 5,81× |
| Colas vaciadas y un sentinel | 1.000 observers | 12,571 | 0,108 | 116,85× |
| Entrega combinada | 100 slots | 0,575 | 1,027 | 0,56× |
| Entrega combinada | 1.000 slots | 4,329 | 9,578 | 0,45× |
| Ráfaga de señales | 100 slots | 7,223 | 4,989 | 1,45× |
| Ráfaga de señales | 1.000 slots | 329,212 | 223,446 | 1,47× |
| Mutaciones y recolección | 100 grupos | 1,439 | 4,563 | 0,32× |
| Mutaciones y recolección | 1.000 grupos | 8,446 | 38,663 | 0,22× |
| Lectura de registros | 100 grupos | 1,453 | 2,392 | 0,61× |
| Lectura de registros | 1.000 grupos | 12,027 | 23,992 | 0,50× |
| Registros en ancestros | 100 ancestros | 7,905 | 8,577 | 0,92× |
| Registros en ancestros | 1.000 ancestros | 65,833 | 46,794 | 1,41× |

Ratio = mediana jsdom / mediana rustdom. Los casos nuevos comparan motores
completos, incluyendo migraciones previas; no prueban que toda la ventaja sea
causada por este driver. No existe un baseline pareado anterior de estos casos.
La entrega de slots conserva un costo de 1,8–2,2 veces y la creación/recolección
común de 3,2–4,6 veces. Las ráfagas miden mutaciones/queueing y excluyen entrega,
por lo que sus ratios no sustituyen los de callbacks. Se deben optimizar los
cruces y efectos pendientes sin devolver el control de entrega a JavaScript.
