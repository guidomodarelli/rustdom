# CI completado sobre dd75a22c

El [run general 39839886220](https://github.com/guidomodarelli/rustdom/actions/runs/39839886220)
terminó success sobre dd75a22c9723f9a313badadfdae15cd8a39bd66d: ocho jobs
aprobados, tres sistemas operativos, cuatro shards y agregación. El
[job XMLSerializer 120038332754](https://github.com/guidomodarelli/rustdom/actions/runs/39839886242/job/120038332754)
también terminó success sobre ese SHA. Los pasos completos y sus resultados
están en run.json, windows-job.json y xml-run.json.

El log original del [job Windows 120037788326](https://github.com/guidomodarelli/rustdom/actions/runs/39839886220/job/120037788326)
se obtuvo del endpoint de logs de GitHub sin reejecutar el job. Se conservan
sus 633451 bytes, incluidos Unicode y un byte NUL, con su SHA-256 en receipt.json.
El Node efectivo de setup y ambos workers WPT fue 24.22.0. No se presenta como
la misma versión de las ejecuciones históricas 24.21.0 o 24.22.1.

Los dos diagnósticos de fixtures reales están extraídos en wpt-execution.json.
Range-mutations-dataChange compara 2808 resultados: referencia 31430.9888 ms,
candidato 14818.6822 ms; ambos procesos terminaron con exitCode=0. Son tiempos
diagnósticos de una suite de compatibilidad, no una medición que acepte el
presupuesto ownership. Los snapshots de memoria tras close no son GC final,
memoria pico ni una prueba absoluta de ausencia de fugas. El CI completo
incluye sus controles separados de memoria, paquete, runners y Valgrind.

Antes de preparar este reporte se comprobaron los 409 archivos del grafo
calificado contra sus bytes/SHA registrados. El snapshot medido sigue siendo
737a2ba1, con arnés 7ab4948d4f717b0cc7eaeb7c5e127f28e8417c63f667ed955a341c1fbb071981.
Esta publicación solo conserva evidencia y documentación fuera de ese grafo;
no cambia Rust, el runtime, el sampler ni los límites del gate.

El check ownership 39839886330 continúa rechazado: su archivo histórico no
corresponde a las fuentes actuales y tampoco tenía aceptación presupuestaria.
El ensayo seeded original sigue activo al preparar este reporte. No se repite,
no se infiere su resultado y no se concede merge/tag de ownership. Deben
preservarse ambos Node y todos los negativos antes de integrar evidencia nueva.
