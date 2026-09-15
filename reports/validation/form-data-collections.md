# FormData: colecciones privadas estables

El adapter consultaba `Map` y `WeakMap` globales por cada `new FormData()`, y `Set` al modificar una lista cuya vista de serializer ya estaba materializada. jsdom 27.4.0 no incorpora esas dependencias en las mismas operaciones: conserva la lista en un array. Reemplazar esos globals luego de inicializar una ventana hacía fallar únicamente a rustdom.

## Cambio

`createFormDataImplementation` conserva los tres constructores durante la inicialización del runtime. Cada FormData sigue teniendo su propio Map de valores y WeakMap de identidades; cada eliminación de duplicados sigue creando su Set temporal. No se comparten listas ni propietarios de File, documentos o ventanas entre instancias.

La captura se mantiene privada al adapter. No altera los prototipos de las colecciones ni intenta proteger todas las demás dependencias globales. WebIDL, factories de realm y serializers siguen siendo integraciones JavaScript; este fix no transforma esas partes en Rust.

## Evidencia de regresión

- Baseline `755fc7175c35c857b08b520dc2e66d20e7526a1b`: Map y WeakMap nulos provocan TypeError al crear FormData; Set nulo provoca TypeError en `set` después de materializar `_entries`. Las tres secuencias primero completan las operaciones del jsdom independiente. Se conservan logs y la identidad del runtime en `form-data-collections/baseline-*`.
- 18 casos nuevos: Map, WeakMap y Set; valor null, constructor reemplazado y getter que arroja; realms default y VM. Cada caso vive en un subproceso y restaura el descriptor original antes del teardown.
- Las observaciones incluyen FormData vacío, append/get/getAll/set/delete, duplicados, construcción desde form/input File reales, identidad del File y mutación de la vista usada por el serializer. Los getters y constructores sustitutos no se consultan.
- Node 24.14.1: **74/74 tests focales**, incluyendo los 18 nuevos, Symbol, contratos nativos/diferenciales, multipart con XMLHttpRequest real y Request/Response/fetch.
- Node 22.12.0: los 18 casos nuevos y todos los contratos FormData core/XHR pasaron. La corrida amplia fue 73/74 por el ciclo de vida de un clon Response temporal; se conserva íntegra. Tras corregir únicamente el ownership del fixture, los 4 contratos de realm pasaron en Node 22.12.0 y Node 24.14.1 sin quitar assertions. Los otros 70 tests no cambiaron ni se repitieron.

## Memoria

El análisis de ownership no encuentra una colección global nueva de objetos DOM. Los tres constructores capturados son referencias acotadas del runtime; las proyecciones de File mantienen su ownership visible para GC.

El helper real de memoria pasó **28 escenarios** en ambos engines y realms default/VM, observando FormData, File, Document y Window por separado. Conserva las expectativas de retención de iteradores/vistas y de liberación al soltar esos propietarios. Resultado: `../memory/2026-09-15T16-47-34.799Z-form-data.json`.

El estrés de **1000 ciclos** construyó y liberó **1100 listas nativas**, incluyendo 100 constructores que fallan parcialmente: cero FormData, Document y Window supervivientes; listas, entries, textUnits, capacity y nameCapacity vuelven a cero; cero construcciones activas y cero errores de cleanup. Resultado: `../memory/2026-09-15-form-data-collections-native.json`.

Son pruebas finitas de los escenarios descritos. No demuestran ausencia absoluta de fugas. Se conservan heap JavaScript, external, RSS y estado nativo en las muestras; la retención del allocator no se interpreta automáticamente como fuga. No se modificaron fuentes Rust ni ownership N-API, y no se volvió a ejecutar Memcheck por este cambio exclusivo del adapter JavaScript.

## Build y procedencia

Se instaló con `npm ci` y se construyó el addon desde este clon con Cargo release/Rust 1.98.1. `npm run build` y el posterior `build:js` pasaron. Binario validado: `fb12b3d1fa14ec020cf520734b30b927176bff4dc3632e3b9fe8072f882b89cd`. No se copió un addon de otro clon.

Benchmarks y validación de la unión de PR67 pendientes en este estado local. No se afirma una mejora de velocidad.

## Diagnóstico de Response.clone en Node 22.12

El test de realm consumía `response.clone().arrayBuffer()` sin conservar el clon y luego volvía a clonar la respuesta original. El mismo patrón, **sin cargar rustdom ni jsdom**, falla **20/20 ciclos** con GC explícito en Node 22.12.0: `bodyUsed` pasa a true en el original antes de fetch y el segundo clone arroja el mismo TypeError. El control que conserva el clon consumido hasta una lectura observable final pasa **20/20**; Node 24.14.1 pasa **20/20** aun liberando el clon temporal. Se conservan los tres JSON `host-clone-*` y el diagnóstico ejecutable `tests/helpers/node-response-clone-lifecycle.cjs`.

El fixture ahora conserva `wireResponse` y comprueba `bodyUsed` al final de los lectores. Mantiene todos los contratos de multipart, File, Request/Response/fetch, clones, errores de body consumido y aislamiento entre realms. El bridge de producción permanece intacto. El fallo original `tests-node22.log` y el focal previo aislado 4/4 también se conservan; no se transforma la corrida 73/74 en una corrida completamente verde retroactiva.
