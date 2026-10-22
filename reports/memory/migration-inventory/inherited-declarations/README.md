# Retención del reporte de superficie con bases heredadas

Se ejecutó el helper real de memoria en Node 22.12.0 y 24.14.1 con `--expose-gc`.
Por Node se crearon y cerraron tres documentos, conservando sus tres reportes
JSON completos mientras se observaban Window y Document por referencias débiles
separadas. Los reportes ahora incluyen las 43 declaraciones heredadas adicionales.

Ambas versiones terminaron con cero Window y cero Document observados vivos y
dos estados claros consecutivos. `node22.json` y `node24.json` conservan las
trazas originales, heap JavaScript, memoria externa y RSS posteriores a GC;
`processes.json` conserva los comandos y exit 0 de cada proceso.

La ampliación conserva metadata escalar del receptor, lado de la herencia,
profundidad y nombre del constructor. Los objetos de prototipos permanecen
locales a la observación; el JSON resultante no los conserva. La prueba ejerce
esa liberación mientras mantiene los reportes, con la referencia independiente.

El alcance es finito, de tres ciclos por Node y realm por defecto. No se carga
el addon Rust ni se mide memoria pico; el RSS posterior a GC no demuestra por
sí solo fuga o retención del allocator. No acredita ausencia universal de fugas.
La [validación completa](../../../validation/migration-inventory/inherited-declarations/README.md)
conserva las fuentes y los resultados de tests y CLI.
