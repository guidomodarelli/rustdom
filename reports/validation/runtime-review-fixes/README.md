# Validación de las correcciones del entorno Vitest

Base: `eefde6320db875e53e71e07927c10077e4b1b60d` (`main`). Las ejecuciones locales usan Linux x64 mediante WSL y Node `v24.14.1`; no representan una validación local de Windows o macOS. Se compila y ejerce el addon real de Rust, sin mocks de plataforma.

| Finding del PR #1 | Resultado del cambio |
| --- | --- |
| `3991528571` | La ventana publica los constructores nativos `ReadableStream`, `WritableStream` y `TransformStream`; las respuestas conservan identidad de stream y transfieren datos mediante los tres constructores. |
| `3991528582` | `Request.formData()`, `Response.formData()` y sus clones producen `FormData` y `File` del DOM activo. Se preservan duplicados, nombres, MIME y bytes; los archivos se leen con el `FileReader` real. |
| `3991528593` | Ya corregido en `d418cac062784ccab4b239360cac2b5254c906da`: el digest recorre `src` recursivamente y guarda `measuredSources`. No se modifica otra vez `benchmarks/compare.cjs`. |
| `3991528597` | El puente se instala desde `beforeParse` antes del callback del usuario y de los scripts. Los fallos del callback o del parser cierran la ventana, cancelan timers, revocan URLs y separan señales externas. |
| `3991528609` | `Request` y `fetch` resuelven entradas relativas contra `document.baseURI` actual, incluyendo cambios de historial y de `<base>`. Se conservan entradas `URL`/`Request` nativas y la aridad obligatoria. |

## Evidencia antes y después

Los archivos `baseline-*.log` se ejecutaron con los tres módulos de producción originales de la base y las regresiones nuevas. Registran 4 fallos de 13 tests de lifecycle, 3 fallos de 7 tests de Vitest normal y 10 fallos de 18 tests VM. En VM también apareció un test existente que exigía `TypeError` del global de ejecución: no se debilitó esa aserción. Los exit codes del primer wrapper de shell no se conservan como evidencia fiable; los resultados del runner y sus diagnósticos completos sí están guardados.

La lectura de formularios convierte únicamente `TypeError` nativos a `TypeError` del global de ejecución cuando difieren, conservando el error original en `cause`. El pool normal usa el `document.defaultView` configurado por `populateGlobal`; los pools VM conservan la ventana. `intermediate-error-realm.*` documenta el fallo intermedio de esta distinción y `focused.*` conserva la ejecución corregida: 14/14 tests de lifecycle, 7/7 de Vitest normal y 18/18 en `vmForks`/`vmThreads`.

Las aserciones adicionales de aridad, entrada `Request` nativa, uso después de cierre y `<base>` dinámico se agregaron después de capturar la base. Cada suite VM ejecuta el mismo archivo de contratos de plataforma que el pool normal, además de la integración de React ya existente.

## Ownership y límites

Los constructores publicados resuelven la URL actual mediante `WeakRef`. La lectura de formularios consulta sus constructores únicamente después del consumo asíncrono del body. `dispose()` elimina las referencias fuertes compartidas por sus closures, incluyendo la ventana y las funciones de eventos. Si la lectura termina después del teardown, rechaza con `TypeError: rustdom formData: environment has been disposed`, independientemente del momento de GC.

`baseline-pending-ownership.json` conserva una reproducción del defecto intermedio: capturar constructores antes del `await` mantenía viva una ventana luego de ocho rondas de GC cuando un stream no terminaba. La integración de las regresiones de formularios ejercita dos realms simultáneos, fetch/clones, errores y cuatro cuerpos pendientes por ventana, manteniendo instancias, constructores, métodos y callbacks vivos después del cierre. Los gates Rust y build nativo anteriores siguen aplicando; la validación JavaScript se vuelve a ejecutar sobre la implementación integrada.

El stress de memoria agrega por modo 440 construcciones fallidas, conserva deliberadamente 1320 constructores públicos y mantiene señales extranjeras y callbacks de teardown. Observa `Document` y `Window` por separado y verifica los contadores nativos después de GC. Es una prueba finita de retención, no una demostración absoluta de ausencia de fugas.

El reporte histórico `reports/benchmarks/2026-09-12T13-54-49.137Z-linux-x64.json`, incluido en la base, ya registra `src/environments/window-errors.cjs` en `measuredSources` y el digest `b53bc1b2d5ef2c625abe7711aa908e0dccb4c8cbd3aa80c3e8f87e2a64355336`. Los benchmarks nuevos ejercen los setups normal y VM con sus muestras, verificación de resultados y metadata completas. No se afirma una mejora de rendimiento a partir de este fix.

Estos cambios pertenecen al puente JavaScript de un DOM híbrido que ejecuta operaciones de árbol y parsing en Rust. No certifican compatibilidad completa con estándares ni completan la migración íntegra a Rust.

## Resultado final de la integración

| Validación | Resultado |
| --- | --- |
| `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings` | Aprobados. |
| `cargo test --locked` | 100/100 aprobados. |
| `npm run build` | Addon release real y build JavaScript aprobados. |
| Regresiones de formularios integradas | 4/4 aprobadas; dos realms simultáneos en normal y VM. |
| `npm test` final | 308/308 Node, 7/7 Jest, 14/14 Vitest y 18/18 VM aprobados. |
| Corpus HTML5 | 1784 comparaciones sin diferencias contra jsdom 27.4.0; 8 casos script-on excluidos. |
| WPT | Paridad en 70 archivos y 43708 casos; 42678 aprobaciones normativas. Se conservan 1030 fallos compartidos y el bloqueo previo de `range-deletion`. |
| Stress de entorno | Por modo, 0/880 documentos y 0/880 ventanas sobrevivientes, con 1320 constructores deliberadamente retenidos. |
| Lecturas pendientes | Por modo, 0/24 documentos y 0/24 ventanas sobrevivientes antes y después de resolver los streams; 96 lecturas terminan con el error controlado de disposición. |

[integrated.json](integrated.json) registra los comandos finales y sus exit codes. Se reutilizaron los cuatro gates Rust/build de [all.json](all.json), porque el ajuste posterior afecta módulos JavaScript cargados directamente desde `src/environments` y no cambió Rust ni el proceso de build. El gate JavaScript anterior de `all.json` y los focales anteriores se conservan como históricos; el `npm test` integrado los reemplaza. Corpus/WPT ejercieron el runtime DOM sin cambios. No se ejecutaron packaging ni compilaciones Windows/macOS en esta integración local.

El [stress final](../../memory/2026-09-12T15-31-25.052Z-linux-x64.json) registra crecimiento de heap de 3895832/3504168 bytes y de RSS de 40935424/42397696 bytes en normal/VM. El crecimiento externo es de 40 bytes en ambos modos. La liberación de todos los WeakRefs observados no implica que el allocator devuelva toda la memoria al sistema.

Las muestras de lecturas pendientes están en los reportes [normal](../../memory/2026-09-12T15-27-52.037Z-formdata-realm-normal.json) y [VM](../../memory/2026-09-12T15-28-19.054Z-formdata-realm-vm.json). Mantienen los owners, clones, métodos, constructores, fetch y callbacks alcanzables, además de las lecturas sin terminar.

El [benchmark de setups](../../benchmarks/2026-09-12T15-29-21.592Z-linux-x64.json) vuelve a incluir `src/environments/window-errors.cjs` en `measuredSources`; su digest es `041779acd122999bc3b660eabe0e1732de6c00bfd177f03ef989f9707acf7c59`. Sus medianas observadas jsdom/rustdom son 17.687/15.404 ms en setup normal y 14.376/10.910 ms en VM. Se ejecutó con carga local concurrente, incluyendo parte de la suite integrada; no permite atribuir causalmente mejoras o regresiones a este cambio.

El [benchmark de formularios integrado](../../benchmarks/2026-09-12T15-31-41.877Z-formdata-fixed.json), ejecutado después de los otros runners propios, observa 0.309675 ms/op para multipart y 0.030581 ms/op para URL encoded. Preserva todas las muestras, identidades y fingerprints. La base devolvía objetos del realm incorrecto, por lo que los tiempos entre versiones no representan contratos equivalentes ni acreditan una mejora de rendimiento.

La [variante aislada de FormData](isolated-formdata-variant/README.md) se archiva con su ZIP y verificación de 11 hashes como evidencia histórica separada. Sus gates y mediciones no sustituyen esta validación integrada.
