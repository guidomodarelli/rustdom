# Recursos del lector de calibración

El lector offline consume tres exports con hash fijado: índice, spans y análisis.
Agrupa los 24576 spans en 2048 procesos y conserva 1024 pares/64 filas. No hay
DOM, addon, Window/Document, referencias N-API, timers ni callbacks nuevos.
Los archivos se cierran con context managers o read_bytes; no existe cache
global de los datos. Las estructuras pertenecen a cada invocación.

Siete contratos pasaron en Python3.10/Linux y Python3.12/Windows. El contrato
de exportación ejecuta dos invocaciones sobre la entrada real, comprueba
resultados byteidénticos y que los tres inputs mantengan sus hashes. También
se protegen un destino preexistente y uno dentro de los inputs; la corrupción
de un input se rechaza antes de crear la salida. Los directorios temporales de
las pruebas se cierran mediante TemporaryDirectory.

Estas comprobaciones verifican el comportamiento de lectura/salida. No miden
crecimiento de heap/RSS, memoria pico o liberación inmediata del allocator y
no demuestran ausencia universal de fugas. La evidencia finita de recursos
del DOM no se vuelve a medir ni reinterpreta: permanece en
reports/memory/range-collapse-study-40137458635.*.

Código, protocolo, datos completos, comandos y logs:
reports/benchmarks/native-class-ownership/range-collapse-calibration/40137458635/.
