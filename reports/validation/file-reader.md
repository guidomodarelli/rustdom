# FileReader: control y decodificación nativos

Rust conserva los estados EMPTY/LOADING/DONE y el flag de cancelación compartido.
Ese flag se consume por el primer stage que lo encuentra, sin introducir tokens
por lectura que cambiarían las reentradas de jsdom. La creación de una lectura no
borra el resultado anterior. Abortar limpia el resultado y preserva la secuencia
de eventos de la referencia, incluso cuando callbacks inician otra lectura.

La resolución de etiquetas y decodificación no fatal usan encoding_rs 0.8.41.
Se conserva la prioridad del BOM y el tratamiento de @exodus/bytes de un lead
surrogate UTF16 seguido de un byte incompleto: produce una sola sustitución.
El resultado binario conserva cada byte como code unit; base64 usa la biblioteca
Rust fijada en Cargo.lock. Los argumentos y resultados JS permanecen en el host
para que sus referencias sean visibles a V8.

La lectura nativa de bytes reutiliza la comprobación de backing de Blob. El
callback Rust no puede ejecutar JavaScript ni devolver referencias a la memoria
prestada. Shared/detached/otro backing solicita el manejo de plataforma existente.
El host conserva las dos tareas setImmediate, emisión de ProgressEvent, parser
MIME y ArrayBuffer del realm. No se presenta este bloque como todos los drivers
o todas las APIs de plataforma ya migrados.

## Evidencia focal

[Baseline](file-reader/baseline.log) e [integración](file-reader/integration.log)
pasaron 58 contratos públicos en realms normal/VM. Cubren los cuatro formatos,
resultados anteriores, estados, errores, abortos en cada evento y nuevas lecturas
desde abort/loadstart/progress/load/loadend.

La [comparación de codecs](../compatibility/2026-09-15T04-32-48.919Z-file-reader-codecs.json)
ejecutó 21.216 comparaciones en 268 etiquetas/alias, con cero diferencias. Incluye
todos los bytes individuales, entradas malformadas, BOM y un corpus reproducible
de secuencias cortas; no se interpreta como prueba de todas las entradas posibles.
Tres tests Rust y Clippy pasaron.

El [WPT inicial](../compatibility/2026-09-15T04-41-53.720Z-linux-wpt.json) conserva
45 resultados en paridad: 34 aprobados por el estándar y 11 fallos compartidos.
Los archivos son originales y el contexto ejecutado es Window.

## Memoria

El [control focal](../memory/2026-09-15T04-38-08.882Z-file-reader.json) pasó 20
escenarios: ambos motores, realms normal/VM y lecturas completas, abortadas o
cerradas mientras están pendientes. Se observan reader, Blob, Document, Window
y resultado por separado. Se registra la etapa que conserva un resultado de
otro realm sin asumir que no pueda conservar su contexto. Al soltarlo todo,
los recursos observados y los contadores nativos vuelven al baseline.

La validación focal final, con etiquetas también resueltas en Rust, pasó los
[100 tests](file-reader/contracts-final.log), el [corpus de codecs](../compatibility/2026-09-15T04-46-36.788Z-file-reader-codecs.json),
los [20 escenarios de memoria](../memory/2026-09-15T04-47-34.661Z-file-reader.json)
y [WPT](../compatibility/2026-09-15T04-48-07.137Z-linux-wpt.json).
Memcheck del ejecutable Rust completo también pasó los 241 tests en ocho lotes;
los resultados se detallan a continuación. La validación local del hito está
completa; los checks y la revisión remotos siguen su proceso antes del merge.

El helper adicional `tests/helpers/file-reader-codec-memory.cjs` ejecuta 100
ciclos con GC, offsets de vistas, backing compartido/desprendido, resultados
independientes y estados de lectura/aborto. Creó y liberó los 100 estados;
el contador vivo volvió a cero. Los controles [Node con addon cargado](../memory/2026-09-15T05-02-30.000Z-file-reader-control-filtered-valgrind.log)
y [conversiones nativas](../memory/2026-09-15T05-02-30.000Z-file-reader-native-filtered-valgrind.log)
registraron cero errores y cero bytes perdidos definitivos o indirectos.
Se usaron únicamente las dos supresiones CppGC documentadas para Node;
los resultados no afirman ausencia absoluta de fugas ni incluyen todas las
secuencias posibles de lectura.

El control nativo se amplió a [1.000 ciclos](../memory/2026-09-15T05-04-47.000Z-file-reader-native-growth-output.log):
los 1.000 estados se liberaron y el [Memcheck completo](../memory/2026-09-15T05-04-47.000Z-file-reader-native-growth-valgrind.log)
conservó cero errores/fugas definitivas/indirectas. La memoria clasificada como
posiblemente perdida fue idéntica entre 100 y 1.000 ciclos nativos: 45.226 bytes,
frente a 45.110 bytes del control con el addon cargado. Los 12.956 bytes aún
alcanzables también permanecieron constantes. Ese remanente no se oculta ni
se interpreta como una garantía de ausencia absoluta de fugas.

## Revalidación del corpus general

La ejecución general aprobó 241 pruebas Rust, 1.797 contratos Node, 15 Jest,
26 Vitest, 26 Vitest VM y el corpus HTML5. El WPT general detectó una diferencia
en el mensaje de un fallo compartido de Blob: el `new Date()` usado como input
inválido se formateó a segundos distintos. El [run original](../compatibility/2026-09-15T05-02-56.562Z-linux-wpt.json)
y el [estado de validación inicial](file-reader/validation-initial.json) conservan
ese fallo. El comparador ahora canoniza únicamente esa descripción temporal,
para ese archivo/test y estado fallido, sin modificar los errores obtenidos o
esperados. Tres regresiones verifican que errores, estados y otras diferencias
siguen rechazándose. Se conserva el mensaje crudo en todos los reportes.
La [repetición completa de WPT](../compatibility/2026-09-15T05-09-58.601Z-linux-wpt.json)
pasó. El [registro compuesto](file-reader/validation.json) conserva la validación
original y la repetición, sin reescribir el fallo inicial como un éxito.

El [Memcheck del ejecutable Rust](../memory/2026-09-15T05-26-11.882Z-valgrind.json)
pasó los 241 tests sin errores ni fugas definitivas/indirectas, conservando todos
los casos en ocho lotes. Los 48 bytes posiblemente perdidos y 544 alcanzables
del runtime de tests permanecen visibles; no se aplicaron supresiones.

Los [cinco modos del control general de memoria](../memory/2026-09-15T05-14-07.743Z-linux-x64.json)
pasaron: jsdom, rustdom, addon, Vitest y Vitest VM. No quedaron documentos ni
ventanas observados vivos al final. Rustdom registró 1,97 MiB de diferencia de
heap y 17,57 MiB de RSS; jsdom 2,74/2,80 MiB, Vitest 4,09/26,21 MiB y Vitest VM
3,72/43,52 MiB. Son mediciones de retención del proceso tras GC y warmup con
los límites del reporte; no son memoria pico ni una prueba universal de fugas.

## Distribución

El mismo archivo `786930b96e49f4e7d16da715afc3c012fdffd92049eb9eb79ef23735734bc30a`
pasó los 18 controles en [Node 24.14.1](../distribution/2026-09-15T05-15-29.918Z-linux-x64.json)
y los 18 en [Node 22.12.0](../distribution/2026-09-15T05-17-58.520Z-linux-x64.json).
Incluyen instalación npm/pnpm, tipos estrictos, CJS, ESM/VM, Unicode, workers,
Jest, Vitest y Vitest VM. Los consumers usan el addon real y verifican estados
de lectura, BOM y resolución nativa de etiquetas mediante exports CJS/ESM.

## Rendimiento

Los [resultados y muestras crudas](../benchmarks/2026-09-15T05-26-04.858Z-linux-x64.json)
y la [tabla completa](../benchmarks/2026-09-15T05-26-04.858Z-linux-x64.md) conservan
las 12 combinaciones de operación/tamaño. La columna genérica `Filas` representa
KiB de entrada en estas cargas. Se preparan Blob/reader antes del cronómetro;
se miden registro de handlers, solicitud y finalización real por `loadend`.
La comprobación completa de contenido, realm, estado, uso nativo y cleanup
ocurre fuera del intervalo. Hay cuatro procesos, orden alternado, tres muestras
de warmup y nueve medidas por proceso: 18 medidas por motor y combinación.

| Operación (1.000 KiB) | jsdom, ms | rustdom, ms | jsdom/rustdom |
|---|---:|---:|---:|
| Texto UTF8 | 1,024 | 2,241 | 0,46× |
| Texto Shift_JIS | 7,150 | 2,896 | 2,47× |
| String binario | 0,925 | 1,543 | 0,60× |
| DataURL | 0,588 | 4,228 | 0,14× |
| ArrayBuffer | 0,553 | 0,813 | 0,68× |
| Aborto | 0,264 | 0,518 | 0,51× |

Shift_JIS también mejora 5,04× en 100 KiB. El resto conserva regresiones y no
cumple todavía el objetivo de alto rendimiento. ArrayBuffer mide estado nativo
y copia del host; abort mide control nativo con eventos del host; las tres
conversiones de strings ordinarios usan Rust. El siguiente trabajo de rendimiento
priorizará las copias/conversiones de salida, especialmente DataURL y UTF8,
manteniendo este baseline. Los 15 tests del arnés también pasaron.
