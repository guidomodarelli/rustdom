# Colas nativas de MutationObserver

La cola por observador vive en Rust. Cada entrada contiene un token monotónico
y comparte el payload inmutable de NativeMutationRecord mediante Arc. No guarda
referencias JavaScript ni una referencia al árbol. El bridge conserva un mapa
de owners V8 por token; el orden y el vaciado se resuelven en Rust.

enqueueMutationRecord valida al observador antes de consumir un token; la
conversión N-API verifica la clase del registro. takeMutationRecords devuelve
tokens en orden y libera las participaciones de la cola. queuedMutationRecord
permite inspeccionar un payload con un wrapper independiente. Reemplazar
opciones o liberar un nodo no descarta registros pendientes; disconnect y
release del observador sí los descartan. Las tablas vacías y buffers grandes
liberan su capacidad.

La notificación conserva el vaciado de cada observador justo antes de invocar
su callback. Las mutaciones de un callback anterior pueden entrar en la cola
de un observador posterior dentro del mismo lote. takeRecords y disconnect
invocados desde callbacks también conservan su comportamiento. El lote activo,
su ordenamiento y la programación del microtask todavía usan el helper JS.

## Contratos y memoria

Los seis contratos públicos pasaron en ambos motores antes de la migración;
su [baseline](mutation-observer-queues/baseline.log) queda guardado. Los tests
raw verifican orden, snapshots UTF-16, inspección, tipos/clases inválidos,
opciones reemplazadas, liberación de nodos y vaciado. El conjunto focal de
registro, colas, records y señales aprobó 32 tests antes del control adicional
de GC; después, colas y records aprobaron 16 tests con ese control incluido.

Cuatro tests Rust nuevos cubren colas independientes, tokens no reutilizados,
payloads compartidos, recuperación de capacidad para 2.048 entradas, rechazo
atómico por agotamiento y limpieza integrada con cambios de registro.

El [control de cinco ciclos](../memory/2026-09-13T11-25-00.623Z-observer-queues.json)
recolecta el wrapper original mientras la cola sigue conservando su payload.
Después inspecciona una copia, libera el target y alterna vaciado explícito con
destrucción del árbol que aún contiene la cola. El snapshot retenido conserva
sus campos sin mantener vivo el árbol. Al soltarlo, los contadores vuelven al
baseline. Los controles generales también exigen queuedRecords y queueObservers
en su baseline.

mutationRecords cuenta wrappers nativos; queuedRecords cuenta entradas que
pueden mantener el payload después de recolectar un wrapper raw. Ambos deben
considerarse al analizar memoria. Estas pruebas finitas no demuestran ausencia
absoluta de fugas.

La suite Rust completa aprobó 181 tests y Clippy. Memcheck aprobó los nueve
tests de registro y colas sin errores ni pérdidas definitivas o indirectas.
El [log](../memory/2026-09-13T11-30-31.332Z-observer-queues-valgrind.log) conserva
48 bytes posibles y 544 alcanzables de std/libtest, sin supresiones, junto con
la salida completa y el hash del ejecutable.

La validación integral aprobó 181 tests Rust, 549 Node, 7 Jest, 18 Vitest y 26 VM,
además de 1.784 casos HTML5 comparables. El
[WPT](../compatibility/2026-09-13T11-35-40.982Z-linux-wpt.json) conserva 43.708 casos
en paridad, 42.678 aprobados por estándar y 1.030 fallos compartidos. Permanecen
las exclusiones y el bootstrap de Range-deleteContents bloqueado; no acreditan
compatibilidad integral.

El [estrés de cinco modos](../memory/2026-09-13T11-40-04.536Z-linux-x64.json)
aprobó jsdom, rustdom, native, Vitest y Vitest VM. Rustdom liberó los 1.322
documentos y 882 ventanas observados; ambos modos Vitest liberaron 1.320
documentos y 880 ventanas. Heap/RSS retenido tras warmup y GC: 2,76/18,82 MiB
en rustdom, 4,04/26,65 MiB en Vitest y 3,67/27,01 MiB en VM. Las colas también
volvieron a sus contadores de baseline. No es una medición de memoria pico.

El paquete
`9fdb2097827cbc1f581f1c48dbc128e44c840249558f94eb5b8973515b3f107b`
aprobó 18 controles en [Node 24.14.1](../distribution/2026-09-13T11-39-50.679Z-linux-x64.json)
y 18 en [Node 22.12.0](../distribution/2026-09-13T11-42-27.772Z-linux-x64.json).
Los consumidores externos npm/pnpm verifican encolado, inspección de payload,
vaciado, estadísticas, uso público en VM, tipos y runners reales.

## Rendimiento

La integración agrega un cruce N-API al encolar un record ya creado. La
compartición evita copiar sus textos y listas, pero no implica por sí sola una
aceleración. La [comparación aislada](../benchmarks/2026-09-13T11-47-16.860Z-linux-x64.json)
conserva 18 muestras por motor/caso, órdenes alternados y validación de todos
los campos, identidades, recuentos y hashes del documento fuera del timer.

| Operación | Tamaño | jsdom ms | rustdom ms | Ratio |
|---|---:|---:|---:|---:|
| Mutaciones y recolección | 100 grupos | 1,501 | 4,178 | 0,36× |
| Lectura de registros | 100 grupos | 1,394 | 2,467 | 0,57× |
| Mutaciones y recolección | 1.000 grupos | 8,500 | 36,960 | 0,23× |
| Lectura de registros | 1.000 grupos | 11,708 | 24,130 | 0,49× |
| Mutaciones con registros en ancestros | 100 ancestros | 8,318 | 8,324 | 1,00× |
| Mutaciones con registros en ancestros | 1.000 ancestros | 66,637 | 45,205 | 1,47× |

Ratio = mediana jsdom / mediana rustdom. El caso profundo conserva ventaja,
pero los casos comunes de creación/recolección cuestan 2,8–4,3 veces y los de
lectura 1,8–2,1 veces. La ejecución anterior de registro nativo medía 33,288 ms
en la recolección grande; esta registra 36,960 ms. Son ejecuciones separadas,
no una medición causal pareada. Se conserva el costo observado y queda pendiente
reducir cruces/transferencias del productor y los bindings sin devolver la cola
o su estado canónico a JavaScript.
