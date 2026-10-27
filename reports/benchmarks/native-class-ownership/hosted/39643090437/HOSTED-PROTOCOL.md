# Comprobación independiente de la carga pública de Range

Se declara antes de ejecutar en el runner. Los resultados WSL originales, el
A/A sin calibrar, los perfiles y el microdiagnóstico siguen publicados. La
hipótesis pendiente es si el +9,41% de `range-control-1000/1000` en Node 22
se reproduce en Linux independiente, sin el host Windows/WSL. La superposición
con compilación de fondo observada no demuestra causalidad ni CPU consumida.

Un job Ubuntu 22.04 construye checkpoint 67 y el candidato con Node 22.12.0,
Rust 1.99.1 y sus lockfiles. Verifica ambos hashes canónicos de fuentes. Usa la
primera CPU permitida; registra hardware, binarios, commits y SHA solicitado.
No modifica el workload público, el JIT, la política de energía ni la GC.
No ejecuta builds ni tests simultáneos dentro del runner durante las medidas.

Se ejecutan exactamente ocho bloques A B B A B A A B de A/A, seguidos de ocho
de A/B, sin ampliar muestras ni reintentar según resultados. A/A carga la misma
referencia en ambas etiquetas. A/B carga el candidato únicamente en B. Cada
bloque usa `benchmarks/compare.cjs range-control-1000`: cuatro procesos nuevos
jsdom/Rust/Rust/jsdom, tamaños 250 y 1.000, tres warmups y nueve muestras. Son
64 procesos, 1.152 duraciones y 72 muestras por fase/etiqueta/motor/fila.
Se conserva íntegro el coste público: bindings, realms, algoritmo y N-API.

El A/A exige ±2% jsdom y ±5% Rust en ambas filas. El A/B conserva ±2% para el
control jsdom y un máximo de +5% Rust. Solo se acepta este protocolo si todas
las filas calibran en A/A y cumplen A/B. Si no calibran, queda inconcluso; si
calibran y exceden +5%, requiere corregir la regresión. Se mide el A/B completo
aunque el A/A no calibre, pero no se presenta como aceptación independiente.
El job falla al no cumplir y conserva todos los resultados, sin reruns para
elegir una corrida favorable. Fallos de infraestructura se distinguen de un
experimento estadístico completo y conservan sus salidas parciales.

El verificador recalcula agregados, cantidad de muestras, salidas idénticas y
hashes de cada archivo. Antes del checkpoint deben descargarse y verificarse
los artefactos. Una aceptación se limita al host/protocolo declarado y no borra
el resultado WSL ni demuestra velocidad global o ausencia universal de fugas.
