# Memoria del inventario tras incorporar Storage

Se ejecutaron tres capturas de superficie por Linux Node22.12.0 y24.14.1 con
jsdom27.4.0 real. Los tres reportes quedan retenidos durante GC. Window y
Document se observan con WeakRef separadas; ambos endpoints finales conservan
cero supervivientes en dos turnos claros. Los JSON adjuntos preservan toda la
traza con RSS, heapUsed, external y arrayBuffers, sin seleccionar muestras.

Este escenario comprueba que retener catálogos no retiene sus owners de referencia.
La prueba Storage espera timers reales y cierra ambos entornos; no agrega caches,
listeners ni referencias a producción. No se ejecutó el addon nativo para esta
auditoría. No mide pico ni demuestra ausencia absoluta de fugas, y no es un
benchmark o comparación de memoria entre motores. Crudos y fuentes se conservan
en reports/validation/inventory-storage-ledger/qualification.tar.gz.
