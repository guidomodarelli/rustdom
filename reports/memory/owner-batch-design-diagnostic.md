# Recursos del diagnóstico offline de diseño

El código nuevo lee únicamente datos autenticados del estudio 40184510898. No
carga DOM/addons, ejecuta workers archivados ni crea referencias a Window o Document.
Las listas contienen 2048 procesos, 24576 duraciones y 128 grupos fijados por el
contrato. Las entradas tienen límite de 16 MiB; no hay caches globales crecientes,
callbacks persistentes, listeners ni timers del producto. El estado de análisis
termina con cada CLI. Esto limita el alcance; no es una medición de memoria pico
ni una garantía universal sobre fugas.

El verificador Node calcula el SHA del SDK con un único buffer de 1 MiB y cierra
el descriptor en finally. El resto son lecturas acotadas y estructuras locales.
Los tests usan directorios propios, verifican su ubicación antes de limpiarlos y
preservan el output ajeno de la prueba CLI. Windows/Linux y ambos SDK verificaron
los datos completos y los casos adversariales publicados en
reports/validation/owner-batch-design-diagnostic/20261025/.

No se repitieron probes DOM: el addon no cambió. Su evidencia de liberación finita
sigue en reports/memory/static-range-owner-batch/20261025/. La futura medición por
bloques requiere validar la disposición de las 16 fixtures, errores y entregas
asíncronas, Window/Document separados, familias y baselines nativos, tres rondas y
dos estados finales claros, antes de recoger muestras. Esa implementación aún no
existe y no se acredita aquí como completada.
