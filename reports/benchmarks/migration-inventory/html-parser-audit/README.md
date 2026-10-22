# Costo del CLI con la auditoría del parser HTML

Se ejecutó `npm run inventory -- --output ...` en catorce procesos nuevos:
dos warmups y cinco medidos por Node 22.12.0/24.14.1. Todos terminaron con exit 0
y verificaron cada digest contra el catálogo validado para ese Node. No hubo
reintentos, selección de muestras ni modificación del timeout de 30 segundos.

| Node | Mediana del comando completo | Máximo RSS informado por GNU time |
| --- | ---: | ---: |
| 22.12.0 | 4.378,476 ms | 208.764 KiB |
| 24.14.1 | 3.875,397 ms | 250.500 KiB |

Incluye arranque npm/Node, lectura, AST, observación de APIs, clasificación,
serialización y escritura. Se usaron 217 fuentes verificadas y dependencias
físicas. `benchmark.json`, `raw/` y el script ejecutado conservan muestras,
comandos, stdout/stderr/resources, hardware WSL/i7-1360P y versiones. Las fuentes
permanecieron estables antes/después. npm 11.11.0 y TypeScript 5.9.3 se
registraron después; no se ejecuta el addon Rust durante el CLI.

La observación anterior de nombres fue 4.477,391/3.324,200 ms: ahora Node22
es menor y Node24 mayor. Estas ejecuciones no son un contraste controlado entre
versiones del tooling; no permiten atribuir una mejora/regresión a la nueva
fila del audit. Se conservan todos los resultados sin afirmar una optimización.

Este benchmark no mide parseo HTML, costo N-API ni aceptación del rendimiento
DOM. El máximo RSS informado por GNU time no suma memoria simultánea de los
procesos ni equivale a heap retenido, memoria del addon o evidencia de fuga.
