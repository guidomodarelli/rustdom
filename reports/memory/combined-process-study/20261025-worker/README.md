# Recursos de la calificación funcional

64 procesos; 768 Window y 768 Document observados por separado. Cada proceso
conserva tres rondas y dos estados finales claros consecutivos, con cero
supervivientes de ambos owners. En 8 procesos la primera ronda
no estaba clara; sus observaciones no se descartan. Se conservan snapshots
de cada cleanup, snapshots tras los spans medidos, contadores nativos donde
el workload los expone y tres snapshots del padre.

Los contadores nativos conservan los baselines de clases registradas en el
módulo; no se interpreta una clase de módulo aún registrada como una Window
viva. La verificación usa los criterios del sampler original. Estas pruebas
finitas no demuestran ausencia universal de fugas. RSS/heap/external son
snapshots y no memoria pico; tampoco atribuyen una variación a una fuga
o distinguen por sí solos retención del allocator de objetos aún vivos.

No hubo captura científica ni aceptación de rendimiento. El runtime sigue
híbrido. Los datos crudos y controles están íntegros en el paquete de evidencia.
