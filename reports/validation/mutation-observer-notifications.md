# Lote activo y coalescing nativos de MutationObserver

Rust conserva los IDs de observadores activos y el flag de microtask pendiente.
Un enqueue correcto activa al observador sin un cruce adicional para esa
activación. El pedido de microtask conserva su punto original después de
encolar registros; JavaScript invoca Promise solamente cuando Rust indica que
hay que programar un job.

beginMutationObserverNotification retira el lote, lo ordena por ID de creación
y reinicia el flag antes de callbacks. El bridge mueve sus owners fuertes a
la lista de entrega y utiliza un mapa nuevo para activaciones posteriores.
takeRecords y disconnect no borran la pertenencia al lote ni reinician el flag;
finalizar un observer elimina su ID sin cancelar un job ya programado.

Los registros siguen vaciándose por observador al llegar a su callback, y las
señales de slots se retiran antes de esos callbacks. La invocación concreta,
la conversión de argumentos y el reporte de errores aún usan el helper JS.
Esta etapa no completa eventos ni la migración integral.

## Contratos

El [baseline](mutation-observer-notifications/baseline.log) conserva ocho tests
públicos aprobados en ambos motores antes de migrar. Usan Promise real para
comprobar posición del job, coalescing después de takeRecords/disconnect,
ausencia de jobs extra observables en reentrancia, orden de creación y
observadores activados durante callbacks que entran en el siguiente lote.

El contrato raw verifica orden y snapshots nativos, flag pendiente después de
vaciar/desconectar/finalizar y errores sin activar IDs inválidos. Dos tests Rust
cubren deduplicación, lotes reentrantes y recuperación de capacidad tras 2.048
activaciones/finalizaciones. Los once tests nativos de observadores y los 34
contratos focales de notificaciones, colas, registro y señales aprobaron.

La suite Rust completa aprobó 183 tests y Clippy. Memcheck aprobó los once
tests de observadores sin errores ni pérdidas definitivas o indirectas. El
[log completo](../memory/2026-09-13T12-00-55.162Z-observer-notifications-valgrind.log)
conserva 48 bytes posibles y 544 alcanzables de std/libtest, sin supresiones,
junto con la salida de tests y el hash del ejecutable.

## Memoria y rendimiento

El estado Rust contiene solo números y un booleano. Los owners del bridge
mantienen vivos a los observers pendientes y a los del lote actual; los mapas
anteriores dejan de ser globales al comenzar la notificación. Los endpoints
de memoria también exigen pendingObservers y microtaskQueued en su baseline.

El [estrés de cinco modos](../memory/2026-09-13T12-03-33.160Z-linux-x64.json)
aprobó jsdom, rustdom, native, Vitest y Vitest VM. Rustdom liberó los 1.322
documentos y 882 ventanas observados; ambos modos Vitest liberaron 1.320
documentos y 880 ventanas. Heap/RSS retenido: 2,77/22,10 MiB rustdom,
4,03/22,16 MiB Vitest y 3,67/26,30 MiB VM, después de warmup y GC. El lote y
el flag regresaron al baseline. Son pruebas finitas, no memoria pico ni una
garantía absoluta de ausencia de fugas.

El paquete
`ca4e30b9e7a41ddcb149d6c5bbd3838b6944c0f495b7d82452da9669cde0b532`
aprobó 18 controles en [Node 24.14.1](../distribution/2026-09-13T12-03-21.505Z-linux-x64.json)
y 18 en [Node 22.12.0](../distribution/2026-09-13T12-05-46.410Z-linux-x64.json).
Los consumidores npm/pnpm comprueban coalescing, lote pendiente tras vaciado y
desconexión, orden del lote, reset nativo y estadísticas del runtime VM, además
de tipos, assets y runners reales.

La validación integral aprobó 183 tests Rust, 558 Node, 7 Jest, 18 Vitest y 26 VM,
además de 1.784 casos HTML5 comparables. El
[WPT](../compatibility/2026-09-13T12-06-40.113Z-linux-wpt.json) conserva 43.708 casos
en paridad, 42.678 aprobados por estándar y 1.030 fallos compartidos. Las
exclusiones y el bootstrap de Range-deleteContents bloqueado siguen explícitos;
no se presenta esa evidencia como compatibilidad integral.

La decisión de programar agrega un cruce N-API en cada pedido. Se debe medir
el camino completo; mover el flag a Rust no acredita por sí solo una mejora.
La [comparación aislada](../benchmarks/2026-09-13T12-12-16.828Z-linux-x64.json)
conserva 18 muestras por motor/caso, órdenes alternados, resultados verificados
y hashes completos fuera del timer.

| Operación | Tamaño | jsdom ms | rustdom ms | Ratio |
|---|---:|---:|---:|---:|
| Ráfaga de señales | 100 slots | 6,816 | 5,187 | 1,31× |
| Ráfaga de señales | 1.000 slots | 330,410 | 226,329 | 1,46× |
| Mutaciones y recolección | 100 grupos | 1,559 | 4,370 | 0,36× |
| Lectura de registros | 100 grupos | 1,470 | 2,486 | 0,59× |
| Mutaciones y recolección | 1.000 grupos | 8,772 | 38,095 | 0,23× |
| Lectura de registros | 1.000 grupos | 11,960 | 23,758 | 0,50× |
| Registros en ancestros | 100 ancestros | 8,390 | 8,756 | 0,96× |
| Registros en ancestros | 1.000 ancestros | 66,917 | 47,576 | 1,41× |

Ratio = mediana jsdom / mediana rustdom. Se conservan ventajas en ráfagas y
ancestros profundos, pero la creación/recolección común cuesta 2,8–4,3 veces y
la lectura 1,7–2,0 veces. El caso de 100 ancestros queda cerca de paridad. Los
reportes anteriores siguen disponibles; no se atribuyen cambios entre corridas
a una causa única ni se presenta esta migración como una aceleración universal.
