# Estado y propagación nativos de AbortSignal

AbortGraph mantiene en Rust flags, dependencias ordenadas, composición de any,
selección de dependientes y membresía/orden de algoritmos. Cada NativeAbortState
posee un ID y una referencia al grafo de su thread. Los IDs globales no se
reutilizan; liberar un estado elimina sus links recíprocos y compacta el grafo.
No se guardan valores ni referencias JavaScript en Rust. Los locks terminan
antes de devolver decisiones al host y ejecutar cualquier callback.

El bridge conserva reason en V8 y mapas fuertes de fuentes/dependientes que
mantienen la propiedad de los Sets originales. Los planes incluyen el input que
permite resolver cada source sin un registro global de owners. Rust marca todos
los dependientes antes de devolver el plan; asignar sus razones en el host no
repite esa transición. AbortController mantiene su señal estable y delega en el
nuevo AbortSignal. Timers, excepciones de la realm y callbacks siguen usando el
host real; este hito no declara totalmente nativo el motor.

## Baseline y corrección de la prueba

El [baseline inicial](abort-signal/baseline.log) tuvo dos fallos, uno por motor:
la prueba asumía que las excepciones de listeners de AbortSignal llegarían al
VirtualConsole. La implementación fijada usa un ownerDocument que no resuelve
la Window para ese reporte y captura esas excepciones; continúa con dependientes.
Se corrigió la expectativa desde el comportamiento de ambos motores, sin cambiar
producción para hacer pasar el test.

El [baseline corregido](abort-signal/baseline-corrected.log) pasó 14 contratos.
El estado parcial se prueba registrando una función que lanza mediante el
mecanismo interno real _addAlgorithm, sin reemplazar métodos: el source y los
dependientes ya tienen reason/aborted, pero se interrumpe la ejecución posterior.

Se ejercen reasons undefined/null/false/0/strings/NaN/BigInt/Symbol/objetos,
identidad y throwIfAborted, idempotencia, any vacío/duplicado/anidado/cross-realm,
orden y reentrancia, onabort, retirada de listeners con señal, timeout y close.

## Integración y ownership

La [integración inicial](abort-signal/native-integration.log) pasó 48 contratos
con abort, listeners y dispatch. Los [contratos nativos y de memoria](abort-signal/contracts-and-memory.log)
pasaron 33. Incluyen rechazo atómico de IDs inválidos, receptores ajenos,
iteración viva de algoritmos y el comportamiento original de valores internos
no invocables. Los snapshots y cursores no guardan callbacks en Rust.

El [GC de cinco ciclos](../memory/2026-09-13T17-54-15.702Z-abort-state.json)
retiene el estado nativo de un source o un composite mientras se recolectan
señales fuertemente conectadas, controllers, razones cíclicas, callbacks, target,
Document y Window. Los links desaparecen al liberar los demás estados; los IDs
de algoritmos pueden permanecer en el estado retenido sin retener sus funciones.
Vaciar ese estado y soltarlo devuelve los contadores al baseline.

La [versión con razones planificadas](abort-signal/planned-reasons.log) también
pasó los 33 contratos. Benchmark, validación general y controles instalados
también pasaron dentro de sus alcances documentados. No se infiere ausencia
absoluta de fugas ni compatibilidad total a partir de estos contratos finitos.

El [Memcheck nativo](../memory/2026-09-13T18-12-20.085Z-abort-valgrind.log)
ejerció los cuatro tests del grafo: cero errores, cero bytes definitivamente
perdidos y cero indirectamente perdidos, sin supresiones. Los 48 bytes posiblemente
perdidos y 544 alcanzables de std/libtest quedan visibles en el reporte.

El [control general de memoria](../memory/2026-09-13T18-14-14.180Z-linux-x64.json)
aprobó jsdom, rustdom, native, vitest y vitest-vm. Rustdom liberó los 1.322
documentos y 882 ventanas observados; cada modo Vitest liberó 1.320 documentos
y 880 ventanas. Los contadores nativos volvieron al baseline. Deltas RSS:
rustdom 33,85 MiB, vitest 26,68 MiB y vitest-vm 26,65 MiB, sin equiparar esos
valores con fugas ni con una garantía absoluta de ausencia de retención.

El artefacto con SHA-256
`a253fded3c5a3d224a7736b3c976038fb72b6e0490973da0d30d981157c3b3da`
aprobó 18 controles instalados en [Node 24](../distribution/2026-09-13T18-14-25.474Z-linux-x64.json)
y 18 en [Node 22](../distribution/2026-09-13T18-16-53.582Z-linux-x64.json):
npm/pnpm, TypeScript, CJS, ESM/VM, workers, Unicode y los runners reales.

## Benchmark

La [corrida aislada](../benchmarks/2026-09-13T18-07-35.663Z-linux-x64.json)
conserva 18 muestras por motor/operación en dos procesos por motor, con tres
warmups y orden alternado. Lifecycle incluye creación, abort/idempotencia,
lecturas y throwIfAborted. Any mide composiciones anidadas con dos roots;
propagación mide el abort de un source y sus dependientes preparados de antemano,
incluidos callbacks y la comprobación de que todos se marcan antes del source.

| Operación | Tamaño | jsdom ms | rustdom ms | Ratio |
|---|---:|---:|---:|---:|
| construct-native-eligible | 25 | 11,315 | 12,389 | 0,91× |
| construct-native-eligible | 250 | 32,424 | 45,882 | 0,71× |
| construct-native-eligible | 1000 | 76,474 | 136,733 | 0,56× |
| event-dispatch | 100 | 0,570 | 1,643 | 0,35× |
| event-dispatch | 1000 | 3,613 | 13,601 | 0,27× |
| listener-register | 100 | 0,298 | 0,221 | 1,35× |
| listener-register | 1000 | 8,928 | 1,308 | 6,82× |
| abort-lifecycle | 100 | 0,914 | 1,882 | 0,49× |
| abort-any | 100 | 0,388 | 0,693 | 0,56× |
| abort-propagation | 100 | 0,550 | 1,712 | 0,32× |
| abort-lifecycle | 1000 | 6,548 | 15,325 | 0,43× |
| abort-any | 1000 | 2,386 | 5,048 | 0,47× |
| abort-propagation | 1000 | 3,720 | 13,639 | 0,27× |

El ratio es mediana jsdom / mediana rustdom; solo valores mayores que uno
favorecen a rustdom. Se guardan todas las regresiones. Este estado híbrido no
satisface el objetivo de rendimiento: las transferencias y operaciones del host
siguen pesando en los caminos medidos. No se atribuyen diferencias entre corridas
separadas a una causa aislada ni se promete aceleración universal de suites.

## Validación final

La [validación completa](abort-signal/validation.json) aprobó formato, Clippy,
207 tests Rust, 639 contratos Node, 7 tests Jest, 18 Vitest y 26 Vitest VM.
HTML5 conservó 1.784 casos comparables aprobados y ocho casos de scripting
excluidos. El [WPT ejecutable](../compatibility/2026-09-13T18-18-03.043Z-linux-wpt.json)
mantiene 43.708 resultados en paridad: 42.678 aprobados por el estándar y 1.030
fallos compartidos. Range-deleteContents sigue bloqueado en el bootstrap de
jsdom; estos resultados no acreditan un corpus completo ni conformidad total.

Paquete, benchmark y memoria general registran el mismo binario nativo:
`d84e3954b3fdceee219a5aa503dac70a08de33eaf32e491789ca47b89d5fc1e5`.
