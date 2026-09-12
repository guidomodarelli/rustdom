# Tercera ronda de review del PR #24

Esta ronda corrige los findings `3997011686`, `3997011692`, `3997011698`, `3997011700` y `3997011706`. La base coordinada es `main` en `123e9bd0d4894b4d69f49bf68ff13c977bca5074`, integrada mediante el merge normal `3dc3552bc21136e5473aad1c699e8ea27f6d9fdf`. La integración inicial de `eb7ee6e` quedó en `694032495faca19ed1df4579ac0cf0315167934f`. Ambas conservan la historia publicada del PR y se clasifican como `REMOTE_DRIFT_RELATED` por cambios nativos, de build, packaging y contadores de memoria.

## Resultado final

[summary.json](summary.json) confirma fuentes sin cambios, **8 gates centrales, 2 de empaquetado y 2 benchmarks aprobados**. El addon real tiene SHA-256 `aaca00c219a6dcd2a58692cfcb6676913f75d70329eb7a6d4dfd4dc7d5e35917`.

| Validación | Resultado |
| --- | --- |
| Formato, clippy y Rust | Aprobados; 115/115 tests Rust. |
| `npm test` | 436/436 Node, 7/7 Jest, 18/18 Vitest y 26/26 VM. |
| Corpus HTML5 | 1784 comparaciones compatibles; 8 script-on excluidos. |
| WPT | Paridad en 70 archivos y 43708 casos; 42678 aprobaciones normativas. |
| Memoria | 0/880 Document y 0/880 Window sobrevivientes por modo; lectores pendientes también liberan 24/24 por modo. |
| Paquete | Archivo real y consumidores npm/pnpm aprobados: types, CJS/ESM, assets/workers y Jest/Vitest/VM. |

La primera invocación directa `node scripts/package.mjs` falló porque el script exige `npm_execpath`. Se conserva ese diagnóstico en [package.log](package.log). No se cambió código para evitarlo: [package-validation.json](package-validation.json) registra los comandos correctos `npm run package` y `npm run test:package`, ambos aprobados y con el mismo hash del addon antes/después. Este resultado reemplaza únicamente aquel intento de invocación; los ocho gates anteriores de [gates.json](gates.json) permanecen válidos.

La [distribución verificada](../../distribution/2026-09-12T18-53-37.987Z-linux-x64.json) corresponde al archivo local con SHA-256 `2d8d11828b3dd684671be3433542d19b1aa0589f3e98392a5380d74b85ecf150`; no se publicó un paquete npm.

Los [benchmarks](benchmarks.json) se ejecutaron después de finalizar nuestros gates y de que la tarea de main liberara CPU a las 19:02:37.045 UTC. No se controlan otros procesos del sistema.

- [Setup normal/VM](../../benchmarks/2026-09-12T19-07-37.427Z-linux-x64.json): medianas jsdom/rustdom **11.229/17.529 ms** en normal y **8.512/7.965 ms** en VM. El setup normal de rustdom fue más lento en esta medición; se conserva el resultado desfavorable y sus muestras.
- [Formularios](../../benchmarks/2026-09-12T19-07-47.201Z-formdata-fixed.json): **0.265068 ms/op multipart** y **0.034313 ms/op URL encoded**, con validación de resultados y muestras crudas. No representan velocidad de suites completas ni una mejora general.

El [stress final](../../memory/2026-09-12T18-50-18.860Z-linux-x64.json) registra heap +3939416/+3577016 bytes y RSS +41553920/+93147136 bytes en normal/VM; memoria externa +40 bytes en ambos. Se preserva esa retención de RSS, sin equiparar la liberación de referencias observadas con que el allocator devuelva toda su memoria al sistema. Los casos pendientes [normal](../../memory/2026-09-12T18-42-10.843Z-formdata-realm-normal.json) y [VM](../../memory/2026-09-12T18-42-41.488Z-formdata-realm-vm.json) alcanzan cero documentos y ventanas antes y después de terminar los streams, aun con EventTarget/TypeError borrados y close reemplazado.

## Contratos corregidos

- El `TypeError` de cada entorno se captura antes de `beforeParse`: el global de ejecución normal aporta su constructor original y VM usa el de su nueva ventana. Los constructores se consultan al producir el error y se liberan durante disposición; el fallback posterior al cierre también está capturado, sin consultar globals mutables.
- La población de resultados usa el `FormData.prototype.append` original del DOM. Su sustitución pública antes o durante el consumo no cambia el resultado. El append nativo de Node usado dentro del decoder URL encoded es otro borde: se conserva su comportamiento observable y no se remapean sus rechazos.
- Estado y metadata de Request/Response se leen mediante getters capturados, incluyendo body, bodyUsed, headers y Headers.get. Se mantiene el lector nativo de bytes y sus brand checks. El preflight consulta el estado intrínseco de locked; el lector nativo puede invocar después un getter público stream.locked, y su comportamiento o rechazo se preserva sin añadir llamadas ni heurísticas por mensaje.
- El owner captura el cierre original de Window y el puente conserva el prototipo original de EventTarget. Sustituir o borrar esos globals no impide liberar timers, señales y URLs. `releaseResources` intenta todos los pasos, preserva una falla única y agrega fallas secundarias con la primera como `cause`; todos los bindings que podrían retener el realm se limpian.
- El helper de MIME aplica [la extracción de Fetch](https://fetch.spec.whatwg.org/#concept-header-extract-mime-type) sobre listas: respeta comillas y escapes, recorta SP/HTAB, ignora entradas inválidas y `*/*`, selecciona el último MIME utilizable y conserva la regla de charset por cambio de esencia. Boundary no se hereda. Cada entrada se parsea con `node:util`, sin dependencias internas de Undici.

## Evidencia de regresión

[baseline.json](baseline.json) y [baseline.log](baseline.log) conservan la ejecución anterior al fix: **20 fallos de 22 tests**, exit code **1**, señal **null** y fingerprints de producción. Son pruebas de valores, identidad, consumo y liberación observables; no comprueban texto de archivos fuente.

Los focales [focused.json](focused.json) aprobaron **129 tests de contratos**, incluidos **49 del helper MIME**, junto con **18 tests Vitest normales y 26 VM** en los workers reales. La extracción se compara con `Response.blob()` nativo y los formularios con Request/Response nativos de Node v24.14.1. Las pruebas incluyen getters propios que lanzan, estados falsos, globals/prototipos sustituidos o borrados, MIME combinado y fallos de inicialización/forwarding.

Dos correcciones de fixtures preservan el contrato real: los globals normales de prueba incluyen el TypeError real del host, y una prueba previa que esperaba ejecutar un getter propio de headers ahora exige ignorarlo, como los métodos nativos. Se mantienen las aserciones de identidad para errores de streams y del decoder nativo.

Los workers de memoria retienen lectores, clases, clones, fetch, adaptadores de accessor y callbacks de teardown mientras hay cuerpos pendientes. Ahora también borran EventTarget/TypeError y reemplazan el close público antes del setup. Exigen liberar Document y Window por separado antes de completar las lecturas y después de resolverlas.

## Alcance de la validación

Se ejercen el addon Rust real, los runners y las bibliotecas de plataforma, sin mocks. Los cambios del puente siguen ejecutando JavaScript y APIs Node/jsdom; no completan la migración integral a Rust. Las comparaciones de corpus/WPT no equivalen a una certificación completa de estándares, y las pruebas finitas de memoria no demuestran ausencia absoluta de fugas.

Las dependencias y outputs se mantienen en el clone de esta ronda. Los caches reutilizados son copias de caches propios de la ronda anterior; no se copiaron node_modules ni se escribieron caches del checkout original. La toolchain local es Node v24.14.1 y Rust/Cargo 1.98.1 sobre Linux x64 mediante WSL.
