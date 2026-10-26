<!-- pilot-v1-terminal-failure-40366685759 -->
**Estado del piloto v1:** [run 40366685759](https://github.com/guidomodarelli/rustdom/actions/runs/40366685759), intento 1, fuente 1078e4fd, terminó **fallido**. El preflight aprobó y los 32 jobs de captura fallaron. El primer artifact autenticado muestra un bug de preparación: el snapshot crea `inputs/` y el padre vuelve a crearlo, causando `EEXIST` antes del bucle de workers. Se están verificando los 33 artifacts completos antes de declarar el alcance total.

La etiqueta se aplicó una vez. Este método está consumido: no habrá relabel, rerun ni relleno de muestras. Se preservarán ZIP, tar, inventarios, logs y parciales. El fallo técnico no acepta rendimiento de Rust ni sustituye los rechazos históricos; `performanceAccepted=null`, `gateReevaluated=false`.

---

Cuando falla la construcción de una clase N-API antes de `napi_wrap`, la asignación Rust debe destruirse inmediatamente. Después de un wrap correcto, su liberación corresponde al finalizador de JavaScript. Este cambio aplica ese ownership a `new_instance<T>` y a los constructores directos, preservando el error original y el receiver existente.

- El guard distingue `Box<T>` y los dos layouts de clases de tamaño cero, transfiere ownership después del wrap y restaura la bandera de fábrica al salir con error. Las pruebas ejercen Range, el input UTF-16 de XML y MutationRecord con surrogates no apareados, además de terminación de workers reales.
- XMLSerializer incorpora lecturas directas N-API para objetos y funciones, conservando los helpers de realm para boxing de primitivas y diagnósticos. La entrada nativa anterior continúa disponible. El runtime sigue siendo híbrido; esta PR no completa la migración a Rust.
- Las mediciones conservan muestras, warmup, versiones, paquetes, controles rechazados y regresiones en [benchmarks](https://github.com/guidomodarelli/rustdom/tree/7148577dcf1eeffda2ebf95a3ccd1eb173a6082b/reports/benchmarks/native-class-ownership) y [memoria](https://github.com/guidomodarelli/rustdom/tree/7148577dcf1eeffda2ebf95a3ccd1eb173a6082b/reports/memory). Window y Document se observan por separado; las pruebas finitas y snapshots no demuestran ausencia universal de fugas ni memoria pico.

**Método publicado en [`1078e4fd`](https://github.com/guidomodarelli/rustdom/commit/1078e4fd190276a116e6dc5e64c9fe32eca3e7e9):** fuente revisada sin hallazgos, 849 dependencias y 850 entradas de publicación. El perfil habilitado aprobó 120 contratos Node y diez Python en Windows; la admisión del commit publicado también pasó en Git Linux real con Node 22.12.0/24.14.1 y rechazó el controller ausente, sin DOM.

La base 7148577d completó [calificación 4/4](https://github.com/guidomodarelli/rustdom/actions/runs/40344594967) y [CI general 8/8](https://github.com/guidomodarelli/rustdom/actions/runs/40344594060). Se publican artifacts originales, ocho replays offline, Memcheck de 311 tests Rust en diez batches y los 332 benchmarks ordinarios completos (221 medianas más lentas y 111 más rápidas, veinte controles separados, sin pooling). [Evidencia y límites](https://github.com/guidomodarelli/rustdom/tree/1078e4fd190276a116e6dc5e64c9fe32eca3e7e9/reports/validation/jsdom-block-pilot/readiness/20261026).

El SHA final completó sus propios [cuatro jobs de calificación/transporte40357510100](https://github.com/guidomodarelli/rustdom/actions/runs/40357510100) y [ocho generales40357510284](https://github.com/guidomodarelli/rustdom/actions/runs/40357510284), ambos aprobados (4+8) antes de la única aplicación de etiqueta. El piloto terminó fallido como se registra arriba.

**El merge sigue bloqueado por rendimiento:** los gates de ownership Node 22/24 conservan su rechazo histórico y los presupuestos originales ±2%/±5%. El método del piloto de precisión de controles jsdom está habilitado y publicado; la única secuencia se consumió y terminó fallida en preparación; el intento v1 no se reutilizará. Ese piloto nunca acepta rendimiento de Rust: `performanceAccepted=null`, `gateReevaluated=false`.

El alcance pendiente y la evidencia detallada se mantienen en [HANDOFF.md](https://github.com/guidomodarelli/rustdom/blob/7148577dcf1eeffda2ebf95a3ccd1eb173a6082b/reports/progress/HANDOFF.md). Las 48 entradas ajenas del otro worktree permanecen intactas.
