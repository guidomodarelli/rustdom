# Controlador de XMLSerializer: protocolo previo

El hito traslada a Rust el control público de `XMLSerializer.serializeToString`.
El algoritmo XML ya era Rust; `innerHTML`, `outerHTML` y `JSDOM.serialize` son
controles que conservan sus rutas anteriores. La referencia anterior es
`checkpoint-066-reference-catalog`: su producción es idéntica a checkpoint 65,
cuyo binario inmutable se identifica en `reference.json` de la validación.

Protocolo declarado antes de medir: Node 22.12.0 y 24.14.1, WSL/Linux, CPU lógica
2 fijada con `taskset`, sin builds, suites ni otras mediciones simultáneas. No se
modifica la política de energía del host. La afinidad del guest no controla por
completo el scheduling ni la frecuencia del host Windows.

Se conservan las ocho filas XML históricas (100/1.000 rows), se agregan
XMLSerializer de 1/16 rows y errores de getter tardío de 1/100/1.000 rows: trece
filas sin exclusiones. El corpus sigue usando los fixtures públicos compartidos.
Para reducir el costo relativo del reloj y el JIT inicial, se reutiliza un DOM
preparado e inmutable por fila y proceso: 16 batches de warmup y 32 medidos;
64/16/4/1 llamadas por batch para tamaños 1/16/100/1.000. Se publican todos los
tiempos de warmup y medición, sin eliminar outliers. No equivale a medir una sola
operación sobre un documento recién creado ni el tiempo de una suite completa.

Fuera del reloj se verifica el resultado completo, checksum, hash, contadores
nativos y liberación de las referencias temporales XML. Parsing, construcción,
validación y cierre quedan fuera; wrappers, controlador, puente y conversión del
resultado forman parte del tiempo. No se llama GC explícito dentro de los batches;
las pausas espontáneas de GC forman parte de sus muestras.

Primero se ejecuta A/A sobre el mismo runtime anterior, ocho procesos en orden
`A B B A B A A B`: 128 muestras por label y fila. Calibra si la diferencia de las
medianas agrupadas está dentro de ±2% en cada fila. Si falla, se conserva el fallo,
no se ejecuta la aceptación A/B y no se atribuye una diferencia a la migración.
Con A/A válido, A/B usa igual protocolo y presupuesto máximo de regresión de +5%
por fila; no se compensa una fila con otra. Ambos presupuestos son locales a esta
medición XML y no cierran el gate pendiente de clonado de otras ramas.

La comparación adicional contra jsdom 27.4.0 usa dos procesos por motor en orden
`jsdom rustdom rustdom jsdom`; es descriptiva, incluye las mismas verificaciones
y no sustituye la calibración de aceptación. Se conservan medianas por proceso
y por mitad para diagnosticar deriva. Los resultados no certifican rendimiento
en otras máquinas ni ausencia de fugas; la memoria se estudia por separado.

Los JSON de cada proceso conservan muestras y diagnósticos; `experiment.json`
identifica Node, hardware, fuentes, binarios, configuración, fases y presupuesto.
El ejecutor y sus comandos se archivan con los resultados para reproducirlos.

## Estado de aceptación

El primer protocolo terminó sin calibrar en ambos Node; no hubo A/B. Ver
[todas las filas y comparación descriptiva](mixed-row-results.md).
El [piloto aislado por fila](row-isolated-protocol.md) también falló en una fila
de Node 22 y se detuvo antes de A/B/Node 24. El gate de rendimiento sigue abierto;
no se acredita una mejora del controlador ni un checkpoint funcional.

El [warmup revisado](warmup-protocol.md), basado en
[diagnósticos GC/JIT/CPU](gc-diagnostic-protocol.md), permitió calibrar y aceptar
Node 22 en las trece filas (máximo A/B +2,522%). Node 24 falló A/A en dos filas;
ver [todos los resultados locales](warmup-256/README.md). El
[control siguiente de CI](hosted-protocol.md) conserva los budgets y el historial.
