# Endpoints del benchmark ordinario

El grupo de cuatro shards conserva 11.952 snapshots en 1.328 registros de workload
y proceso. Son datos de Node 24.21.0 del runtime híbrido actual, no del candidato
de ownership ni de su captura fijada a Node 22.12.0/24.14.1.

Los snapshots incluyen RSS, heap JavaScript, memoria externa y ArrayBuffers después
de cerrar el DOM, ceder un turno del event loop y solicitar GC. La secuencia comparte
proceso entre workloads; no hay un baseline por caso que permita atribuir deltas
al algoritmo ni distinguir universalmente retención del allocator y fugas.
Tampoco representa memoria pico ni demuestra por sí sola recolección separada de
Window y Document. Los campos adicionales de realm de los workloads que los tienen
se preservan íntegros, sin extender sus conclusiones a las demás filas.

Los datos completos están en
reports/benchmarks/ci-validation/40191262985/memory-endpoints.jsonl, con hash en
observations.json y muestras originales dentro de los ZIP de transporte. El lector
solo leyó los resultados existentes; no añadió mediciones ni aceptó rendimiento.
