# Muestras de la calificación funcional del worker derivado

`spans.csv` conserva los 960 spans de la única matriz funcional: 240 warmup y
720 medidos, 80 procesos, Node 22.12.0 y 24.14.1. Incluye paquete físico, carga,
tamaño, seed, fase, posición, inicio, duración y hash público. No se excluyó
ninguna fila o muestra. No se calcularon ratios, medianas ni aceptación.

El método está en `shared-fixture-worker/`; host, logs, todas las muestras,
identidades y manifiestos originales están en
`reports/validation/native-class-ownership/shared-fixture-worker/`. El archivo
completo permite reproducir la lectura sin ejecutar el sampler ni código
archivado. Los resultados de memoria están en `reports/memory/shared-fixture-worker.*`.

Esto califica el comportamiento de una variante del harness con consumidores
compartidos. No constituye un nuevo estudio de aceptación ni demuestra una
mejora de rendimiento o estabilidad de JIT. El rechazo histórico de ownership
permanece vigente y esta variante tiene `performanceAccepted=null`.
