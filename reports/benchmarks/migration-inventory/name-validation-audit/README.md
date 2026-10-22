# Costo del CLI con la auditoría de nombres

Se ejecutó el comando real `npm run inventory -- --output ...` con dos procesos
de warmup y cinco medidos por Node 22.12.0/24.14.1. Los catorce procesos nuevos
terminaron con exit 0 y todos sus catálogos coinciden con los digests de la
generación validada para su Node. No hubo reintentos ni selección de muestras.

| Node | Mediana del comando completo | Máximo RSS informado por GNU time |
| --- | ---: | ---: |
| 22.12.0 | 4.477,391 ms | 206.840 KiB |
| 24.14.1 | 3.324,200 ms | 254.368 KiB |

Incluye arranque de npm/Node, lectura, AST, observación de APIs, clasificación,
serialización y escritura. El fixture contiene 212 fuentes verificadas y
dependencias físicas. `benchmark.json` conserva muestras, comandos, versiones,
hardware WSL/i7-1360P y recursos. `raw/` guarda stdout/stderr/resources de cada
proceso; `run-benchmark.py` es el script ejecutado. Las fuentes permanecieron
estables antes/después. npm 11.11.0 y TypeScript 5.9.3 se registraron después.

Son tiempos absolutos del tooling, sin Rust ni aceptación de rendimiento DOM.
Son mayores que la observación anterior de strings (3.424,019/2.822,497 ms),
pero no hay un contraste A/A o A/B controlado entre ambas ejecuciones que
permita atribuir esa diferencia a la auditoría. Se conservan todos los datos;
no se afirma una mejora ni se oculta la observación más lenta.

RSS es el máximo informado por GNU time para el comando, no la suma simultánea
de sus procesos, heap retenido ni memoria del addon. No acredita ausencia de
fugas ni distingue por sí solo retención del allocator. El timeout de treinta
segundos no cambió.
