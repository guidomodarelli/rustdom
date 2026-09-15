# FormData: lista y construcción nativas

`form_data.rs` conserva orden, nombres UTF16, valores de texto e identidades
de slots File mediante IndexMap y un índice de nombres. Los nombres duplicados
comparten su almacenamiento. `set` conserva la primera posición y elimina las
demás coincidencias; `delete` conserva el orden restante. Las capacidades se
reducen después de ráfagas y se liberan cuando la lista queda vacía.

`form_data_construct.rs` conduce validación del submitter, recorrido de controles,
filtros, coordenadas, select, checkbox/radio, archivos y dirname. Preserva lecturas
diferidas, coerciones, iteradores y precedencia de excepciones. La creación de File
mantiene realm, metadatos y backing original; las fábricas WebIDL, helpers de
elementos y eventos permanecen como integraciones del host. Los algoritmos
anteriores de FormData se retiran del runtime privado. No se implementan aquí
las capacidades que jsdom aún omite, como formdata event o FACE, ni se presenta
este bloque como la migración completa de todas las APIs HTML/formularios.

El bridge conserva representaciones de valores por ID y referencias File visibles
a V8. Rust sigue guardando el contenido canónico y seleccionando identidades,
orden y mutaciones; las representaciones se actualizan en cada operación DOM.
Los iteradores públicos consultan una sola posición nativa por avance, evitando
reconstruir la lista completa con Array.from. El consumidor XHR conserva una
vista materializada con las reglas de append/reemplazo/reasignación originales.
No se guarda ninguna referencia JS persistente dentro del estado Rust.

## Evidencia ejecutada

- El baseline independiente tiene 24 contratos, guardados en
  `reports/compatibility/2026-09-15T05-19-04.242Z-form-data-baseline.json`.
- Tres tests Rust verifican orden, reemplazos, nombres UTF16, capacidad y
  agotamiento de identidades. Clippy pasó.
- La [integración actual](form-data/projection.log) pasó 42 pruebas: operaciones
  públicas, native activation, vistas/iteradores, FileList vivo, errores primitivos,
  IteratorClose, getters y XHR multipart contra un servidor local.
- Los [transportes](form-data/transports.log) pasaron 20 controles de XHR,
  Request/Response/fetch y realms. Dos casos XHR también están en la tanda anterior.
- Los [WPT originales](../compatibility/2026-09-15T07-16-48.632Z-linux-wpt.json)
  conservaron 79 resultados en paridad: 77 estándar aprobados y 2 fallos compartidos.
  Son 17 fixtures Window; la prueba de click real de test_driver queda excluida
  explícitamente en el manifest y el reporte.
- La [primera medición de GC](../memory/2026-09-15T07-11-04.692Z-form-data.json)
  pasó 26 escenarios: delete/set, iteradores, vistas antiguas, lista nativa retenida
  sin owners JS y 100 constructores parcialmente poblados que fallan por modo.
  Observa FormData, File, Document y Window por separado. La versión con
  representaciones de valores está repitiendo ese control.

La [repetición con representaciones de valores](../memory/2026-09-15T07-30-53.199Z-form-data.json)
también pasó los 26 escenarios. La proyección por ID queda acotada a las entradas
de la instancia y se invalida con sus mutaciones DOM; no es una caché global.
Los accesos de depuración a la clase nativa independiente devuelven el texto
canónico sin utilizar esa proyección del bridge.

## Rendimiento inicial

El [primer benchmark](../benchmarks/2026-09-15T07-23-02.147Z-linux-x64.json) ejecutó
16 combinaciones de operación/tamaño con comprobación completa del contenido.
En 1.000 entradas, rustdom fue 33,4× más rápido en iteración, 6,28× en búsqueda
y aproximadamente 2,1× en set/delete. Append, getAll, File y construcción fueron
más lentos: esos resultados también se conservan. La variante siguiente evita
convertir repetidamente strings ya representados en V8 y elimina recorridos de
preparación File cuando WebIDL ya seleccionó el overload de string.

La [variante con proyecciones](../benchmarks/2026-09-15T07-33-28.825Z-linux-x64.json)
midió 1,176 ms para append de 1.000 entradas frente a 2,161 ms en la primera
variante; getAll bajó de 17,863 a 13,488 ms. Iteración alcanzó 42,3× y búsqueda
7,45× frente a jsdom en esa corrida. Archivos y construcción conservaron
regresiones.

La [variante final con IDs tipados](../benchmarks/2026-09-15T07-43-36.777Z-linux-x64.json)
transfiere las listas de identificadores mediante Float64Array propio, sin
referencias al contenedor. El retorno público sigue siendo el Array requerido;
los buffers de IDs son copias independientes y sus mutaciones no alteran Rust.

| 1.000 entradas | jsdom, ms | rustdom, ms | jsdom/rustdom |
|---|---:|---:|---:|
| Append | 0,485 | 1,189 | 0,41× |
| Get/has | 9,782 | 1,516 | 6,45× |
| GetAll (100 lecturas) | 5,540 | 9,079 | 0,61× |
| Set con duplicados | 27,187 | 11,609 | 2,34× |
| Delete | 8,157 | 3,877 | 2,10× |
| Iteración | 72,770 | 1,892 | 38,47× |
| Copia de File con filename | 1,490 | 8,452 | 0,18× |
| Construcción desde form | 3,319 | 16,344 | 0,20× |

Las medianas y muestras de todas las variantes se conservan. GetAll mejoró
frente al primer estado nativo, pero sigue más lento que jsdom, al igual que
append, archivos y construcción. No se considera resuelto el objetivo global
de rendimiento. Son cuatro procesos con orden alternado, tres warmups y nueve
muestras medidas por proceso, 18 por motor/operación/tamaño; no una predicción
del tiempo total de cualquier suite.

Las nuevas regresiones de iteradores inválidos detectaron diferencias en el
tipo/mensaje de error del constructor. El [fallo inicial](form-data/iterator-errors-before.log)
se conserva; se agregó el control nativo de objetos de iterador/resultado antes
de acceder a sus propiedades. Las assertions no se relajaron.
La [tanda final](form-data/identities.log) pasó 46 pruebas. El
[estrés de GC](form-data/native-gc.log) ejecutó 1.000 ciclos y liberó las
1.100 listas creadas, incluyendo 100 constructores fallidos. No quedaron
FormData, Document ni Window observados vivos; el controlador nativo volvió
a cero operaciones activas.

La [validación general](form-data/validation.json) pasó sus siete gates:
244 tests Rust, 1.848 contratos Node, 16 Jest, 27 Vitest, 26 Vitest VM,
corpus HTML5 y [WPT completo](../compatibility/2026-09-15T07-52-20.786Z-linux-wpt.json).
La [memoria focal final](../memory/2026-09-15T07-55-27.733Z-form-data.json)
también pasó 28 escenarios, incluidos buffers tipados de IDs retenidos mientras
se liberan FormData, Document y Window.

Los [cinco modos generales de memoria](../memory/2026-09-15T07-56-58.486Z-linux-x64.json)
también pasaron, sin documentos ni ventanas observados vivos al final. Rustdom
registró 1,97 MiB de heap y 15,28 MiB de RSS de diferencia tras warmup/GC;
jsdom 2,68/1,95 MiB, Vitest 4,09/25,98 MiB y Vitest VM 3,72/39,93 MiB.
Estas diferencias son retención de proceso, no memoria pico ni ausencia
universal de fugas.

Memcheck completó los 1.000 ciclos del [control jsdom](../memory/2026-09-15T07-56-58.000Z-form-data-control-valgrind.log)
y los 1.000 del [addon real](../memory/2026-09-15T07-56-58.000Z-form-data-native-valgrind.log),
incluyendo 100 fallos deliberados del constructor en cada modo. No registró
errores ni fugas definitivas/indirectas. La ejecución nativa liberó las 1.100
listas creadas y todos los FormData, Document y Window observados. Se usaron
únicamente las dos supresiones CppGC ya documentadas; los remanentes clasificados
como posiblemente perdidos y alcanzables quedan visibles en los logs.

La [comparación nativa de 100 ciclos](../memory/2026-09-15T08-08-41.000Z-form-data-native-100-valgrind.log)
registró exactamente el mismo remanente que 1.000 ciclos: 47.294 bytes posiblemente
perdidos y 18.165 alcanzables, con cero errores/fugas definitivas/indirectas.
El control registró 47.130/18.165 bytes. El [desglose por stack](form-data/valgrind-difference.log)
ubica la diferencia de 164 bytes en el registro de préstamos de N-API (116)
y la inicialización de Thread usada por ErrorRef (48). No hubo crecimiento
entre las dos cantidades de ciclos; no se oculta el remanente ni se presenta
como una prueba absoluta de ausencia de fugas.

El [ejecutable Rust completo bajo Memcheck](../memory/2026-09-15T07-59-29.277Z-valgrind.json)
pasó 244 tests en ocho lotes, con un máximo de 353,62 segundos por lote y sin
errores ni fugas definitivas/indirectas. El archivo de distribución generado
tiene SHA256 `26edcf16408962cce39f0d163508279257e4cd224480725e55d8aa7b66ce1c96`;
pasó los 18 controles de [Node 24.14.1](../distribution/2026-09-15T08-08-37.379Z-linux-x64.json).
El mismo archivo pasó los 18 controles de [Node 22.12.0](../distribution/2026-09-15T08-11-12.654Z-linux-x64.json).
En total son 36 controles de npm/pnpm, tipos, CJS, ESM/VM, Unicode, workers,
Jest, Vitest y Vitest VM. El addon verificado tiene SHA256
`8c1882287fcddd0b665342b7d76512d2b7f0bac36764a59a807e65b575a339a1`.

El [arnés de benchmarks](form-data/benchmark-harness.log) pasó sus 15 controles,
incluido el orden de microtasks de slots y la conservación de diagnósticos.
La validación local del hito está completa. El commit se publica con sus
reportes; los checks y la revisión remotos del SHA vigente se verifican antes
del checkpoint y la integración. Las pruebas finitas no garantizan ausencia
universal de fugas ni compatibilidad completa con estándares.
