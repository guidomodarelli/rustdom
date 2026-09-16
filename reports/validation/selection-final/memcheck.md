# Selection: memoria del addon cargado con Node 24.20.0

Fuentes SHA-256 `0e0ea222f4b4fc094d8b77058127c0baa5599684848948e4fa163fa05723d3f8`.
Addon SHA-256 `560a6b42821d48f3d064594d52f099815c34fcb51b77bd30106ba9e274012cb9`.
Ejecuciones del 15/09/2026, prefijo `2026-09-15T19-44-09.000Z-selection-`.
Los logs crudos están en `reports/memory/`.

Se ejecutó Valgrind Memcheck sobre Node con `--jitless --expose-gc`,
`--leak-check=full --show-leak-kinds=all --errors-for-leak-kinds=definite,indirect`.
El helper real ejerció asociación, Range compartido, excepción primitiva,
reentrada, collapse, extend, teardown y observación débil tras GC.
El modo control usa jsdom, pero también carga el addon para consultar contadores;
los dos controles adicionales de Node no cargan el addon.

| Escenario | Ciclos | Pérdida definitiva | Indirecta | Posiblemente perdida | Alcanzable |
|---|---:|---:|---:|---:|---:|
| jsdom con addon cargado, sin operaciones Selection nativas | 1.000 | 24 B | 0 B | 48.675 B | 18.189 B |
| rustdom Selection | 1.000 | 24 B | 0 B | 48.839 B | 18.189 B |
| rustdom Selection | 10 | 24 B | 0 B | 48.839 B | 18.189 B |
| Node y crypto, sin addon | 20 GC | 56 B | 0 B | 304 B | 8.214 B |

Los 24 B definitivos tienen exactamente el mismo stack
`CRYPTO_malloc → ossl_load_builtin_compressions → context_init` dentro de Node
en los tres escenarios DOM y el control sin addon. No se suprimió esa pérdida.
El control reducido de Node además reportó 32 B en un stack V8 y contextos de
valores no inicializados; se conservan completos, sin atribuirlos a rustdom.

El Memcheck de ambos modos DOM terminó con un contexto de error: esos 24 B de
OpenSSL. Por ello **no se reporta un gate Memcheck limpio**. No hubo contextos
adicionales de pérdida definitiva/indirecta, lecturas o escrituras inválidas
al ejecutar Selection en Rust en este escenario.

La diferencia de 164 B posiblemente perdidos procede de inicialización de
`std::thread::current` (48 B) y la tabla estática `NativeBorrowState` de N-API
(116 B). Los mismos tamaños/bloques permanecen con 10 y 1.000 ciclos. Esto no
muestra crecimiento por ciclo; no acredita ausencia universal de retención.
El resto incluye registros de clases, nombres del addon y allocations de Node.

Se mantuvieron únicamente las dos supresiones existentes y específicas de
`Memcheck:Cond` en el escaneo conservador cppgc. Los dos stacks también aparecen
al correr el control Node 24.20.0 sin addon y sin supresiones. No se agregaron
supresiones de leaks ni de accesos inválidos. El archivo de supresión todavía
documenta su origen Node 24.14.1; esta ejecución aporta evidencia adicional
sobre 24.20.0, sin generalizarla a otras versiones.

Los helpers de ambos motores terminaron con Window, Document, Selection y Range
observados en cero. Rust ejecutó 8.000 operaciones en 1.000 ciclos; el estado se
creó y liberó una vez, operaciones activas y cleanupErrors terminaron en cero.
Con 10 ciclos fueron 80 operaciones y los mismos balances. No se comparan aquí
los tiempos bajo instrumentación como benchmarks de rendimiento.
