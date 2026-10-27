# Memoria del estudio XML con inputs completos

La preparación `594a44a8-95c6-40a4-ac90-6421e12c3ef8` se probó en Node 24.14.1
antes de medir. `functional.json` del archivo original conserva 15 Window y
15 Document observados por separado, tres ciclos por copia física A0/A1/B/J0/J1.
El verificador real confirmó identidad, aislamiento y los dos endpoints claros.

Los 442 workers del motor híbrido rustdom conservan contadores de sesiones XML
`live=0`, `references=0` y `cleanupErrors=0`. Son endpoints de sesión, no prueba de
recolección de todos los Window/Document del benchmark. Hay otros contadores
nativos no nulos, incluido `xmlParsers.live=1` en workers reales; no se presentan
como liberación completa ni se los declara una fuga a partir de ese dato aislado.

La observación débil de owners pertenece al probe separado de 15 por tipo.
Los snapshots RSS/heap/external no son memoria pico ni una prueba de ausencia
universal de fugas. El nuevo lector solo lee datos y ejecuta verificaciones de
metadatos; no crea DOM ni dispara GC. La aceptación de rendimiento sigue false.

Los crudos íntegros y hashes están en
reports/benchmarks/native-class-ownership/xml-full-inputs-results/39896591561/.
