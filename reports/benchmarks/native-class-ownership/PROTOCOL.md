# Coste de la corrección de ownership N-API

Protocolo declarado antes de medir. El cambio corrige liberación en rutas de
error de construcción; no se presenta como una optimización de rendimiento ni
como una migración adicional de APIs DOM.

Se reutilizan los fixtures públicos y el ejecutor normal de benchmarks. Las
cargas son `range-control-1000` y `range-state-lifecycle-1000` (250/1.000 filas),
`mutation-records-collect` y `observer-delivery-records` (100/1.000). Son ocho
filas que ejercen creación/copia de clases nativas y sus consumidores públicos.
El último caso incluye entrega real de microtasks y callbacks.

Se comparan la referencia inmutable de checkpoint 67 y el candidato con solo
el parche del SDK, en Node 22.12.0 y 24.14.1, Linux/WSL y CPU 2. Antes de medir
deben terminar builds, tests y Memcheck locales. No se ejecutan simultáneamente
otras cargas de medición. Se registran hardware, fuentes, binarios y versiones;
la afinidad del guest no controla por completo el host Windows.

Por versión se fijan ocho bloques completos, en orden A B B A B A A B, donde A
es la referencia y B el candidato. Cada bloque usa el CLI real, que alterna
jsdom/Rust en procesos independientes y conserva tres warmups y nueve muestras
medidas por proceso. Los cuatro bloques de cada etiqueta aportan 72 muestras
Rust por fila; los procesos jsdom independientes son controles del host y la
referencia de compatibilidad. No se filtran muestras ni se prolonga la corrida
en función de sus resultados.

Se verifican todas las salidas y hashes antes de comparar medianas, junto con
medianas por proceso y dispersión. Se señala para investigación una degradación
superior al 5% por fila. El control jsdom entre etiquetas exige ±2% para
interpretar diferencias pequeñas como efecto del parche. Si no calibra, el
resultado se publica como inconcluso para ese presupuesto: no se relaja, no se
seleccionan filas ni se repite hasta obtener una corrida favorable.

La prueba principal del bug es su regresión de liberación, que falla con el SDK
anterior y pasa con la corrección aislada, más los tests del guard real. Estas
mediciones documentan el coste completo de consumidores equivalentes y no
certifican aceleración global, otras máquinas ni ausencia universal de fugas.
Una regresión reproducible requiere investigación antes de integrar el parche.

La base se actualizó de checkpoint 66 a 67 antes de ejecutar la primera muestra,
tras integrar el PR 79. Ambos motores incluyen el mismo controlador XML; el
tratamiento medido queda limitado al ownership del SDK. Se conserva la evidencia
previa de fugas y tests sobre la base 66 como registro, sin mezclarla con los
tiempos de la base 67.
