# Preparación sin captura y regresiones del lector individual

Solo se generaron copias de fuentes y se leyeron datos existentes. No se ejecutó
DOM, sampler, Inspector ni profiling nuevo. Los 512 procesos son una propuesta
del planner, no procesos lanzados ni muestras obtenidas. El método de captura
sigue sin implementarse y no se pidió autorización nueva.

## Pruebas vigentes

- Cuatro contratos Python: derivaciones CPU/JIT reales, todos sus hashes y el
  subárbol calificado, grafo falsificado con hash externo reutilizado, output
  existente preservado y rechazo de Python optimizado. Cada fuente original
  conserva su hash antes/después.
- Ocho contratos por Node 22.12.0 y 24.14.1: plan íntegro sin alterar la agenda
  original; cuatro perfiles históricos CPU/JIT contrastados campo a campo con el
  lector anterior; rechazo de identidades/revisiones prestadas y de un reporte
  jsdom corrupto que intenta declarar Rust sin baseline nativo. Rechazan además
  rondas de liberación ausentes, incompletas o relajadas, reducción de spans,
  batches incompletos y omisión de observaciones Window/Document.
- Los perfiles de lectura proceden del diagnóstico jsdom `39959175058`; nunca se
  presentan como ejecución del profiler Rust propuesto. No hay validación
  end-to-end de un wrapper nativo nuevo.

Los logs finales del lector llevan sufijo `owner-observations-final`; los
anteriores se conservan junto con los logs Python completos. Un P2 de review
detectó que una traza vacía podía superar `every()` por vacuidad; el lector ahora
exige las tres rondas, los dos finales claros y los counts 3/9 canónicos antes
de afirmar retorno de recursos. No acepta los requisitos que declare el input.
Los tests se ejecutaron en Linux/WSL, con los dos Node fijados y Git real.

## Derivaciones conservadas

Los recibos `cpu-preparation-reader.json` y `jit-preparation-reader.json` son los
de la preparación actual. Ambos generan el mismo sampler combinado:
`1b773c7bc03beb024501602620fb7000efa3f220a2f35eb21145e421884bdb07`.
El sampler compartido intermedio coincide con el ya calificado `d24c7282…`.
Cada recibo contiene todos los hashes de archivos derivados y los patches se
guardan íntegros en gzip. `source-manifest.json` es el input original autenticado.

Los recibos sin sufijo `reader` conservan la preparación anterior a ampliar el
lector/policy. `initial-cpu-preparation-superseded.json` conserva una versión de
preparación aún anterior: renombraba también el wrapper del subárbol calificado.
Eso dejaba ese recibo intermedio sin el nombre de archivo esperado; se corrigió
antes de las pruebas vigentes conservando el wrapper en su subárbol de referencia.
No hubo proceso medido, datos de ejecución ni aceptación en ninguna versión.
No usar esos snapshots anteriores como prueba del output vigente.

Los recibos intermedios describen el estado anterior a componer los hooks; el
recibo final describe el árbol resultante. Son provenance de transformaciones
de código, no resultados de rendimiento. Los scripts del árbol generado no se
ejecutaron ni deben ejecutarse para repetir estas comprobaciones.

No se cambiaron los 26 pins, las 434 fuentes congeladas, el runtime ni sus rutas
de memoria. No hay evidencia nueva sobre fugas, memoria pico o rendimiento:
el rechazo existente y el objetivo general permanecen pendientes.
