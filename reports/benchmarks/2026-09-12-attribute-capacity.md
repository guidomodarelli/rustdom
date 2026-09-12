# Coste de compactar y recrecer los índices de atributos

Se compararon dos addons release de la misma base `0f40cc06e7f25cac80d3b656e48528f1eaa43fba`: el original y el candidato con compactación y protección contra tombstones. Se ejecutaron solos, después de pausar builds/tests de los otros agentes. La medición usa dos procesos nuevos por addon, orden alternado, tres warmups y nueve muestras por tamaño en cada proceso: 18 muestras por tamaño y addon, sin excluir outliers.

| Atributos | Fase | Base, mediana ms | Candidato, mediana ms | Base / candidato |
|---:|---|---:|---:|---:|
| 32 | Inserción | 0,07025 | 0,07029 | 0,999x |
| 32 | Eliminación | 0,07911 | 0,07214 | 1,097x |
| 32 | Ciclo completo | 0,15800 | 0,14285 | 1,106x |
| 1024 | Inserción | 43,02027 | 42,57974 | 1,010x |
| 1024 | Eliminación | 42,66424 | 43,09534 | 0,990x |
| 1024 | Ciclo completo | 85,52249 | 85,47871 | 1,001x |

El ciclo completo de 1024 atributos quedó prácticamente igual en esta muestra; la eliminación fue alrededor de un 1% más lenta, mientras que la inserción fue alrededor de un 1% más rápida. No se oculta el coste de volver a asignar tablas compactadas: la fase de inserción y el ciclo completo lo incluyen. El ciclo de 32 atributos tuvo menor mediana observada, pero esta prueba sintética en una máquina no permite generalizar una mejora a suites de Jest/Vitest.

Se miden las llamadas N-API reales, índices y actualización de metadata. Se excluyen carga de módulos, preparación inicial de handles/valores, comprobaciones entre fases y liberación final de handles. El ciclo completo es la suma de las fases cronometradas. Se comprueba la cantidad insertada y luego la lista vacía, serialización, ownership y liberación de nodos.

Los hashes de ambos binarios, hardware, versión Node y todas las muestras están en `2026-09-12T02-44-42.020Z-attribute-capacity.json`. El candidato ejecutado tiene SHA-256 `362cfe5c52d0b989eaa4e87006e470211fc1a52547594416741e58b356cd627f`. Los resultados de liberación de capacidad y memoria se conservan por separado en `reports/memory/`.
