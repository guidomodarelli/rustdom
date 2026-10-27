# Alcance de recursos del replay de procesos

El lector solo interpreta JSON funcional histórico. Reutiliza el contrato que
observa Window y Document por separado, exige tres rondas y dos estados finales
claros, verifica memoria escalar y descarta baselines nativos inventados en jsdom.
La validación de datos rechaza retención; no ejecuta otra vez los procesos.

Los 32 casos preservan 384 observaciones Window y 384 Document del dataset
funcional anterior. Esas observaciones no son evidencia de una captura nueva.
Los tests conservan sus fixtures deliberadamente; el módulo productivo no añade
caches persistentes ni mantiene referencias DOM. Retorna arrays y endpoints
escalares propiedad del caller, sin timers ni listeners.

El capturador futuro debe persistir el raw y liberar cada objeto de proceso al
avanzar, conservando solo las medias/recibos necesarios. Esa integración todavía
no existe. No se midieron heap/RSS nuevos, memoria pico ni ausencia universal de
fugas. Los casos adversos validan el lector, no reemplazan ciclos DOM reales.
