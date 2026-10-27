# Memoria y recursos de la captura con profiler

Diez procesos reales separados, ocho cargas por proceso, Node 22.12.0/24.14.1.
Se observaron 960 referencias Window y 960 Document, incluidos los warmups.
De 240 observaciones de cleanup, las 160 finales exigidas quedaron claras
para ambos tipos y baselines nativos. Se conservan ocho observaciones iniciales
aún no claras; no son ocho objetos únicos ni una estimación de fugas.

GC y spans se guardan como escalares. El observer se drena y desconecta incluso
si falla el sampler; la regresión real de ese camino se validó antes de esta
captura. Los procesos fueron acotados y terminaron correctamente; perfiles y
buffers de V8 duran hasta la salida. No se compara su RSS con un proceso sin
profiler como si eso aislara memoria de Rust.

Los crudos incluyen heapUsed/external/RSS después de GC y los 3.552 eventos GC.
El solapamiento temporal observado en 24 intervalos no mide una fuga ni atribuye
causas de los tiempos. No se mide memoria pico ni se demuestra ausencia universal
de retención. Los resultados pertenecen al host local WSL y a los escenarios
del protocolo; no certifican otros workloads o el runner Azure.

Artefacto completo, metodología, preparación y hashes en
`reports/validation/native-class-ownership/sampler-diagnostics-capture/`.
