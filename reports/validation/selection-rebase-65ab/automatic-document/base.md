# Captura de la clave de iteración con fallback independiente

El finding `4019923897` del PR 67 está corregido localmente. El addon puede inicializarse cuando falta `Array.prototype[Symbol.iterator]`, y después serializar colecciones que definen su propio iterador. La ruta existente sigue funcionando cuando se elimina el método del prototipo de iteración o se modifica la cadena de prototipos de generadores.

Base verificada: `66865bcb991b77b82ecb979feddc100366b502c9`, rama `feature/native-form-data`; `main`: `ece7d46c9cdb94eea3c23e517b341771ee9719d4`. Clone directo de GitHub y copia de trabajo propia en `/home/guido/rustdom-pr67-iterator-key-zLZHdC`. Dependencias por symlink de lectura después de comparar package.json/lockfiles. El runtime 668 se copió desde `/home/guido/rustdom-pr67-review-union-W0qZNw` sin modificarlo.

SHA-256 del addon 668: `367531b6ec645ba26ee0b296ec31ce24e0eebeed8861d73f51505cd3ed255b8a`. Candidato final: `69e8d98086fcd873dfcb08785999edd2fe595686c63ffcf3f14d8b4705d28b95`.

## Decisiones de implementación

- La captura conserva primero la ruta de arrays creados por Node-API. Enumera sólo claves simbólicas propias y el probe de `for…of` identifica la clave real; no lee valores de métodos ni getters ni compara descripciones.
- Si esa fuente no contiene la clave, se crea un generador mediante sintaxis y Node-API recorre su prototipo nuevo, `%GeneratorPrototype%` y `%IteratorPrototype%`. Se aplica el mismo probe a sus claves propias. No se consultan constructores globales.
- El fallback es perezoso: cuando la primera fuente sirve, no se exige la disponibilidad de los prototipos del generador. Las dos fuentes pueden perder su método de iteración de manera independiente.
- El probe opera exclusivamente sobre objetos nuevos y claves primitivas enumeradas. Devuelve el TypeError intrínseco de ausencia para permitir el fallback; no invoca ni captura excepciones del iterador del consumidor. Si los dos probes fallan, conserva la excepción intrínseca sin coerción.
- `instance_data`, el único ObjectRef por Env y su finalizador permanecen iguales. El generador, las funciones y los objetos de prueba quedan dentro del handle scope; sólo la clave elegida se guarda. No hay nuevos exports ni referencias persistentes.

La captura utiliza pequeñas operaciones JavaScript de sintaxis porque Node-API no expone directamente el well-known symbol. La serialización continúa en Rust. Este cambio no completa el objetivo general de implementación 100% Rust y compatibilidad verificable.

## Reproducciones y candidatos descartados

La referencia independiente es w3c-xmlserializer 5.0.0, dependencia de jsdom 27.4.0. Se carga antes de modificar los prototipos; el addon se carga después. Los fixtures usan iteradores propios y verifican serialización, errores primitivos, identidad/cause de errores del cuerpo e IteratorClose. No se afirma que todas las dependencias de `new JSDOM()` puedan cargarse con la iteración de arrays eliminada.

- 668: cuatro de las cinco matrices iniciales fallan al cargar con `TypeError: probe is not iterable`; el oracle procesa los mismos iterables. El control que sólo reemplaza el método por un getter pasa sin invocarlo.
- La candidata de sólo generador resolvía esos casos, pero fallaba si se eliminaba `%IteratorPrototype%[Symbol.iterator]` y se mantenía el método de arrays. Oracle y 668 pasan esa contraparte.
- La unión incondicional de fuentes también se descartó: exigir siempre la cadena del generador rompe `generator-chain-null`, que oracle y 668 soportan. El fallback perezoso pasa ambas contrapartes.

Se conservan los logs y hashes de esas candidatas bajo `reports/validation/pr67-iterator-key/generator-only/`, `eager-union/` y los archivos `counterpart-*`/`chain-*`. El benchmark del 20:54 corresponde a la unión descartada; la medición final es la del 20:59. No se reutilizan como gates finales. Los logs normalizan finales de línea y espacios finales; los JSON mantienen las observaciones completas.

## Validación final

Linux x64, WSL Ubuntu 22.04, Node 24.20.0 y 22.12.0, Rust/Cargo 1.98.1, addon N-API 8.

| Gate | Resultado |
| --- | --- |
| Build nativo release | Correcto |
| Node 24: 7 matrices nuevas + 169 contratos XML + 14 diagnósticos | 190/190 |
| Node 22: mismas suites | 190/190 |
| `cargo test --locked xml` | 9/9; 240 tests de otros módulos fuera del filtro |
| Formato y Clippy con `--all-targets -- -D warnings` | Correctos |
| GC de diagnósticos/Window/Document Node 22 y 24 | 12/12 ciclos por versión y formateador liberado |

Las siete matrices cubren Array.iterator eliminado, getter en Array.iterator, globals Symbol/String/Array ausentes junto con getters de Symbol.constructor/toString, getter en IteratorPrototype, símbolo falso de igual descripción, IteratorPrototype.iterator eliminado y cadena de GeneratorPrototype terminada en null. Cada Worker realiza cuatro cargas del addon y dieciséis operaciones observables. Se verifica cero lecturas indebidas, invocaciones nativas positivas y contadores de referencias/serializaciones activas/cleanup en cero. Los tests anteriores cubren realm, recargas y errores/callbacks de iteración.

No se repitieron suites globales ajenas al cambio; la validación de la unión, paquetes y CI queda en el coordinador.

## Memoria

Los reportes finales de GC son `reports/memory/2026-09-15T20-58-40.129Z-iterator-diagnostics.json` y `reports/memory/2026-09-15T20-58-41.371Z-iterator-diagnostics.json`. Cada versión libera primero un formateador previo al import que capturaba Window/Document, y luego completa doce ciclos de cien errores XML y cien errores FormData, alternando realms. También comprueba causas, identidad y precedencia de IteratorClose.

No quedaron supervivientes observados de Window, Document, callbacks, iteradores, errores ni causas. Entre primer y último ciclo, Node 24 pasó de 37.554.440 a 39.317.408 bytes de heap y de 142.696.448 a 144.281.600 RSS, con 3.309.755 bytes externos constantes. Node 22 pasó de 36.499.656 a 38.242.296 bytes de heap y de 136.818.688 a 137.998.336 RSS, con 2.866.664 bytes externos constantes. El reporte acumula estados escalares; estos números no representan pico ni permiten atribuir crecimiento al allocator o a una fuga. Los escenarios con prototipos alterados se verifican separadamente en Workers que terminan; no se afirma ausencia absoluta de fugas.

## Inicialización por Env

Se reutilizó el benchmark real `tests/helpers/xml-intrinsics-initialization.cjs`, con treinta Workers secuenciales en una ventana exclusiva: tres warmups y doce muestras por binario, orden alternado. El intervalo mide `require(addon)`; serialización correcta, errores Symbol, salida del Worker y cuatro turnos de GC se verifican fuera del intervalo. Se mide la ruta común con arrays intactos. El fallback nuevo no tiene una comparación válida contra 668, cuya carga falla en ese escenario.

| Binario | Mediana (ms) | Mínimo (ms) | Máximo (ms) |
| --- | ---: | ---: | ---: |
| 668 | 0,73122 | 0,66369 | 0,80225 |
| Final | 0,72501 | 0,66260 | 0,84122 |

Diferencia observada −0,85%, con rangos superpuestos: no se afirma una mejora. Se excluyen startup del Worker, fixture, validación, GC y teardown; no es el arranque completo de una aplicación ni una medición fría de disco.

Tras los seis Workers de calentamiento, el heap del proceso pasó de 4.982.296 a 5.064.080 bytes, RSS de 69.668.864 a 70.385.664 y memoria externa permaneció en 2.158.639. Todos los Workers completaron sus comprobaciones y salida. Son muestras finitas, no memoria pico.

Muestras crudas, versiones, hardware, lockfile hashes y binarios: `reports/benchmarks/2026-09-15T20-59-55.142Z-xml-intrinsics-init.json`. Memoria por salida de Env: `reports/memory/2026-09-15T20-59-55.142Z-xml-intrinsics-envs.json`.
## Paquete final verificado por el coordinador

El checkout de publicación y esta candidata tienen las mismas fuentes medidas:
SHA-256 `158bd333ef6ddc1d7379ea13da8025e02c3318da3560ca3c173d80623649661e`.
`pr67-iterator-key/package/source-copy.json` registra la comparación; el addon
`69e8d98086fcd873dfcb08785999edd2fe595686c63ffcf3f14d8b4705d28b95` coincide
con el de los contratos, GC y benchmark final descritos arriba.

Paquete `rustdom-rustdom-0.1.0-alpha.0-linux-x64-glibc-2026-09-15T21-09-16.398Z.tgz`,
SHA-256 `195130e03703750dbe886319572e097f48173890c1d1c87dfa7307f17e110153`.
Pasaron los 20 gates por versión de Node 22.12.0 y 24.20.0 con npm 11.19.0:
40 controles entre npm y pnpm aislado, tipos, CJS/ESM, assets, workers y runners.
Reportes: `reports/distribution/2026-09-15T21-09-18.545Z-linux-x64.json` y
`reports/distribution/2026-09-15T21-10-50.024Z-linux-x64.json`.

La validación se concentra en la inicialización modificada y la distribución
real; los resultados de la suite general de 668 siguen identificados como tales.
El nuevo commit requiere sus propios checks de CI y revisión antes del merge.
