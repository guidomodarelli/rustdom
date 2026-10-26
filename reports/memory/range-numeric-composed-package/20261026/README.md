# Teardown del paquete numérico reconstruido

Se ejecutó el runtime exacto del artefacto12628261403 tras archivar y extraer de
nuevo todos sus bytes. Node22.12.0 y24.14.1 Linux completaron seis ciclos cada
uno: fábrica numérica/copia/colapso nativos, rangos DOM públicos, mutaciones,
cierre con una referencia retenida y liberación posterior. El ELF hospedado
a2777cbf se autenticó antes de cargar el runtime en cada proceso.

Los12endpoints finales observaron Window, Document, rangos JS y wrappers nativos
por separado, sin supervivientes y con dos estados claros consecutivos. Los
logs completos conservan baselines, estados retenidos y liberados, contadores
nativos/N-API y snapshots de heap, memoria externa y RSS.

Node22 conserva la advertencia experimental de require(ESM) para parse5. El
runtime sigue híbrido; el probe no demuestra ausencia de delegación JavaScript.
Son pruebas finitas, sin timers de workload: no miden memoria pico, no otorgan
aceptación de rendimiento ni prueban ausencia universal de fugas. El ensamblador
Python solo conserva un diccionario de575archivos/≈8MB y hashes/resultados
acotados por el manifiesto; lee el grafo grande por chunks. No se ejecutó un
estudio de memoria pico del ensamblador.
