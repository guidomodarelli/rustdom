# Recursos del warmup por ventana

Los tests reales de Node22/24 ejecutan16 lotes de integración y40 de workers
por versión:1344 observaciones Window y1344 Document en total, incluyendo
warmups externos, con objetivos separados. Cada worker conserva tres rondas
de cleanup y exige las últimas dos claras. Las pruebas funcionales usan el
endpoint acotado existente y también exigen dos estados claros.

Los hosts temporales de observer son hermanos de las fixtures medidas. Se
desconectan todos los observers y se eliminan los hosts en finally; se prueba
también fallo controlado de validación mediante un adapter propio con observer
real. El frame retorna antes de dos GC major asincrónicos y del timer original.
No hay cache de Window, métodos o wrappers. Los rangos temporales quedan para
GC; los contadores reales comprueban las asignaciones de las cuatro rondas y
el endpoint posterior exige baseline nativo, incluidos registros y listeners.

Los reportes conservan heapUsed, external, arrayBuffers y RSS post-cleanup.
No miden picos ni prueban ausencia absoluta de fugas. Los1008 tiempos son
funcionales; no se atribuye una mejora de memoria o rendimiento. Preparación,
fuentes y crudos están en realm-warmup-method/qualification.tar.gz.
