# Errores atómicos de operaciones nativas

Esta segunda capa parte del fix de metadata `30ad6ed685d700ccf147b519dd386783517df6cc`. Su baseline mantiene 15 fallas de retención y 6 casos válidos en `baseline.log`. Las inserciones con segundo handle desconocido, hijo ya adjunto o inserción de sí mismo activaban registros reservados antes de rechazar. Las consultas con un documento desconocido y la serialización sin metadata también consumían reservas en caminos de error. La repetición sobre el lote de handles creaba hasta 128 nodos nativos sin que ninguna operación hubiese tenido éxito.

Las inserciones ahora validan los enlaces de nodos activos o reservados, incluyendo ciclos y ownership topológico, antes de activar cualquiera. El commit de enlaces se ejecuta después de la validación y no utiliza rollback. Las consultas validan ambos handles antes de activarlos; conservan el contador de intentos y la materialización cuando devuelven un resultado o un fallback exitoso. La serialización valida el handle y consulta metadata sin materializar un nodo que no puede serializarse.

## Contratos y memoria

Las 21 pruebas del addon cubren errores de handles, ciclos, nodos adjuntos, inserciones válidas entre reservas, orden, consultas, fallback, serialización y 6.000 operaciones rechazadas. Comparan estadísticas completas, permitiendo únicamente el incremento diagnóstico de intentos de query. `nativeQueries` se expone como intentos menos fallbacks; las pruebas preservan esa fórmula, sin reinterpretar el contador como éxitos.

Se agregaron tres pruebas Rust de las mismas fronteras. La primera validación aprobó las 28 pruebas Rust; Clippy luego pidió un alias local para el tipo de callback del test, corregido sin cambiar las aserciones. El resultado original se conserva en `pre-alias-clippy.log` y `pre-alias-validation.json`.

Los enlaces virtuales de un handle reservado son valores de stack. El preflight no agrega caches ni ownership y evita materializar nodos en errores. Las pruebas verifican reservas y capacidades estables y liberación posterior; no demuestran ausencia absoluta de fugas.

## Validación ejecutada

`npm run validate` pasó en Linux/WSL con Node 24.14.1: formato, Clippy, 28 pruebas Rust, build release, 169 pruebas Node, 7 Jest, 11 Vitest, 4 VM, 1.784 comparaciones HTML5 y 390 comparaciones WPT. HTML5 conserva 8 exclusiones script-on; WPT mantiene 388 aprobados y 2 fallas de adopción compartidas con jsdom. Los logs y estados completos están en esta carpeta. Ambas capas también pasaron juntas sus 36 regresiones con Node 22.12.0 (`node22.log`).

`npm run test:memory` pasó en los cinco modos. Rustdom liberó 880 documentos, 880 proxies de ventana y 2.320 atributos observados; el crecimiento retenido fue 0,72 MiB de heap y 3,62 MiB de RSS. El modo nativo mostró 0,63 MiB de crecimiento de RSS. Las muestras y límites están en [el reporte de memoria](../../memory/2026-09-12T02-38-21.019Z-linux-x64.json). La aceptación en Windows y macOS corresponde a los checks del PR.

## Benchmark reproducible

`node benchmarks/native-activation.cjs <baseline.node> <candidate.node>` ejecuta cuatro procesos aislados alternando el orden de los dos addons. Cada workload usa 3 warmups, 9 muestras por proceso y 10.000 operaciones por muestra (pares remove/append, queries con selector caliente o serializaciones). Conserva todas las muestras, hashes de los addons y script, lockfile, Node y hardware. Setup, carga de módulos y GC explícito quedan fuera del intervalo; las comprobaciones del resultado permanecen incluidas.

El baseline es el addon release construido para `30ad6ed`; el candidato se construye con `npm run build`. Es un microbenchmark de API nativa, no una medición de suites DOM completas, startup ni memoria pico. Sólo se ejecuta durante una franja sin otras compilaciones, pruebas ni benchmarks.

La [medición ejecutada](../../benchmarks/2026-09-12T02-45-17.923Z-native-activation.json) conservó 18 muestras por variante y workload, con todas las comprobaciones de resultados aprobadas:

| Workload (10.000 operaciones o pares) | Baseline, mediana ms | Candidato, mediana ms | Baseline/candidato |
| --- | ---: | ---: | ---: |
| remove + append | 4,497 | 4,653 | 0,966× |
| Query nativa | 13,865 | 14,417 | 0,962× |
| Serialización nativa | 4,324 | 4,422 | 0,978× |

Las medianas del candidato fueron mayores. Los rangos se solapan y existen valores atípicos conservados en el reporte; esta ejecución no permite atribuir con precisión todo el delta al preflight. No se afirma una mejora de rendimiento ni se eliminan las muestras menos favorables.
