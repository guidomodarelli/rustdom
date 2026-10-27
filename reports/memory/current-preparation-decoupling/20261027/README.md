# Recursos de los fixtures históricos

Los dos reportes completos corresponden a la calificación funcional de los
paquetes consumidos de 39906777389, ejecutada desde su Git original 4196c496.
Conservan los endpoints separados de Window/Document, limpieza idempotente,
disposal con promesas pendientes y las observaciones originales de recursos.
Son datos de cuatro tests funcionales por SDK, no muestras científicas nuevas
ni una acreditación de rendimiento o de memoria del Range integrado actual.

El recolector anterior sobrescribió sus dos informes de recursos con recibos
del proceso; esos endpoints se perdieron y no se reconstruyeron. Estos JSON
provienen de una ejecución funcional posterior con recibos separados y hashes
comprobados; se conservan los 38 casos y sus trazas por SDK. Los intentos
anteriores y la corrección se documentan en el directorio de validación.

La inspección nueva de XML trabaja con metadata y procesos breves, sin cargar
DOM ni guardar caches mutables. Se probaron once contratos reales por SDK y
rechazos previos a una captura; no se midió memoria pico ni se demuestra
ausencia universal de fugas. Detalles y procedencia en
`reports/validation/current-preparation-decoupling/20261027/`.
