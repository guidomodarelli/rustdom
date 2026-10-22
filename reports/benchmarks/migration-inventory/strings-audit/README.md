# Costo del inventario con la auditoría de strings

Se ejecutó el CLI real `npm run inventory -- --output ...` en Node 22.12.0 y
24.14.1 sobre una copia Linux con 208 fuentes verificadas y dependencias físicas.
Por Node: dos procesos de warmup y cinco medidos, todos nuevos y sin reintentos.
Se conservaron catorce stdout/stderr/resources y se verificaron los cinco digests
de cada catálogo contra la generación previamente validada para ese Node.

| Node | Mediana del comando completo | RSS máximo informado por GNU time |
| --- | ---: | ---: |
| 22.12.0 | 3.424,019 ms | 207.080 KiB |
| 24.14.1 | 2.822,497 ms | 252.692 KiB |

Incluye arranque de npm/Node, lectura de referencia, AST, observación de APIs,
clasificación, serialización y escritura. No ejecuta Rust ni mide rendimiento
del motor DOM. Los tiempos son una observación absoluta; no se presentan como
mejora o regresión respecto de muestras anteriores. RSS es la medida del comando
informada por GNU time, no memoria simultánea sumada de todos sus procesos,
heap retenido, memoria del addon ni evidencia de fuga.

`benchmark.json` conserva cada duración, exit code, recursos, comando, versiones
Node/V8 y hardware WSL2/i7-1360P. `run-benchmark.py` es el script ejecutado.
Los logs completos están en `raw/`. Las fuentes permanecieron estables antes
y después; `versions-observed-after.json` registra npm/TypeScript después del ensayo.
No se relajó el timeout del CLI de treinta segundos.
