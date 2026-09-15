# Corrección de la captura de Symbol.iterator al inicializar el addon

PR 67, finding 4018478154. Base de implementación: `e717ba14b7bd6683eebe3380c729ca8f2f1b2134`; `main` remoto verificado: `ece7d46c9cdb94eea3c23e517b341771ee9719d4`. Este cambio se entrega como commit local al coordinador; no publica ni cierra el review por sí mismo.

El addon podía fallar al cargar cuando `Symbol.prototype.constructor` era `null`, `undefined` o un getter que arrojaba. Un constructor sustituto con otra clave también alteraba la serialización. jsdom 27.4.0 cargaba y serializaba los mismos documentos correctamente.

La captura ahora enumera mediante Node-API las claves simbólicas propias del prototipo de un array creado por Node-API. Un helper efímero de sintaxis `for…of` devuelve la clave que consulta el motor sobre un objeto nuevo de prototipo `null`. No lee `globalThis.Symbol`, `Symbol.prototype.constructor`, métodos de `Object`/`Reflect`/`Array`, valores de propiedades del prototipo ni descripciones de símbolos. Una clave falsa `Symbol('Symbol.iterator')` colocada antes de la verdadera no puede suplantarla ni ejecutar su getter.

La serialización sigue implementada en Rust. La captura inicial usa esta pequeña operación JavaScript porque Node-API no proporciona un acceso directo a well-known symbols. La función, la lista de claves y los objetos del probe quedan en el handle scope de inicialización. El estado persistente sigue siendo un único `ObjectRef` por Env con la clave de iteración y el formateador de símbolos; las recargas del addon reutilizan el contenedor y el callback de finalización libera su referencia. No se captura un DOM ni se modifican contadores o rutas de limpieza. El formateador sigue capturándose desde `Symbol.prototype.toString` al cargar y conserva la protección existente frente a cambios posteriores.

Se mantienen locales los valores del fixture y el plan de muestreo: pertenecen exclusivamente a estos escenarios y no son contratos compartidos ni configuración del producto.

## Pruebas ejecutadas

- Runtime: Node 24.20.0, Rust/Cargo 1.98.1, Linux x64 en WSL Ubuntu 22.04, addon N-API 8; dependencias propias instaladas con `npm ci --ignore-scripts` y lockfiles sin modificar.
- Build de referencia y build nativo corregido: correctos. SHA-256 de referencia `fb12b3d1fa14ec020cf520734b30b927176bff4dc3632e3b9fe8072f882b89cd`; corregido `e38f131d2efa64fe8059d7f15f42a22075373584e1900074fc20a650000860f3`.
- Rojo: 169 pruebas, 163 pasan y 6 fallan: cinco cargas públicas y el Worker con getter de constructor. La suite roja finalizó a las 18:18:18.458Z; el candidato se instaló en `dist` a las 18:18:45.026Z, después del último subproceso rojo. El binario original quedó en una copia inmutable para el benchmark.
- Verde Node 24.20.0: 169/169 contratos de iteración; incluye cinco cargas públicas frente a jsdom independiente, clave falsa de igual descripción, globals modificados tras la carga, errores con identidad y realm, y ocho Workers con 100 iteraciones y recarga del addon bajo globals modificados antes de inicializarlo.
- Node 22.12.0: 169/169 contratos de iteración y carga pública, incluido el mismo oracle independiente.
- `cargo clippy --locked --all-targets -- -D warnings`: correcto.
- `cargo fmt --check`: correcto. `cargo test --locked xml`: 9/9, con 237 tests de otros módulos fuera de este filtro.
- XML adicional: 183/183 pruebas entre `tests/xml-serialization.spec.cjs` y `tests/xml-serialization-native.spec.cjs`.

Los logs conservan el contenido de salida con finales de línea y espacios finales normalizados; están en `reports/validation/pr67-symbol-intrinsics/`, con observaciones diferenciales en `reports/compatibility/`. No se añadieron mocks ni exports para pruebas. Las suites globales Jest/Vitest/VM y la matriz Windows/macOS corresponden a la validación de la unión que realiza el coordinador, no a una afirmación de ejecución de este subtrabajo.

## Memoria

Se ejecutó `node --expose-gc -e 'Symbol.prototype.constructor = null; require("./tests/helpers/xml-serialization-memory.cjs")'`. Los 15 ciclos alcanzaron dos muestras consecutivas sin supervivientes de Window, Document, nodos, callbacks, iteradores ni errores. `live`, `references` y `cleanupErrors` de serialización terminaron en cero.

Después de los cinco primeros ciclos de calentamiento, el heap observado pasó de 30.132.896 a 31.469.392 bytes, RSS de 162.127.872 a 171.827.200, y memoria externa permaneció en 3.326.460. Las muestras incluyen los registros escalares que acumula el propio informe. No son memoria pico ni permiten atribuir por sí solas el crecimiento al allocator o a una fuga. El resultado acredita liberación observable en estos escenarios finitos, no ausencia absoluta de fugas.

Evidencia: `reports/memory/2026-09-15T18-23-42.003Z-xml-serialization.json`.

## Benchmark de inicialización y finalización de Env

En una ventana exclusiva, sin otras matrices ni builds, se ejecutó `node --expose-gc tests/helpers/xml-intrinsics-initialization.cjs .cache/rustdom-baseline.node dist/rustdom.node`. Cada muestra usa un Worker nuevo. Se alterna el orden de ambas versiones por ronda; cada binario recibe tres warmups y doce muestras. El intervalo medido contiene únicamente `require(addon)` e incluye la inicialización real N-API. Fuera del intervalo se comprueban 100 serializaciones correctas y 100 errores Symbol por Worker, se espera su salida y se toman cuatro turnos de GC.

| Binario | Mediana (ms) | Mínimo (ms) | Máximo (ms) |
| --- | ---: | ---: | ---: |
| Referencia | 4,9922 | 3,6756 | 5,2465 |
| Corregido | 5,0593 | 3,2801 | 5,4050 |

La diferencia de medianas fue +0,0671 ms (+1,34%) para el candidato, con rangos superpuestos. No se afirma una mejora ni se atribuye esa pequeña diferencia de forma concluyente al cambio. Es carga del addon con caché de archivos calentada; excluye arranque de Worker, bundle JavaScript, construcción del DOM, validaciones, teardown y GC. No mide el arranque completo de la aplicación ni memoria pico.

Los 30 Workers completaron su trabajo y salida sin fallos. Las estadísticas de cada muestra devolvieron `live`, `references` y `cleanupErrors` en cero. Tras los seis Workers de warmup y hasta el último, el heap del proceso pasó de 4.991.696 a 5.073.480 bytes, RSS de 69.427.200 a 69.853.184 y memoria externa permaneció en 2.158.639. El informe mantiene muestras escalares; los números no prueban ausencia absoluta de fugas ni distinguen por sí solos retención del allocator. La liberación de Window/Document está cubierta por el escenario separado anterior.

Muestras crudas, versiones, hardware, configuración, lockfile hashes y hashes de los dos binarios: `reports/benchmarks/2026-09-15T18-38-34.881Z-xml-intrinsics-init.json`. Las observaciones de memoria y salida de entornos están en `reports/memory/2026-09-15T18-38-34.881Z-xml-intrinsics-envs.json`.
## Alcance y límites

La corrección elimina la dependencia concreta de `Symbol.prototype.constructor` y conserva las protecciones ya cubiertas. No certifica todos los prototipos posibles manipulados antes de la carga: la captura de claves presupone que el prototipo intrínseco de array conserva su clave de iteración, y el formateador inicial de símbolos mantiene el supuesto previo sobre `Symbol.prototype.toString`. Estos escenarios diferenciales tampoco constituyen compatibilidad completa con jsdom o los estándares. El objetivo global 100% Rust y compatibilidad verificable continúa pendiente.