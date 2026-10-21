# Recursos del harness WPT con procesos aislados

La nueva ejecución crea un proceso por motor/fixture, mantiene el loader y las
assertions upstream y espera su terminación antes del siguiente. Node 22.12.0 y
24.14.1 completaron 480 procesos cada uno, con 240 fixtures y 83.007 resultados
por versión. Los 960 hijos terminaron con código 0 y signal=null; se conservan
sus PIDs y metadata. Los tests específicos comprueban además que procesos reales
ya no existen tras éxito y tras el deadline de proceso, también en Windows.

El padre conserva únicamente datos serializados y metadata; no recibe objetos
DOM. Su estado está acotado por el corpus declarado. Cada archivo temporal se
reserva exclusivamente y se cierra antes de leerlo, con limpieza del directorio
propio validando parent y prefijo. Los fallos conservan stdout/stderr y estado de
proceso. No se modificaron ownership ni transferencias N-API del runtime Rust.

validation.json resume mínimos/máximos de heapUsed, external y RSS observados
después de close() en cada hijo; los reportes completos conservan también el
estado anterior. No hay GC forzado ni medición de pico. El aislamiento elimina
estado de procesos anteriores, pero no demuestra recolección de Window/Document
durante una fixture ni ausencia de fugas internas. Esas propiedades siguen
cubiertas por escenarios separados de ownership y endpoints del proyecto.

Los datos originales comprimidos, SHA, logs, binarios identificados y metodología
están en reports/validation/native-class-ownership/wpt-process-isolation/.
La resolución del timeout de referencia en macOS requiere confirmar su CI.
