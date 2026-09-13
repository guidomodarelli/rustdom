# Optimización de recorridos nativos

El hito anterior ejecutaba start y step a través de N-API y creaba una operación
JavaScript por movimiento, incluso sin filtros. Este cambio mantiene los algoritmos
de navegación en Rust y reduce el protocolo necesario para ejecutarlos.

- traversalMove usa una operación temporal en el stack cuando no hay filtro. Devuelve
  un identificador positivo, cero al terminar o el sentinel de reentrada; no crea un
  objeto NativeTraversalOperation ni retiene una operación pendiente.
- traversalResumeStep consume la respuesta y consulta la topología viva en una sola
  llamada. La limpieza de active sigue ocurriendo antes de la conversión WebIDL.
- El host reutiliza como máximo una operación inactiva por cursor con filtro. Mientras
  una llamada la usa, las llamadas reentrantes toman otra. Al salir, incluso al lanzar,
  queda una sola operación en el cache. El cursor sin filtro no utiliza ese cache.
- traversalRestartStep valida cursor y forest antes de descartar el estado anterior.
  No consulta el candidato abandonado, que puede haberse eliminado y recolectado.
- createdOperations es acumulativo: permite comprobar asignaciones sin depender de
  cuándo corran los finalizadores. operations conserva el número de objetos vivos.

Los nuevos contratos verifican todos los movimientos y máscaras, reentrada sin
candidato, identidad de cursor/forest, consumo único de respuestas, reinicio con
candidatos ya liberados y reutilización después de excepciones. El análisis de memoria
conserva los cursores y comprueba por separado que sus candidatos abandonados se
liberen. Un cache de un objeto numérico por cursor vivo no se presenta como memoria
liberada antes de soltar el cursor; después se exige volver al baseline.

## Diagnóstico y primera medición

Se guardaron cuatro perfiles V8 con el binario del hito anterior y sus análisis en
reports/benchmarks/2026-09-13T21-24-*. Los perfiles incluyen creación de cursores,
validación y turnos de event loop. Las funciones nativas aparecen atribuidas a
boundaries V8; no se deduce de sus nombres un stack Rust preciso ni causalidad
por función. No son sustitutos del benchmark comparativo aislado.

La [base publicada](../benchmarks/2026-09-13T21-18-41.209Z-linux-x64.json) y la
[primera variante](../benchmarks/2026-09-13T21-31-54.831Z-linux-x64.json) usaron
los mismos cuatro workloads y tamaños. Antes de reutilizar operaciones con filtro,
los recorridos sin filtro de 1.000 filas bajaron de 13,325/13,549 ms a 6,927/6,799 ms
para NodeIterator/TreeWalker. Con filtro bajaron de 14,025/14,251 ms a 12,832/12,883 ms.
Es una mejora respecto de rustdom anterior; sigue siendo más lento que jsdom.

La primera variante pasó 206 contratos focales, el corpus WPT de recorridos y
ocho ciclos de GC. La variante con reutilización pasó 208 contratos focales,
los mismos 1.598 resultados WPT en paridad y ocho ciclos de memoria con candidatos
abandonados. Retiene dos operaciones mientras los dos cursores con filtro siguen
vivos y vuelve al baseline al liberarlos; los candidatos abandonados se recolectan
incluso mientras los cursores se conservan.

La [segunda medición](../benchmarks/2026-09-13T21-40-01.594Z-linux-x64.json) registró
6,987/7,147 ms sin filtro y 11,730/11,371 ms con filtro para NodeIterator/TreeWalker
de 1.000 filas. Incluye el contador acumulativo de asignaciones. Se conserva la
variación respecto de la primera medición, sin escoger solo el mejor resultado.

El estado final centraliza las comprobaciones de cursor/forest y compara sus tokens
sin clonar Weak en cada paso. Los tokens débiles mantienen distintas las identidades
de sus asignaciones; las direcciones se comparan, nunca se desreferencian. Los mismos
tests de rechazo antes de mutar cubren este contrato. Está en curso la validación
general, de instalación, memoria y medición de ese estado final.

## Validación final

[La validación general](traversal-performance/validation.json) pasó formato, Clippy,
218 tests Rust, 1.118 Node, 7 Jest, 18 Vitest y 26 Vitest VM. HTML5 conservó sus
1.784 casos comparables y ocho exclusiones de scripting. El [corpus WPT completo
ejecutable](../compatibility/2026-09-13T21-48-48.772Z-linux-wpt.json) produjo 45.306
resultados en paridad, con 44.250 aprobados por el estándar y 1.056 fallos compartidos.
Range-deleteContents continúa bloqueado por el bootstrap de la referencia.

El [GC focal final](../memory/2026-09-13T21-51-28.684Z-tree-traversal.json) pasó ocho
ciclos. El [estrés general](../memory/2026-09-13T21-52-49.514Z-linux-x64.json) aprobó
los cinco modos; rustdom liberó 1.322 documentos y 882 ventanas, y cada modo Vitest
liberó 1.320 documentos y 880 ventanas. Contadores de cursores/operaciones y otros
recursos nativos volvieron al baseline. Se guardan deltas RSS de 12,93 MiB, 42,16 MiB
y 44,36 MiB para rustdom, vitest y vitest-vm; no se afirma que el RSS vuelva a cero.

[Memcheck](../memory/2026-09-13T21-52-49.000Z-traversal-performance-valgrind.log)
ejecutó los cuatro tests del núcleo con cero errores y cero bytes definitivamente
o indirectamente perdidos. Conserva 48 bytes posiblemente perdidos y 544 alcanzables
de std/libtest, sin supresiones. Los controles finitos no demuestran ausencia
absoluta de fugas; el contrato probado incluye la retención acotada del cache.

El archivo preparado tiene SHA-256
`7fc5275afde1bdba7fed8a626e7ed193086b4ee45d67af970ae32aa4a9d246c1`; su binario es
`8597721c7e7ed0f39218276a4eb9f494df5ca0a5af7276a95e2bbb4c36b32597`.
Ese archivo pasó 18 controles en [Node 24](../distribution/2026-09-13T21-54-03.212Z-linux-x64.json)
y 18 en [Node 22](../distribution/2026-09-13T21-56-07.093Z-linux-x64.json): instalación
npm/pnpm, tipos, CJS/ESM/VM, Unicode, workers y runners reales. Los 11 tests del arnés
de benchmarks también pasaron. El hito queda validado localmente para publicar;
el checkpoint en main requiere además CI y revisión del SHA.

## Medición final

El [benchmark final](../benchmarks/2026-09-13T22-01-40.458Z-linux-x64.json) usó el
mismo binario que los paquetes instalados. Conserva 18 muestras por motor/operación,
dos procesos por motor, tres warmups y orden alternado. No hubo compilaciones,
tests ni controles de memoria concurrentes. Las identidades de todos los nodos y
los callbacks se validaron fuera del tramo medido.

| Operación | Filas | jsdom ms | rustdom ms | Ratio |
|---|---:|---:|---:|---:|
| iterator-scan | 100 | 0,366 | 0,604 | 0,61× |
| iterator-filter | 100 | 0,326 | 1,140 | 0,29× |
| walker-scan | 100 | 0,303 | 0,581 | 0,52× |
| walker-filter | 100 | 0,335 | 1,099 | 0,30× |
| iterator-scan | 1000 | 3,153 | 6,966 | 0,45× |
| iterator-filter | 1000 | 3,086 | 11,783 | 0,26× |
| walker-scan | 1000 | 2,419 | 6,928 | 0,35× |
| walker-filter | 1000 | 2,711 | 11,878 | 0,23× |

Ratio = mediana jsdom / mediana rustdom. Frente al hito anterior, los tiempos de
1.000 filas se reducen 48–49% sin filtro y 16–17% con filtro. Se preservan las
variaciones entre las mediciones intermedias y la final. Sigue siendo entre 2,2 y
4,4 veces más lento que jsdom en esas cargas; no se declara lograda la meta global
de rendimiento ni la migración completa del motor.
