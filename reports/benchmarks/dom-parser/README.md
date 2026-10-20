# Benchmarks DOMParser, wholeText y normalize

Ejecutados el 20/10/2026, después de finalizar las validaciones y Memcheck.
Comparan el estado publicado `b38f503` con la corrección de CharacterData
undefined, usando exactamente el mismo harness `benchmarks/dom-parser.cjs`.

Máquina: Intel Core i7-1360P, 16 CPUs lógicas, aproximadamente 8,1 GB de memoria
visible, Linux x64/WSL2 6.6.87.2. Rust 1.98.1 release, jsdom 27.4.0 independiente,
Node 22.12.0 y 24.14.1. Los reportes incluyen hardware, configuración, digest
de fuentes, binario y harness, junto con warmups y muestras crudas.

Por versión/estado hay dos invocaciones aisladas. Cada invocación ejecuta ambos
motores, dos warmups y siete muestras de cien operaciones por escenario.
Se agrupan catorce muestras para medianas y rangos descriptivos; no se consideran
catorce observaciones independientes ni se calculan intervalos de confianza.
El control jsdom muestra variaciones del proceso/JIT/entorno. La razón ajustada
por ese control es diagnóstica y no establece causalidad.

El tiempo incluye parseFromString completo o la operación DOM completa y su
puente. La creación del owner, GC, validación de cada resultado y teardown están
fuera del intervalo. Cada resultado permanece vivo hasta validarlo. `wholeText`
consulta cien nodos adyacentes por llamada; `normalize` opera sobre cien grupos
de cien Text por muestra. No se mide arranque frío, tiempo total de suites ni
memoria pico con este benchmark.

Medianas en milisegundos por cien operaciones; delta positivo indica más tiempo:

| Node | Escenario | Antes | Después | Delta |
| --- | --- | ---: | ---: | ---: |
| 24.14.1 | HTML pequeño | 40,440 | 40,311 | -0,32% |
| 24.14.1 | XML pequeño | 27,820 | 27,642 | -0,64% |
| 24.14.1 | XML malformado | 43,293 | 44,398 | +2,55% |
| 24.14.1 | Recuperación undefined | No compatible | 20,129 | No comparable |
| 24.14.1 | wholeText | 0,406 | 0,407 | +0,11% |
| 24.14.1 | normalize | 67,748 | 68,008 | +0,38% |
| 22.12.0 | HTML pequeño | 44,307 | 42,720 | -3,58% |
| 22.12.0 | XML pequeño | 28,590 | 28,679 | +0,31% |
| 22.12.0 | XML malformado | 45,424 | 45,098 | -0,72% |
| 22.12.0 | Recuperación undefined | No compatible | 19,778 | No comparable |
| 22.12.0 | wholeText | 0,437 | 0,439 | +0,50% |
| 22.12.0 | normalize | 68,604 | 67,003 | -2,33% |

El baseline falla al construir el Text undefined y no produce trabajo equivalente:
se conserva su fallo, sin inventar una duración comparable. La variante corregida
y jsdom sí validan ese resultado antes de aceptarlo.

Estas muestras no demuestran una mejora general. El parsing pequeño y normalize
siguen siendo más lentos que jsdom; normalize cuesta 3,57 veces en Node 24 y
2,31 veces en Node 22. Esa diferencia ya existía antes de este arreglo. En Node
22, el control jsdom de wholeText cambia aproximadamente 2,14 veces entre
grupos; no se interpreta su razón submilisegundo como una ganancia estable.

[comparison.json](comparison.json) reúne los ocho archivos originales, rangos,
controles y razones completas. El [manifiesto de evidencia](../../validation/dom-parser-final/evidence.json)
conserva sus hashes. No se descartaron muestras desfavorables.
