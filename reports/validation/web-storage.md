# Web Storage con áreas nativas

localStorage y sessionStorage almacenan claves/valores UTF16 en áreas Rust
compartidas. IndexMap 2.14.2 conserva orden de inserción y permite acceso por
índice; el uso de cuota se actualiza por diferencias sin recorrer todos los
pares en cada escritura. Borrado mantiene el orden y compacta capacidad; clear
libera el mapa. Cargo.lock fija las dependencias y el paquete incluye sus licencias.

El host conserva WebIDL, el acceso por origen, las referencias entre ventanas y
la programación/entrega de StorageEvent. El área Rust no contiene referencias
JavaScript ni Window. Planificar una escritura no muta el área; el host programa
el evento y luego confirma sobre el estado actual, como la referencia.

Se preservan detalles de jsdom 27.4.0: oldValue vacío se transforma en null en
setItem, escribir de nuevo un valor vacío puede programar otro evento, removeItem
conserva el valor vacío original, cuotas NaN/undefined no rechazan escrituras y
un iframe puede compartir área sin heredar la cuota del wrapper del padre. La
URL del evento sigue siendo la capturada por el constructor de Storage. Son
compatibilidad con la referencia, no afirmaciones de conformidad del estándar.
La interfaz de referencia es [Web Storage](https://html.spec.whatwg.org/multipage/webstorage.html#the-storage-interface).

Los cursores conservan secuencias de inserción monotónicas y buscan el siguiente
índice vivo; no acumulan tombstones. Borrar/reinsertar o clear durante el recorrido
mantiene la semántica viva del Map original. Un cursor agotado libera su Rc del
área y permanece agotado aunque luego se agreguen claves. Los contadores separan
áreas, entradas, unidades UTF16, capacidad y objetos cursor.

## Contratos y WPT

[El baseline](web-storage/baseline.log) pasó 42 contratos públicos antes de cambiar
el backend. La [integración inicial](web-storage/integration.log) pasó esos casos
y dos protecciones contra setters heredados de oldValue. La
[ejecución ampliada](web-storage/contracts-expanded.log) pasó 52 casos: 48 públicos
en realms normal/VM y cuatro contratos del addon real. Cubre Unicode, errores,
índices WebIDL, cuotas, propiedades reservadas, iteración durante mutaciones,
eventos, reentrada y áreas compartidas/independientes.

[Cuatro tests Rust](web-storage/rust-focused.log) y Clippy pasaron. Los
[WPT focales](../compatibility/2026-09-15T01-34-15.073Z-linux-wpt.json) mantienen
1.247 resultados en paridad, con tres fallos compartidos. La
[ampliación con eventos y cuotas](../compatibility/2026-09-15T01-42-55.179Z-linux-wpt.json)
pasó 1.277 resultados en paridad: 1.274 aprobados por el estándar y tres fallos
compartidos, conservando los fixtures y sus recursos originales.
Los fallos compartidos corresponden a defineProperty de símbolos no configurables
en ambas áreas y al realm del TypeError al invocar StorageEvent sin new.
Quedan fuera de este subconjunto particionamiento, popups y document.domain.

## Memoria

El [control focal](../memory/2026-09-15T01-33-55.084Z-web-storage.json) pasó seis
ciclos públicos (tres por motor) y seis ciclos de cursores nativos. Cada fixture
público crea 1.000 entradas y mantiene snapshots de strings. Retener Storage
conserva sus dos documentos, dos ventanas y cuatro wrappers de Storage, igual
que jsdom; soltarlos permite recolectarlos todos. Los cursores mantienen solo
datos Rust, permiten recolectar el wrapper de área y liberan el área al agotarse.
Son pruebas finitas de esos escenarios, no una garantía absoluta de ausencia de
fugas ni una prueba de todas las políticas de vida de grupos de origen.

La [memoria focal final](../memory/2026-09-15T01-59-32.086Z-web-storage.json) volvió
a pasar. El [estrés general](../memory/2026-09-15T02-00-57.995Z-linux-x64.json)
aprobó los cinco modos: rustdom liberó 1.762 documentos y 882 ventanas observados;
cada modo Vitest liberó 1.760 documentos y 880 ventanas. Los deltas RSS fueron
14,79 MiB, 26,64 MiB y 42,98 MiB para rustdom, Vitest y Vitest VM. El escenario
general utiliza una URL no opaca y ejercita ambas áreas, dejando datos poblados
antes de cerrar y conservando solo strings copiados y referencias débiles.

## Validación general

La [validación completa](web-storage/validation.json) pasó formato, Clippy, Rust,
Node, runners y corpus configurados: 235 tests Rust, 1.657 Node, 13 Jest,
24 Vitest y 26 Vitest VM. HTML5 conserva 1.784 comparables y ocho exclusiones.
El [WPT general](../compatibility/2026-09-15T01-56-48.146Z-linux-wpt.json)
registró 48.349 resultados en paridad, 47.279 aprobados por el estándar y 1.070
fallos compartidos. El reporte
conserva la exclusión previa del bootstrap de Range-deleteContents y los fallos
de estándar compartidos. No se equipara esa paridad con conformidad completa.

[Memcheck](../memory/2026-09-15T02-01-02.000Z-web-storage-valgrind.log) ejecutó los
cuatro tests Rust de Storage sin errores ni pérdidas definitivas o indirectas.
Conserva 48 bytes posiblemente perdidos y 544 alcanzables de std/libtest, sin
supresiones. El binario se resolvió desde los artefactos JSON de Cargo después
del cambio de dependencias; no se usó un ejecutable de tests anterior.

El paquete preparado tiene SHA-256
`189d2ea72e8f67a9397b6e851c3053100ffbd198485edcaf949546f6f67d20dc`.
Su binario tiene SHA-256
`73d4d5606f57080e6842ba5acf8ed80a6ff254818673d1846f839e906b1df50d`.
El mismo paquete pasó 18 controles en [Node 24](../distribution/2026-09-15T02-02-37.782Z-linux-x64.json)
y 18 en [Node 22](../distribution/2026-09-15T02-04-47.185Z-linux-x64.json),
incluidos npm/pnpm, tipos, CJS/ESM/VM, workers y runners reales.

## Rendimiento

Los [11 tests del arnés](web-storage/benchmark-tests.log) pasaron. El
[benchmark final](../benchmarks/2026-09-15T02-09-52.936Z-linux-x64.md) conserva
[muestras crudas y metadatos](../benchmarks/2026-09-15T02-09-52.936Z-linux-x64.json):
18 muestras por fila en dos procesos por motor, tres warmups por proceso,
Node 24.14.1, jsdom 27.4.0, Intel i7-1360P y WSL2. Cada entrada tiene clave y
valor UTF16 deterministas. La fixture de cuota usa el presupuesto exacto de
sus entradas existentes y mide un rechazo adicional.

Se incluyen las operaciones públicas, el puente y la programación real de
timers. Preparación, validación de cada clave/valor/orden y drenaje de eventos
quedan fuera del tiempo. Los documentos tienen origen no opaco. La memoria del
benchmark es posterior a GC, no memoria pico ni sustituto de los controles de
ownership anteriores.

| Operación | Entradas | jsdom mediana (ms) | rustdom mediana (ms) | jsdom / rustdom |
|---|---:|---:|---:|---:|
| Inserción | 100 | 0,873 | 0,538 | 1,62× |
| Sobrescritura | 100 | 1,292 | 0,434 | 2,97× |
| Lectura | 100 | 0,116 | 0,197 | 0,59× |
| key(index) | 100 | 0,133 | 0,193 | 0,69× |
| Enumeración | 100 | 0,187 | 0,354 | 0,53× |
| Borrado | 100 | 0,215 | 0,350 | 0,61× |
| clear | 100 | 0,064 | 0,093 | 0,69× |
| Rechazo de cuota | 100 | 0,173 | 0,180 | 0,96× |
| Inserción | 1.000 | 12,968 | 3,091 | 4,20× |
| Sobrescritura | 1.000 | 10,235 | 2,636 | 3,88× |
| Lectura | 1.000 | 0,696 | 1,318 | 0,53× |
| key(index) | 1.000 | 2,565 | 1,195 | 2,15× |
| Enumeración | 1.000 | 1,231 | 2,417 | 0,51× |
| Borrado | 1.000 | 1,217 | 3,587 | 0,34× |
| clear | 1.000 | 0,059 | 0,127 | 0,46× |
| Rechazo de cuota | 1.000 | 0,192 | 0,191 | 1,01× |

La contabilidad incremental beneficia inserción/sobrescritura y el acceso por
índice grande evita materializar todas las claves. Lecturas, enumeración,
borrado y clear conservan regresiones; borrar 1.000 entradas tarda cerca de
tres veces lo que jsdom. Cuota queda cerca de paridad en estas muestras. No se
presentan estos resultados como aceleración universal ni como prueba de que el
proyecto ya sea íntegramente Rust.
