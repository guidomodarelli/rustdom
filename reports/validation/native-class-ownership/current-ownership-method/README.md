# Calificación del método sobre el candidato actual

Por cada Node22.12.0 y24.14.1 pasaron12tests públicos con40workers, dos contratos
de metadata y35contratos de replay/transporte históricos. Las cinco copias
físicas ejecutaron las ocho cargas públicas; además pasaron seis contratos de
inputs de build por perfil y el CLI verificó los inputs completos del checkout.
Se validaron salidas, flags,
semillas, carga exclusiva de paquetes y teardown de Window/Document.

Las regresiones reales alteran la distribución JavaScript, fuente Rust, input
de build y probe de recursos, y rechazan esos cambios antes de medir. El guard
de consumo usa el historial completo paginado y rechaza otro run, duplicados
y un historial incompleto. Cambiar los verificadores de preparación invalida
el hash revisado del arnés sin cambiar la identidad del runtime productivo.

La revisión aislada Codex detectó dos P2 —reaplicación de etiqueta y fuentes
de verificación omitidas— y cerró ambos tras corregirlos y probarlos. Terminó
sin hallazgos accionables. Actionlint y `git diff --check` pasaron.
La factory conserva su comportamiento histórico predeterminado; los archivos
anteriores mantienen sus resultados negativos. No se modificó ningún umbral,
orden, estimador, warmup, semilla ni cantidad de muestras de la secuencia.

`qualification.tar.xz` conserva505archivos regulares; `raw-members.json.gz`
autentica todos sus miembros por tamaño y hash. Incluye los logs, los80workers
reales, todas sus muestras y estados, manifest y salidas de los CLI históricos.
Son datos de calificación: no forman una secuencia AA/AB completa, no se usan
para decidir rendimiento y no autorizan seleccionar filas o semillas.

`review.json` fija el arnés y el resultado de calificación exigidos antes del
workflow único `ownership-current-source-v1`. La preparación oficial y el
protocolo prospectivo están versionados por separado. Todavía no hay resultado
de rendimiento de este candidato; no hay tag ni merge. Los límites de memoria
se explican en `reports/memory/current-ownership-qualification.md`.
