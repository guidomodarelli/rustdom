# Captura única del iterador mediante arguments estricto

La captura de XML obtiene ahora el well-known symbol desde la propiedad propia de un objeto `arguments` estricto recién creado. Se retiraron todos los fallbacks a Array, generadores, process.getBuiltinModule y realms VM. No se modificaron loaders, exports, caché CommonJS, ABI ni ownership por Env.

Base: `65abdbc1214fc2fa73ca67c50133f16d43648e63`, rama `feature/native-form-data`; `main`: `ece7d46c9cdb94eea3c23e517b341771ee9719d4`. Clon propio directo de GitHub y copia Linux `/home/guido/rustdom-pr67-loader-hardening-48dJTH`. Dependencias por symlink de lectura después de comparar package.json y lockfile.

Addon baseline: `793f53a81b7965b8e12661c8c6be76e7e14fcc35117f697b1622e7cf7b037a63`. Addon final: `cf2da57551d510b0530f7fb28ce6f3d938342ef786b47abf34eb56369b9d24e7`.

## Fundamento y alcance

[CreateUnmappedArgumentsObject, paso 7](https://tc39.es/ecma262/multipage/ordinary-and-exotic-objects-behaviours.html#sec-createunmappedargumentsobject) define el símbolo de iteración como propiedad propia del objeto nuevo. El paso posterior instala el accessor intrínseco de callee. La implementación crea una función estricta sin argumentos y enumera únicamente claves propias simbólicas mediante Node-API: no lee el accessor callee, el método iterador ni prototipos/constructores externos.

Las comprobaciones de cardinalidad y tipo verifican el contrato de ese objeto fresco. No se compara la descripción del símbolo. Sólo la clave primitiva pasa al ObjectRef existente; el objeto arguments y su función son temporales del handle scope. Se mantienen instance_data y su finalizador, sin referencias persistentes adicionales.

La evidencia independiente `tests/helpers/arguments-iterator-proof.cjs` confirma en Node 22.12.0 y 24.20.0 la propiedad propia y su identidad, aun eliminando Array.iterator, IteratorPrototype.iterator y Array.values, cortando GeneratorPrototype, quitando Symbol/Array/String/Function globales y bloqueando getBuiltinModule. El código de producción también se ejerció bajo esas condiciones.

La captura usa una pequeña expresión JavaScript del lenguaje; no representa una implementación íntegramente Rust. No se requieren Node VM ni API V8 privada. Los archivos reservados de FormData y napi_error no se modificaron.

## Qué mostró la comparación de cargas

El comentario `4020958640` contrasta un jsdom ya cargado con un addon frío. Esa comparación por sí sola no acredita una regresión bajo cargas equivalentes. Se ejecutó una matriz separada de carga fría y caliente en Workers reales, con ambas claves de prototipo eliminadas y el hook de built-ins reemplazado.

| Entrada | Baseline frío | Candidato frío | Caliente, ambas versiones |
| --- | --- | --- | --- |
| w3c-xmlserializer 5.0.0 | Falla en carga de dependencias | Igual | Serializa `ready` |
| jsdom 27.4.0 completo | Falla en carga de dependencias | Igual | Falla en spread del wrapper público |
| CJS exportado como @rustdom/rustdom/native | Lee el hook y falla al cargar | Serializa `ready`, 0 lecturas del hook | Serializa `ready` |
| Binario interno dist/rustdom.node | Lee el hook y falla al cargar | Serializa `ready`, 0 lecturas del hook | Serializa `ready` |
| @rustdom/rustdom completo | Falla en carga de dependencias | Igual | Falla en spread del wrapper público |

Los resultados coincidieron en Node 22 y 24. La ruta `dist/native.cjs` es el destino CJS declarado para `./native` en package.json. El `.node` directo es un archivo interno, no una ruta exportada del paquete; se conservó y reforzó igualmente su comportamiento. La mejora fría del API nativo es hardening adicional: no se presenta como igualdad con un oracle frío que también falla.

Los JSON `*-loader-conditions.json` guardan fase, error, lecturas del hook y resultado por entrada. `loader-conditions.cjs` restaura las mutaciones antes de las aserciones/reportes. La primera expectativa de que el oracle frío completaría la carga se corrigió con esta evidencia; `red-node24.initial-comparison.log` no se usa como gate final.

## Validación

Linux x64, WSL Ubuntu 22.04, Node 24.20.0 y 22.12.0, Rust/Cargo 1.98.1, N-API 8.

| Gate | Resultado |
| --- | --- |
| Rojo: native público y addon directo fríos | 2 fallos; 2 controles calientes pasan |
| Node 24: claves/loader/XML/diagnósticos | 206/206 |
| Node 22: mismas suites | 206/206 |
| Build nativo final | Correcto, sin warnings |
| Rust XML | 9/9; 240 casos fuera del filtro |
| Formato y Clippy all-targets con -D warnings | Correctos |
| Contextos con hook bloqueado | 24/24 ciclos por runtime |
| DOM/XML con captura bajo mutaciones | 15/15 ciclos por runtime |
| Diagnósticos/causas/formatter | 12/12 ciclos |

Después de las suites se retiró únicamente un import que el compilador marcó sin uso y se recompiló; los gates GC, Clippy y benchmark usan el binario final. No se cambiaron código de loader/caché ni contratos públicos. La validación de la unión y sus paquetes queda a cargo del coordinador.

## GC y recursos

`intrinsic-realm-memory.cjs` se actualizó para exigir que no se cree ningún contexto adicional: baseline, antes de GC y después de GC fueron siempre 1 native_context, con 0 detached_contexts, en 24 cargas de cada runtime. Se bloquea también getBuiltinModule. La aserción antigua que exigía observar un realm nuevo se sustituyó por igualdad estricta antes y después, porque la arquitectura ya no crea VM contexts.

Reportes: `reports/memory/2026-09-15T23-32-53.883Z-intrinsic-arguments-contexts.json` y `reports/memory/2026-09-15T23-32-54.295Z-intrinsic-arguments-contexts.json`.

El DOM se verificó después de inicializar el addon con prototipos y hook bloqueados: `reports/memory/2026-09-15T23-32-55.337Z-xml-serialization.json` y `reports/memory/2026-09-15T23-32-56.954Z-xml-serialization.json`. Se observaron Window y Document por separado, además de nodos, callbacks, iteradores y errores. La regresión de causas/formatter está en `reports/memory/2026-09-15T23-32-58.672Z-iterator-diagnostics.json`. Todos alcanzaron el endpoint de liberación observable.

Son escenarios finitos, no una afirmación de ausencia absoluta de fugas ni de memoria pico.

## Benchmark de inicialización

Se ejecutaron 45 Workers secuenciales en una ventana exclusiva: tres warmups y doce muestras por variante, orden rotado. El intervalo contiene require(addon). La variante endurecida elimina ambas claves host y bloquea el hook; las mutaciones/restauración, comprobación de XML/errores, teardown y GC quedan fuera del intervalo.

| Variante | Mediana (ms) | Mínimo (ms) | Máximo (ms) |
| --- | ---: | ---: | ---: |
| Baseline normal | 0,9717 | 0,9059 | 1,2384 |
| Candidato normal | 0,8813 | 0,8076 | 1,0288 |
| Candidato endurecido | 0,8755 | 0,7691 | 1,1232 |

La mediana normal observada bajó aproximadamente 9,3%, pero los rangos se superponen; no se generaliza como mejora garantizada. El baseline no puede completar la variante endurecida, por lo que ésta se reporta como costo absoluto, sin comparación equivalente.

Después de nueve Workers de calentamiento, el heap del proceso pasó de 5.036.568 a 5.101.184 bytes, RSS de 71.376.896 a 73.236.480 y memoria externa permaneció en 2.158.639. El reporte acumula estados escalares; no es memoria pico ni permite atribuir por sí solo crecimiento al allocator o a una fuga.

Hardware, versiones, hashes y todas las muestras: `reports/benchmarks/2026-09-15T23-36-01.044Z-xml-intrinsics-init.json`. Memoria por salida: `reports/memory/2026-09-15T23-36-01.044Z-xml-intrinsics-envs.json`.