# Blob y File: algoritmos nativos e interoperabilidad de buffers

Rust conserva MIME, nombre y lastModified en un objeto sin referencias JavaScript.
Normaliza finales de línea con la conducta Unix de jsdom y calcula los límites de
slice. Los buffers ordinarios se concatenan mediante copias Rust a una asignación
independiente que se transfiere a un Buffer de Node mediante N-API. Los Buffer y
sus vistas permanecen visibles al GC de V8; ningún metadato Rust mantiene una
referencia N-API persistente al Buffer, Blob o Window.

La preparación de partes usa los predicates y vistas de Node de la referencia,
conservando getters públicos y el momento de sus efectos. Antes de tomar punteros
se obtienen todos los valores de entrada. El camino de copia excluye backing
compartido o desprendido y no ejecuta callbacks JavaScript mientras lee memoria.
Esos casos usan Buffer.concat de Node para mantener seguridad y errores de la
plataforma. La asignación es fallible y los arrays dispersos inválidos no causan
una reserva basada en su longitud declarada.

slice conserva Buffer.slice y su backing compartido. FormData puede reasignar la
misma referencia de Buffer al cambiar filenames, y FileReader/XHR/multipart
continúan usando el campo de interop existente. WebIDL, factories, reloj y
conversión a vistas permanecen en el host; no se presenta este hito como toda la
plataforma ya migrada. Los contadores de bytes copiados son acumulativos y no
representan memoria viva de los buffers.

## Contratos ejecutados

[Baseline](blob-file/baseline.log) e [integración](blob-file/integration.log)
pasaron 33 contratos públicos Blob/File en realms normal/VM: bytes mixtos, vistas,
Unicode, finales de línea, tipos, slices, FileReader, FormData, errores y getters
que modifican o desprenden buffers anteriores. Se preservan name y lastModified.

[Seis contratos N-API](blob-file/native-contracts.log) pasaron, incluidos backing
compartido/desprendido, input disperso enorme, mutaciones durante getters y throws
primitivos. La [regresión conjunta con XML](blob-file/contracts.log) pasó 222
casos después de centralizar la captura de excepciones sin coerción. Tres tests
Rust y Clippy pasaron; los exports N-API no registrados en tests Rust tienen una
excepción de dead_code limitada a ese build, con los contratos reales separados.

Los [WPT originales](../compatibility/2026-09-15T02-56-03.555Z-linux-wpt.json)
mantuvieron 339 resultados en paridad: 225 aprobados por el estándar y 114 fallos
compartidos. Muchos no alcanzan sus aserciones de contenido porque jsdom carece
de Blob.text()/arrayBuffer(); otros reflejan diferencias de realm del constructor.
No se modifican los tests ni se llaman aprobadas esas lecturas. La lectura real
de bytes se verifica por FileReader en los contratos diferenciales adicionales.

## Memoria disponible

El [control focal](../memory/2026-09-15T02-50-53.973Z-blob-file.json) pasó con
vistas que mantienen bytes después de liberar los Blob/File originales y con
buffers que sobreviven a sus wrappers/Window. También se liberan ciclos JS
Buffer→Blob→Buffer. Los metadatos nativos vuelven al baseline. Son escenarios
finitos y no prueban ausencia absoluta de fugas.

El [estrés directo de bytes](blob-file/byte-gc.log) pasó 100 ciclos con GC forzado,
incluido un getter que elimina la referencia previa antes de recolectar. El
control Node bajo Valgrind produjo avisos de lectura de pila conservadora de
cppgc incluso sin cargar el addon; se conserva el log sin filtrar y se está
comparando con el caso nativo.

## Fuga de referencias de constructores y corrección

La ejecución [nativa sin filtrar](../memory/2026-09-15T03-02-51.000Z-blob-bytes-native-unfiltered-valgrind.log)
detectó 760 bytes definitivamente perdidos en 19 referencias creadas por
napi_create_reference durante el registro de clases. La dependencia guardaba
los handles sin eliminarlos al cerrar el env. Se incorporó una copia de napi
3.12.3 verificada contra su archivo original, con un cleanup por registro que
elimina únicamente sus referencias y conserva los registros posteriores.

El [audit de procedencia](blob-file/napi-vendor-audit.json) verifica 86 archivos
originales y solo dos modificaciones: registro de clases y metadata de Cargo.
El [parche exacto](../../third-party/napi/class-reference-cleanup.patch), su
explicación y licencia se conservan junto al código; el empaquetado incluye el
aviso y el diff. Los contadores detectan fallos de limpieza.

La [prueba de workers](blob-file/napi-reload-workers.log) pasó ocho cierres,
incluidas recargas del addon en el mismo env. Las referencias vuelven al baseline
y no hay errores de cleanup. La regresión conjunta Blob/XML pasó 223 contratos.

Valgrind registra los mismos dos contextos de lectura conservadora de pila de
cppgc sin cargar Rustdom. Se aplican únicamente esas dos pilas Memcheck:Cond en
`scripts/valgrind-node-cppgc.supp`; no se suprimen fugas, accesos inválidos ni
errores de valores no inicializados en otras rutas. Los logs originales siguen
disponibles. [Control Node](../memory/2026-09-15T03-23-28.000Z-blob-bytes-control-filtered-valgrind.log)
y [addon corregido](../memory/2026-09-15T03-23-28.000Z-blob-bytes-native-filtered-valgrind.log)
terminaron sin errores ni pérdidas definitivas/indirectas.

La [inicialización del addon sin copias Rust](../memory/2026-09-15T03-26-00.000Z-blob-bytes-addon-control-growth-valgrind.log)
y [1.000 ciclos nativos](../memory/2026-09-15T03-26-00.000Z-blob-bytes-native-growth-valgrind.log)
mantuvieron exactamente 44.042 bytes posiblemente perdidos y 12.956 alcanzables,
sin crecimiento y con cero pérdidas definitivas/indirectas. El control Node sin
addon conserva 304 posiblemente perdidos y 8.214 alcanzables. Esta clasificación
residual se documenta, no se transforma en una garantía absoluta de ausencia de
fugas. El binario observado fue
`81691849e946188039dff0b39ecbe61feac6a297a53e8536082cd2ad83e66864`.

## Validación final y distribución

La [validación general](blob-file/validation.json) pasó 238 tests Rust,
1.697 Node, 14 Jest, 25 Vitest y 26 Vitest VM, además de formato, Clippy y
corpus. El [WPT general](../compatibility/2026-09-15T03-39-10.359Z-linux-wpt.json)
conserva 48.688 resultados en paridad, con 47.504 aprobados por el estándar y
1.184 fallos compartidos. HTML5 mantiene 1.784 comparables y ocho exclusiones;
el bootstrap de Range-deleteContents sigue excluido.

La [memoria focal final](../memory/2026-09-15T03-42-07.738Z-blob-file.json) pasó
y el [estrés general](../memory/2026-09-15T03-43-41.021Z-linux-x64.json) aprobó
los cinco modos. Rustdom liberó 1.762 documentos y 882 ventanas observados; cada
modo Vitest liberó 1.760 documentos y 880 ventanas. Los deltas RSS conservados
son 17,17 MiB, 39,47 MiB y 41,92 MiB para rustdom, Vitest y Vitest VM.
[Memcheck de los algoritmos Rust](../memory/2026-09-15T03-43-45.000Z-blob-file-rust-valgrind.log)
pasó sin errores ni pérdidas definitivas/indirectas, con los 48 bytes posibles
y 544 alcanzables de std/libtest documentados por separado del proceso Node.

El archivo SHA-256
`5fe2658cfd8fd56cecef384ca69bd6b25a6c332620133ecb48ce6306e2c1cb1f`
pasó 18 controles de [Node 24](../distribution/2026-09-15T03-45-21.519Z-linux-x64.json)
y 18 de [Node 22](../distribution/2026-09-15T03-47-58.859Z-linux-x64.json).
Después se añadió el texto MIT de napi, ausente en su archivo crate, desde el
commit upstream indicado por su metadata, y se amplió PATCHES.md con esa
procedencia. El [audit de 715 archivos](blob-file/package-license-audit.json)
verifica que son las únicas diferencias: runtime, tipos, binario y metadata de
paquete conservan exactamente los bytes ya probados. El archivo final tiene SHA
`c8bd6d755a53ec59579abf34bf91f91d49d07be6a2e3e02d99f74f7b2cee241e`.
No se afirma que los 36 controles se repitieron sobre ese último hash.

## Rendimiento

Los [14 tests del arnés](blob-file/benchmark-tests.log) pasaron. El
[benchmark final](../benchmarks/2026-09-15T03-54-06.082Z-linux-x64.md) conserva
[muestras y metadatos](../benchmarks/2026-09-15T03-54-06.082Z-linux-x64.json):
18 muestras por fila, dos procesos por motor y tres warmups por proceso, con
Node 24.14.1, jsdom 27.4.0 e Intel i7-1360P bajo WSL2. Se mide construcción o
slice y consumo del tamaño; FileReader verifica todos los bytes fuera del tiempo.

| Operación | Tamaño | jsdom mediana (ms) | rustdom mediana (ms) | jsdom / rustdom |
|---|---:|---:|---:|---:|
| blob-construct | 100 partes | 5,451 | 5,342 | 1,02× |
| blob-endings | 100 repeticiones | 0,302 | 0,269 | 1,12× |
| blob-nested | 100 partes | 1,586 | 1,675 | 0,95× |
| blob-slice | 100 KiB | 0,262 | 0,578 | 0,45× |
| file-construct | 100 KiB | 0,346 | 0,342 | 1,01× |
| blob-construct | 1.000 partes | 52,068 | 50,654 | 1,03× |
| blob-endings | 1.000 repeticiones | 0,373 | 0,360 | 1,04× |
| blob-nested | 1.000 partes | 13,929 | 12,942 | 1,08× |
| blob-slice | 1.000 KiB | 0,249 | 0,549 | 0,45× |
| file-construct | 1.000 KiB | 0,772 | 0,497 | 1,56× |

Las partes binarias y anidadas tienen 256 bytes. Cada carga de slice crea 100
vistas de 64 bytes. Varias diferencias pequeñas quedan cerca de paridad y no se
presentan como ganancias estadísticamente demostradas. Slice conserva una
regresión de aproximadamente 2,2 veces frente a jsdom.

## Corrección de CI relacionada

El PR64 agotó el presupuesto de un worker al recorrer el plan completo de
benchmarks. El fix abf9166, publicado por separado en ese PR, divide todas sus
189 cargas entre cuatro jobs sin omitir ni duplicar casos. El gate benchmarks
exige el éxito de todas las particiones y conserva el presupuesto por worker.
La variante de este hito incorpora también las cargas Blob/File en el plan
canónico; sus 14 tests del arnés verifican cobertura y ejecución real.
