# Recursos de los lectores y la preparación de controles

Esta fase copia A0/A1/J0/J1 y dependencias autenticadas, sin cargar el addon,
crear Window/Document, ejecutar DOM, instalar o recompilar. El lector Python
abre ZIPs con context managers y conserva metadatos/digests y archivos acotados
al artifact fijado; no mantiene un cache creciente. Las copias síncronas de Node
cierran sus operaciones de archivos; los directorios propios de pruebas se
eliminan tras comprobar su ubicación. La prueba de hardlinks crea el alias solo
entre dos copias temporales propias y verifica su rechazo, sin cambiar controles
históricos. No demuestra aislamiento temporal de procesos: todavía no hay sampler.

Pasaron seis contratos de preparación por Node22.12.0/24.14.1 y seis del lector
por Python Windows/Linux. Las huellas de los inputs se comprueban antes/después;
la verificación final de la copia preparada pasó en ambos SDK. No se introducen
referencias persistentes N-API, caches DOM, observers, timers o listeners.

No se midió memoria pico ni se afirma ausencia universal de fugas. No hay nueva
evidencia de recolección de Window/Document en esta fase de transporte. Los probes
finitos del candidato real permanecen en reports/memory/range-combined-ci/ y se
evalúan por separado de rendimiento, inventario y esta revisión de recursos.
