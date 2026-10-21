# Resultados del primer protocolo XML

A/A falló en 2/13 filas en Node 22 y 6/13 en Node 24. Se conservaron 128 muestras por etiqueta y fila; no se ejecutó A/B ni se aceptó el gate de rendimiento.

La tabla conserva todas las filas. A/A compara el mismo binario anterior; sus cambios son ruido/variación observada, no regresiones del candidato. Rust/jsdom es el cociente descriptivo de tiempos medianos de las llamadas públicas completas sobre DOMs preparados y reutilizados: mayor que 1 significa más lento. La diferencia de motores es grande en este corpus; el controlador nuevo no se presenta como una mejora de rendimiento.

| Tarea | Rows | A/A Node 22 | A/A Node 24 | Rust/jsdom Node 22 | Rust/jsdom Node 24 |
| --- | ---: | ---: | ---: | ---: | ---: |
| xml-serialize | 100 | 0.27% | -0.51% | 5.35× | 5.36× |
| xml-inner-serialize | 100 | -0.29% | -2.22% | 5.63× | 5.30× |
| xml-document-serialize | 100 | 2.03% | 2.18% | 5.68× | 5.03× |
| xml-serialize-error | 100 | -0.09% | -0.10% | 5.45× | 5.85× |
| xml-serialize | 1000 | -0.14% | 2.67% | 4.91× | 4.48× |
| xml-inner-serialize | 1000 | 0.69% | 0.57% | 4.88× | 4.99× |
| xml-document-serialize | 1000 | 0.11% | 2.51% | 4.82× | 5.01× |
| xml-serialize-error | 1000 | -1.33% | 0.18% | 5.50× | 4.96× |
| xml-serialize | 1 | -1.23% | -1.57% | 5.75× | 5.46× |
| xml-serialize | 16 | 0.74% | -1.10% | 5.22× | 4.92× |
| xml-serializer-getter-error | 1 | 4.30% | 8.27% | 4.19× | 4.28× |
| xml-serializer-getter-error | 100 | 0.93% | 3.84% | 4.90× | 4.99× |
| xml-serializer-getter-error | 1000 | -1.19% | 1.73% | 4.33× | 4.62× |

Los JSON por Node conservan todas las muestras de warmup y medición, hashes de salida, fuentes, hardware, procesos y deriva por mitades. El primer harness tiene sourceHash `1a391514f33f9aced15d6f461d618d18c77e199385d6e3a17be39eddb7a1790e`. Su fuente exacta está en `../../validation/xml-serializer-controller/sources-mixed-rows/`.

El diagnóstico siguiente está predeclarado en `row-isolated-protocol.md`. Los ejecutores archivados son one-off sobre copias frescas de fuentes sin resultados anteriores: no ejecutarlos sobre estos directorios históricos ni sobrescribir sus archivos; usar una nueva carpeta de ejecución.
