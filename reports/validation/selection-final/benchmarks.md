# Selection: benchmark de operaciones públicas

Medición 15/09/2026, Node 24.20.0, contra jsdom 27.4.0. Reporte crudo:
`reports/benchmarks/2026-09-15T19-56-52.404Z-linux-x64.json`.

Fuentes SHA-256 `0e0ea222f4b4fc094d8b77058127c0baa5599684848948e4fa163fa05723d3f8`.
Addon SHA-256 `560a6b42821d48f3d064594d52f099815c34fcb51b77bd30106ba9e274012cb9`.

Cuatro procesos secuenciales, orden alternado por motor, tres warmups y nueve
muestras por proceso: 18 muestras por motor/caso. Cinco operaciones, tamaños
100 y 1000. Fixtures y resultados equivalentes; validación de cada valor,
identidad y activación nativa fuera del tiempo medido. Incluye conversiones
WebIDL, cruces N-API, creación de Range y programación real de selectionchange.
El drenaje de tareas y cleanup queda fuera del tiempo medido. Hardware,
dependencias, muestras y metodología completa están en el JSON.

| Operación | Cantidad | jsdom mediana ms | rustdom mediana ms | jsdom/rustdom |
|---|---:|---:|---:|---:|
| selection-read | 100 | 0.127 | 0.801 | 0.159 |
| selection-associate | 100 | 0.419 | 1.661 | 0.252 |
| selection-extend | 100 | 0.561 | 2.259 | 0.248 |
| selection-contains | 100 | 0.224 | 1.152 | 0.194 |
| selection-stringify | 100 | 0.059 | 0.178 | 0.331 |
| selection-read | 1000 | 0.814 | 7.472 | 0.109 |
| selection-associate | 1000 | 3.149 | 15.979 | 0.197 |
| selection-extend | 1000 | 4.445 | 22.311 | 0.199 |
| selection-contains | 1000 | 1.74 | 9.976 | 0.174 |
| selection-stringify | 1000 | 0.239 | 1.177 | 0.203 |

Todos los ratios son menores que 1: esta implementación es más lenta en los
diez casos medidos. No satisface el objetivo de alto rendimiento. Las fuentes
y el addon coinciden con la suite y el paquete instalado anteriores. El HEAD
Git de la copia Linux es heredado: source-copy.json registra la base DCE real
y demuestra igualdad de las fuentes, sin atribuir el contenido a ese HEAD.

La migración de control mantiene compatibilidad en el corpus ejecutado;
reducir el costo del puente y las asignaciones requiere perfilado y otro
cambio medido. No se deduce una mejora ni una causa exclusiva de estos ratios.
