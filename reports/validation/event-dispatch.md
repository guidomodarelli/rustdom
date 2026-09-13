# Recorrido y visibilidad nativos del despacho de eventos

Sobre el estado escalar de `ec7485eb45e21294190c1c60db0c084f3b6b1ffa`, EventPath
decide en Rust el recorrido de captura/burbujeo, los overrides de target y la
visibilidad de composedPath. prepareDispatch preserva el orden de errores y
cambia isTrusted solo después de aceptar el evento. El dispatcher sigue usando
los callbacks y referencias reales del host, fuera de préstamos Rust.

La construcción de padres y targets del path, el registro/snapshot de listeners,
los globals de Window y la activación específica de elementos conservan código
JavaScript. Esta etapa no declara completo EventTarget ni el objetivo integral.

## Referencia e integración

Se agregaron 16 contratos públicos: ocho combinaciones de visibilidad de raíces
y composed para slots anidados, y cuatro casos por motor para modificaciones
de listeners/reentrancia/AbortSignal, paths tras adopción, restauración de
window.event después de errores y rollback de activación de checkbox.

El [baseline inicial](event-dispatch/baseline.log) pasó. El arnés se reforzó para
comprobar los errores de listeners fuera de dispatch: el DOM normalmente captura
esas excepciones, lo que podría ocultar una aserción fallida. EventTarget sin
Window registra observaciones y resultados que se verifican después del despacho.
El [baseline con ese control](event-dispatch/baseline-errors-checked.log) también
pasó los 16 tests. No se usan mocks de jsdom, Rust ni APIs de plataforma.

La [integración inicial](event-dispatch/native-integration.log) pasó 38 tests
focales. Los [contratos adicionales de fallo parcial](event-dispatch/partial-and-memory.log)
pasaron 29 tests: VirtualConsole lanza desde su reporter real, sin mocks, y el
evento conserva phase, currentTarget, path, flag pasivo y rechazo de redispatch
como la referencia. No se agrega un finally que borre ese estado observable.

La [integración compacta](event-dispatch/compact-integration.log) pasó 41 tests,
incluida equivalencia entre las dos APIs de avance. Ocho tests Rust cubren
transiciones, prioridad de guards, orden, visibilidad y liberación de buffers.
La validación general y los controles instalados del estado compacto final
también pasaron, como se detalla al final de este reporte.

## Decisiones y memoria

Cada entrada Rust guarda flags de raíz/slot cerrado y el índice del target más
cercano, calculado al append. No guarda objetos V8 ni presupone que el target sea
un Node. Esto elimina indexOf(struct) y la búsqueda hacia atrás repetida en cada
invocación. Aun con propagación detenida, se conservan los pasos que actualizan
phase, target y relatedTarget; solo se omite la llamada de listeners.

visiblePathIndices devuelve índices en orden y un sentinel para currentTarget,
incluido su valor null antes de invocar. El prefijo se construye en reversa y
se invierte una vez; no hay unshift repetido. Los arrays entregados al usuario
son independientes. El cursor permanece en el último currentTarget cuando se
omite una invocación por propagación detenida.

nextInvocation mantiene la API descriptiva con objetos independientes. El runtime
usa advanceInvocation para recibir índice y flags como un número, sin asignar un
objeto JavaScript por paso. appendPath devuelve el índice de override que se
asocia a la entrada de owners del host. EventInvocationEncoding comparte el
contrato de codificación entre ambos lados del binding.

Al finalizar normalmente, finishDispatch libera toda la capacidad del Vec.
El [GC con paths profundos y fallos parciales](../memory/2026-09-13T15-55-15.892Z-event-state.json)
alterna tres despachos normales y dos interrumpidos. Retener el estado nativo,
incluso con metadatos del path todavía presentes, permite recolectar Event,
target, Document y Window; vaciarlo libera su buffer y soltarlo devuelve los
contadores al baseline. Se preservan los cinco ciclos y sus observaciones.

El [Memcheck nativo](../memory/2026-09-13T16-01-03.604Z-event-dispatch-valgrind.log)
ejerció los ocho tests de Event/EventPath: cero errores, cero bytes definitivamente
perdidos y cero indirectamente perdidos, sin supresiones. Los 48 bytes posiblemente
perdidos y 544 alcanzables de std/libtest permanecen visibles. El hash del
ejecutable y el log de tests se guardan junto al reporte; este control no ejecuta V8.

## Rendimiento en evaluación

La [primera corrida con pasos descriptivos](../benchmarks/2026-09-13T15-50-26.273Z-linux-x64.json)
registró 9,963 ms para 1.000 despachos frente a 2,960 ms en jsdom (0,30×).
Esa versión todavía creaba un objeto JS por paso. El cambio a códigos numéricos
se mide por separado; no se presenta la caída desde 10,750 ms de la etapa previa
como prueba causal, dado que son corridas distintas y también cambió el tiempo
de jsdom. Se conservan todas las muestras y las regresiones.

La [corrida con códigos numéricos](../benchmarks/2026-09-13T15-57-53.536Z-linux-x64.json)
conserva 18 muestras por motor/operación en dos procesos, con tres warmups por
proceso y orden alternado. No hubo otros runners locales activos.

| Operación | Tamaño | jsdom ms | rustdom ms | Ratio |
|---|---:|---:|---:|---:|
| construct-native-eligible | 25 | 10,022 | 9,965 | 1,01× |
| construct-native-eligible | 250 | 26,999 | 39,557 | 0,68× |
| construct-native-eligible | 1000 | 66,046 | 117,010 | 0,56× |
| shadow-retarget-events-100 | 10 | 12,875 | 15,064 | 0,85× |
| shadow-retarget-events-100 | 30 | 160,763 | 37,559 | 4,28× |
| slot-events-100 | 25 | 1,554 | 4,334 | 0,36× |
| slot-events-100 | 100 | 1,365 | 3,732 | 0,37× |
| observer-delivery-slots | 100 | 0,502 | 1,621 | 0,31× |
| observer-delivery-slots | 1000 | 4,085 | 14,999 | 0,27× |
| event-state-lifecycle | 100 | 0,434 | 0,940 | 0,46× |
| event-dispatch | 100 | 0,500 | 1,169 | 0,43× |
| event-state-lifecycle | 1000 | 3,001 | 7,363 | 0,41× |
| event-dispatch | 1000 | 2,959 | 8,840 | 0,33× |

El resultado de dispatch bajó respecto de los 9,963 ms de la corrida descriptiva,
con una referencia casi igual; son corridas separadas, no un experimento causal
aislado. Rustdom continúa más lento en el camino común. Quedan construcción del
path, listeners, WebIDL y otros cruces cuyo costo debe seguir midiéndose mientras
se migra el resto del motor. No se afirma aceleración universal de suites.

## Validación final del hito

La [validación general](event-dispatch/validation.json) aprobó formato, Clippy,
199 tests Rust, 603 contratos Node, 7 tests Jest, 18 Vitest y 26 Vitest VM.
HTML5 mantuvo sus 1.784 casos comparables y ocho casos de scripting excluidos.
El [WPT ejecutable](../compatibility/2026-09-13T16-07-23.246Z-linux-wpt.json)
mantiene 43.708 resultados en paridad: 42.678 aprobados por el estándar y 1.030
fallos compartidos. Range-deleteContents sigue bloqueado por el bootstrap de
jsdom; este resultado no acredita un corpus completo ni conformidad total.

El paquete con SHA-256
`c0b90ab5f5a03c146201911f2c32faa9d624fab560b51787a4d9e5dda1e78418`
pasó 18 controles instalados en [Node 24](../distribution/2026-09-13T16-04-13.724Z-linux-x64.json)
y 18 en [Node 22](../distribution/2026-09-13T16-06-46.572Z-linux-x64.json):
npm/pnpm, TypeScript, CJS, ESM/VM, Unicode, workers y runners reales.

El [control general de memoria](../memory/2026-09-13T16-04-11.331Z-linux-x64.json)
aprobó jsdom, rustdom, native, vitest y vitest-vm. Rustdom liberó los 1.322
documentos y 882 ventanas observados; los dos modos Vitest liberaron 1.320
documentos y 880 ventanas cada uno. Los contadores nativos volvieron al baseline.
Se conservan deltas RSS de 21,47 MiB para rustdom, 26,16 MiB para vitest y
23,41 MiB para vitest-vm; la liberación de roots no obliga al allocator a devolver
toda la memoria al sistema ni prueba ausencia absoluta de fugas.

Paquete, benchmark compacto y memoria general registran el mismo binario nativo:
`c804f832139a19a200402cab7e5f32dcd984d979d441b12ee64c75c656a12177`.
