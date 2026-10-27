# Transporte de reportes del CI

El CI general40121155551 aprobó sus ocho jobs en fb18f6a0, pero volvió a
subir reportes históricos que ya estaban versionados. Los artifacts reales
de validación pesan aproximadamente2.58GB por plataforma y cada shard de
benchmark1.996GB. artifacts.json conserva tamaños/IDs/digests reales; no se
descargaron ni se repitieron esos benchmarks para esta corrección.
historical-reports.json registra17792archivos y4934353349bytes lógicos en
reports/ del SHA observado. Estos bytes lógicos no son tamaño comprimido.

El nuevo colector usa Git HEAD como referencia y copia reportes nuevos o
modificados, incluidos staged e ignorados por Git. Conserva rutas originales,
hashes, bytes, borrados y enlaces en artifact-manifest.json; no copia destinos
de enlaces. El historial sin cambios sigue disponible en sourceCommit.
Solo se excluyen directorios __pycache__, con contador explícito. La salida
es nueva y ajena al checkout; los archivos se copian con creación exclusiva
y hashes streaming. El manifiesto conserva fallos parciales. El step always
preserva la evidencia aun cuando fallen tests; no cambia presupuestos,
timeouts, tests funcionales ni el archivo íntegro del estudio científico.

Pasaron12contratos de comportamiento reales de Git/filesystem/CLI por Node
22.12.0/24.14.1 y Actionlint. Las QA previas conservan errores iniciales y
correcciones. Los contratos incluyen modificaciones staged, reportes ignorados,
enlaces/junctions, output fuera del árbol y colisión del nombre reservado.
La revisión aislada no encontró hallazgos pendientes sobre los cuatro paths.

Esta evidencia demuestra la selección y preservación de archivos con fixtures
reales. La reducción efectiva de bytes y duración del próximo CI hospedado
todavía no se ha medido. El helper no crea DOM, timers ni referencias N-API;
los streams de hashing se consumen y cierran, los temporales propios de las
pruebas se liberan verificando su ruta. No es una prueba universal de fugas.
