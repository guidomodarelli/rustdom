# Registro y selección nativos de listeners

ListenerRegistry mantiene identidad de registros, tipos UTF-16, orden, opciones,
membresía, eliminación y selección por fase en Rust. El host conserva callbacks,
señales y snapshots completos de referencias visibles a V8. El registro se crea
solo cuando un target acepta su primer listener; crear nodos sin listeners no
crea registros nativos.

Se reutiliza CompactMap para liberar capacidad de mapas dispersos; BTreeSet
preserva el orden de IDs sin tombstones de registros retirados. Los IDs no se
reutilizan, de modo que remover/reagregar un callback no lo vuelve a introducir
en un snapshot previo. Los IDs de callback del host se olvidan cuando dejan de
tener registros activos; las claves objeto son débiles y las claves primitivas
permiten conservar callbacks internos de jsdom con objectReference undefined.

## Contratos de referencia

El [baseline de 14 contratos](event-listeners/baseline.log) compara los dos
motores sin mocks: duplicados/capture/primeras opciones, remove/readd dentro de
un snapshot, close durante dispatch en Window y Document, callbacks objeto de
otro realm, nombres UTF-16 y reservados, defaults pasivos y consumidores reales.
Un servidor HTTP local verifica el preflight de XHR; un iframe real verifica el
momento de load. Ambos dependen del historial de buckets aun después de retirar
el último listener. Rust conserva ese historial con un booleano y libera los
nombres vacíos, en vez de conservar un mapa de tipos retirados.

Window y WebSocket reemplazan la identidad de almacenamiento al cerrarse. Los
despachos que ya capturaron el almacenamiento anterior conservan sus listeners,
como la referencia. La lógica original de opciones, callbacks, AbortSignal,
Window globals y reporte de errores sigue ejecutándose en el host; esta etapa
no declara íntegramente nativo EventTarget ni el resto del motor.

## Integración y memoria

La [integración inicial](event-listeners/native-integration.log) pasó 34 tests.
Los [contratos con memoria](event-listeners/contracts-and-memory.log) pasaron 37,
incluidos API raw, rechazo atómico de entradas inválidas, receptores ajenos y
asignación perezosa. Cuatro tests Rust cubren identidad, opciones, IDs frescos,
agotamiento de IDs y compactación con un registro persistente.

El [control inicial de memoria](../memory/2026-09-13T16-38-10.587Z-event-listeners.json)
retiene el registro nativo y observa que callbacks, señales, target, Document y
Window se recolectan en cinco ciclos. También registra/remueve 500 callbacks
simultáneos con tipos únicos y con un tipo compartido mientras otro listener
permanece activo. Se liberan los callbacks retirados y las capacidades nativas
quedan acotadas; soltar el registro devuelve contadores al baseline.

## Análisis nativo y memoria general

El [Memcheck del registro](../memory/2026-09-13T17-02-16.312Z-event-listeners-valgrind.log)
ejerció sus cuatro tests Rust, incluido el burst de tipos/callbacks: cero errores,
cero bytes definitivamente perdidos y cero indirectamente perdidos, sin
supresiones. Los 48 bytes posiblemente perdidos y 544 alcanzables de std/libtest
permanecen visibles. Se conserva el hash del ejecutable junto al log de tests.

El [control general](../memory/2026-09-13T17-05-14.281Z-linux-x64.json) aprobó
jsdom, rustdom, native, vitest y vitest-vm. Rustdom liberó los 1.322 documentos y
882 ventanas observados; cada modo Vitest liberó 1.320 documentos y 880 ventanas.
Los contadores nativos volvieron al baseline. Deltas RSS: rustdom 19,35 MiB,
vitest 26,10 MiB y vitest-vm 26,29 MiB. Estos controles finitos distinguen
liberación de objetos de memoria retenida por el allocator; no prueban ausencia
absoluta de fugas.

## Rendimiento

La [primera corrida](../benchmarks/2026-09-13T16-44-09.418Z-linux-x64.json) registró
1,194 ms para agregar 1.000 listeners frente a 8,660 ms en jsdom (7,25×).
La eliminación quedó en 1,488 ms frente a 0,721 ms y 20 despachos a 1.000
listeners en 32,385 ms frente a 10,089 ms. Se conservan todas las muestras y
regresiones; no se presenta esa ventaja de registro como aceleración general.

La versión siguiente agrupa la selección por fase en Rust para evitar cruces
por listeners que serán omitidos, manteniendo todos los owners del snapshot.
La [integración por fases](event-listeners/phase-selection.log) pasó los 37 tests
y el [nuevo GC](../memory/2026-09-13T16-52-59.817Z-event-listeners.json) completó
los cinco ciclos y las dos ráfagas. La validación general del hito también pasó.

La [corrida por fases](../benchmarks/2026-09-13T16-58-30.766Z-linux-x64.json)
conserva 18 muestras por motor/operación, en dos procesos por motor con tres
warmups y orden alternado, sin otros runners locales activos.

| Operación | Tamaño | jsdom ms | rustdom ms | Ratio |
|---|---:|---:|---:|---:|
| construct-native-eligible | 25 | 9,611 | 10,251 | 0,94× |
| construct-native-eligible | 250 | 25,639 | 39,437 | 0,65× |
| construct-native-eligible | 1000 | 65,948 | 114,325 | 0,58× |
| slot-events-100 | 25 | 1,508 | 4,619 | 0,33× |
| slot-events-100 | 100 | 1,354 | 4,220 | 0,32× |
| event-dispatch | 100 | 0,483 | 1,410 | 0,34× |
| event-dispatch | 1000 | 2,940 | 11,749 | 0,25× |
| listener-register | 100 | 0,267 | 0,165 | 1,62× |
| listener-remove | 100 | 0,081 | 0,187 | 0,43× |
| listener-dispatch | 100 | 1,254 | 3,824 | 0,33× |
| listener-register | 1000 | 8,665 | 1,122 | 7,73× |
| listener-remove | 1000 | 0,747 | 1,398 | 0,53× |
| listener-dispatch | 1000 | 9,678 | 27,983 | 0,35× |

El ratio es mediana jsdom / mediana rustdom; solo valores mayores que uno
favorecen a rustdom. La ventaja al registrar no compensa todos los caminos:
remover, despachar y construir documentos siguen siendo más lentos en estas
cargas. El despacho simple empeoró respecto de la corrida inicial; no se oculta
ni se atribuyen cambios entre corridas separadas a una causa aislada. La
migración de callbacks y otras partes pendientes debe seguir midiendo el costo
completo, sin presentar este hito como cumplimiento del objetivo de rendimiento.

## Validación final

La [validación completa](event-listeners/validation.json) aprobó formato, Clippy,
203 tests Rust, 620 contratos Node, 7 tests Jest, 18 Vitest y 26 Vitest VM.
HTML5 mantuvo 1.784 casos comparables aprobados y ocho casos de scripting
excluidos. El [WPT ejecutable](../compatibility/2026-09-13T17-07-20.086Z-linux-wpt.json)
mantiene 43.708 resultados en paridad: 42.678 aprobados por el estándar y 1.030
fallos compartidos. Range-deleteContents sigue bloqueado durante el bootstrap
de jsdom; no se presenta el corpus como completo ni la paridad como conformidad
total con estándares.

El artefacto con SHA-256
`2ace913e62194763b9c5504dc072fd5a0614762d52af206137655f79e2f82f4f`
aprobó 18 controles en [Node 24](../distribution/2026-09-13T17-05-05.706Z-linux-x64.json)
y 18 en [Node 22](../distribution/2026-09-13T17-07-10.468Z-linux-x64.json),
incluidos npm/pnpm, TypeScript, CJS, ESM/VM, Unicode, workers y runners reales.

Paquete, benchmark por fases y memoria general registran el mismo binario:
`c394ade9b7700b8713e1e9fb4c3d25b962e066e74a50450c0777862187ccd72f`.
