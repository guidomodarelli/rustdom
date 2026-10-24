# Recursos del launcher de optimización

El preflight no ejecutó DOM o Rustdom. Las validaciones de owners ejercen
reportes reales archivados; no son observaciones nuevas de liberación.
El transporte usa procesos Node reales y cierra descriptores con context
managers, incluso ante exit distinto de cero. Las trazas grandes quedan en
disco sin cargarse enteras en memoria; solo se leen outputs de versión,
capacidad, preparación y reportes de tamaño acotado por el sampler.

El launcher conserva paths, estados, hashes y JSON. No mantiene referencias
a Window/Document ni registra callbacks, listeners o timers de plataforma.
El marker es un archivo operativo persistente para impedir reintentos, no
una referencia DOM. Preflight no lo consume.

El preflight no midió heap del DOM/JavaScript, memoria externa, RSS o picos
del runtime. Los tests solo midieron el heap Python del helper, como se detalla
abajo. Estas observaciones no acreditan ausencia de fugas del producto. La captura futura mantendrá el
cleanup original y sus límites, sin introducir instrumentación JS al worker.
Evidencia en `reports/validation/native-class-ownership/optimization-log-method/`.

El hashing también usa chunks de 1 MiB, incluso en el cierre del archivo.
El test de 16 MiB mide heap Python con tracemalloc en un proceso separado;
exige un pico incremental menor a 3 MiB. El control antes/después produjo
el mismo SHA-256 y picos de 16.782.237/2.102.646 bytes. Estas cifras no miden
RSS total, memoria nativa o el runtime DOM. La captura continúa pendiente.
