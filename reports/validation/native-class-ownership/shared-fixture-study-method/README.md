# QA del método prospectivo de ownership

No se ejecutó el estudio nuevo, no hay aceptación ni muestras nuevas de
rendimiento. Los contratos ejercen anotación, identidad, plan completo,
derivación/autenticación y rechazos sobre datos reales guardados. Los wrappers
no se presentaron como una ejecución end-to-end de la secuencia todavía pendiente.

Pasaron 15 contratos por Node22.12.0/24.14.1, preflights de la preparación
oficial en ambos binarios y actionlint de los dos workflows. Los preflights
finales son idénticos y conservan el grafo de 434 archivos original. Los logs
anteriores, todos aprobados, documentan los cambios previos a la publicación;
no son reintentos de una captura científica. Los preflights están comprimidos
sin modificar sus bytes. No se cargó DOM ni se volvió a capturar CPU/GC/JIT.

El sampler derivado debe ser byte-idéntico al calificado en 8ea5f569. Solo
se reemplaza el wrapper externo de identidad. Los tests rechazan sustituir
fuentes o el wrapper, PID/Node, mezclar reportes funcionales/históricos, omitir
Window, usar un solo binario para dos perfiles, ejecutar fuera del host o
reintentar. También preservan muestras y registros durante la anotación.

La prueba de representación del colector conserva 720 duraciones y RNG/hashes
de los 80 reportes reales. Sus tamaños JSON no equivalen a medición de memoria.
El informe está en reports/memory/shared-fixture-study-method.*.

El protocolo completo está en
reports/benchmarks/native-class-ownership/shared-fixture-study/PROTOCOL.md.
Ownership histórico sigue accepted=false. La etiqueta exclusiva del estudio
nuevo no se creó ni se aplicó. No hay tag ni merge.
