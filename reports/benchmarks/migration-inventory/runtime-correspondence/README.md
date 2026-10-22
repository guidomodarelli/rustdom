# Costo de generar el mapa de fuentes

Se ejecutó el CLI real del comparador, con dos procesos nuevos de warmup y cinco
medidos por Node 22.12.0/24.14.1. Todos los catorce procesos salieron con código
0 y produjeron los mismos bytes que la salida previamente validada. Se guardan
stdout, stderr y recursos GNU time en raw/, todas las duraciones en benchmark.json
y el método de medición en run-benchmark.py.

| Node | Mediana del comando completo | RSS máximo informado por GNU time |
| --- | ---: | ---: |
| 22.12.0 | 566,068 ms | 55.024 KiB |
| 24.14.1 | 516,177 ms | 59.248 KiB |

Incluye arranque de Node, lectura/verificación de 531 fuentes originales y sus
dos variantes, transformación esperada, hashing y escritura del JSON. No incluye
compilación ni carga del motor DOM; no llama al addon Rust. Son observaciones
absolutas del tooling en WSL2/i7-1360P, con entradas/caché de disco y versiones
registradas. No demuestran una mejora del producto ni una comparación entre
versiones de Node atribuible solo a V8.

RSS es el pico del comando que informa GNU time, no memoria retenida después
de GC. No se crearon Window o Document en este comparador; no se usa este dato
como prueba de ausencia de fugas del DOM. Los buffers y filas tienen un tamaño
limitado por el catálogo fijado y cada proceso termina después de escribir.
La preparación completa se autenticó antes y después en ambos Node.
