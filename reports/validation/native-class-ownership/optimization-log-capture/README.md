# Archivo completo de logs V8 y lectura

La captura única está terminal con cuatro workers exit0. El archivo conserva
423 inputs/resultados del índice, snapshot de seis fuentes del método,
387 originales y todos los logs, PIDs, flags, reportes y verificaciones.
Se conservan también las lecturas anteriores y la lectura final, sin repetir
la captura. `raw-files.json` y `receipt.json` autentican todos los bytes.

El ledger de 138.028 encabezados está en reading-v3/headers.jsonl y la lectura
Windows equivalente en reading-windows/. Son idénticos. Los payloads verbose
se mantienen en stdout/stderr originales; no se convierten en eventos nuevos.
El índice de captura es copia exacta en capture-index.json. Las observaciones
y todas las categorías están en el informe de benchmarks equivalente.

La raíz local /tmp/rustdom-optimization-capture-zyog41xf y session49422/PID494010
son terminales; no reiniciar. El marker sigue consumido. El launcher, insumos,
resultados y lector no habilitan reinterpretar tiempos instrumentados como
aceptación. No hay merge/tag ni nueva migración Rust por esta evidencia.
