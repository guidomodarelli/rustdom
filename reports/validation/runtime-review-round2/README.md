# Segunda ronda de review del PR #24

Esta ronda atiende `3996737350`, `3996737353` y `3996737356` sobre la rama `feature/runtime-review-fixes`. La primera integración de base es el merge normal `0641df109ebc6a99f4aeac6e954dc3630f321656`: conserva el HEAD publicado `d51350b3eaf31051f4b45d6afbea9743798c184e` e incorpora `main` en `5281862024a674580d738c411a47539a25f58c6e`. El ancestro común es `eefde6320db875e53e71e07927c10077e4b1b60d`. Se clasifica como `REMOTE_DRIFT_RELATED` por los cambios de build y del DOM nativo; no se reutilizan los gates de la primera ronda.

## Contratos corregidos

- Los rechazos del consumo nativo conservan su identidad exacta, incluidos `Error` y `TypeError` del usuario con el mismo mensaje que un error interno. Se usan lectores `arrayBuffer` intrínsecos, sin invocar overrides de instancia. Solo se construyen errores propios para preflight, MIME no admitido y parsing multipart; no se clasifica la procedencia por mensajes o `error.name`.
- MIME se lee después de consumir el body. El decoder URL encoded nativo recibe bytes ya consumidos y el único header pertinente como string. Sus rechazos se propagan sin remapeo, porque puede invocar métodos nativos modificados por el usuario. No se reimplementa la decodificación de bytes/BOM.
- `FormData` y `File` se capturan como intrínsecos antes de `beforeParse`, se consultan después de los `await` y se liberan en `dispose()`. Sustituir o borrar los globals antes o durante una lectura no cambia los constructores del resultado. Las lecturas que terminan después del cierre mantienen el rechazo controlado de la ronda anterior.
- La publicación normal conserva la lista original completa de nombres administrados: globals del host y del puente. Publica overrides y ausencias efectivos; no repone valores viejos. Los getters/setters mantienen su receiver original sin ejecución prematura, y sus adaptadores liberan la ventana durante teardown. Los descriptores originales del host se restauran íntegramente.

## Evidencia sobre la primera base integrada

[baseline.json](baseline.json) y [baseline-regressions.log](baseline-regressions.log) registran **14 fallos de 20 tests**, con exit code 1 y fingerprints anteriores al fix. Después se agregaron casos de MIME mutable, métodos de instancia, iteradores/getters ajenos, accessors con receiver explícito y globals del host adicionales.

[final.json](final.json) registra la versión consolidada: **54/54 focales** y `npm test` aprobado con **349 tests Node**, **7 Jest**, **16 Vitest** y **22 VM**. Los workers reales `vmForks`/`vmThreads` ejercen también el TypeError creado en el host y la eliminación de intrínsecos durante lecturas pendientes. Se usan el addon real y las librerías de plataforma, sin mocks.

[full.json](full.json) preserva los gates del merge: formato Rust, clippy, **105 tests Rust**, build release/JS, corpus y WPT aprobados. Su gate JavaScript y sus fingerprints iniciales son anteriores a los últimos ajustes; la validación JavaScript consolidada está en `final.json`. Los módulos Rust/DOM y su build no cambiaron durante esos ajustes del entorno.

El corpus compara **1784 casos sin diferencias** contra jsdom 27.4.0 y excluye **8 script-on**. WPT conserva las exclusiones y resultados normativos detallados en el reporte; paridad con la referencia no certifica cumplimiento completo de estándares.

## Memoria y mediciones

El stress final de esta base está en [2026-09-12T16-32-39.377Z-linux-x64.json](../../memory/2026-09-12T16-32-39.377Z-linux-x64.json): **0/880 Document y 0/880 Window** sobrevivientes por modo, manteniendo 1320 constructores públicos. Se conservan crecimiento de heap, memoria externa y RSS; no se afirma que el allocator libere toda la memoria al sistema.

Los reportes focales [normal](../../memory/2026-09-12T16-29-40.153Z-formdata-realm-normal.json) y [VM](../../memory/2026-09-12T16-30-04.431Z-formdata-realm-vm.json) observan **24 Document y 24 Window** por modo, todos liberados antes y después de completar los streams retenidos. Normal conserva además **24 adaptadores de accessor** después del teardown. Son pruebas finitas con muestras crudas y contadores nativos.

El [benchmark de setups](../../benchmarks/2026-09-12T16-29-29.657Z-linux-x64.json) observó medianas jsdom/rustdom de **15.064/23.108 ms** para normal y **11.355/10.355 ms** para VM: se conserva también el resultado desfavorable del setup normal. Hubo carga concurrente local; estos números no atribuyen causalmente una mejora o regresión al fix.

El [benchmark de formularios posterior](../../benchmarks/2026-09-12T16-32-52.749Z-formdata-fixed.json) observó **0.200417 ms/op multipart** y **0.054009 ms/op URL encoded**. Incluye muestras, validación de bytes/identidad y fingerprints. Este puente ejecuta JavaScript y APIs Node/jsdom; no mide throughput del parser Rust.

Todas estas ejecuciones usaron Linux x64 mediante WSL, Node v24.14.1 y Rust/Cargo 1.98.1. Las dependencias y outputs quedaron dentro del nuevo clone, con rutas absolutas para ambos caches. Los binarios del toolchain existente se usaron en lectura. Windows, macOS y packaging de la integración corresponden a los checks de CI.
