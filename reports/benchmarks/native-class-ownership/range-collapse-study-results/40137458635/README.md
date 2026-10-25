# Estudio de collapse completo y rechazado

Run 40137458635, job 121001909695, intento 1, fuente
02291d6b7a234a26ffaf364a1f377766e2338e7a. La secuencia única terminó
completa. El replay íntegro con el código congelado en Node 22.12.0 y 24.14.1
devuelve verified=true y accepted=false. Sus cuatro exports son byteidénticos
entre ambos ejecutables. No se repitieron procesos, muestras ni mediciones.

Se verifican 2048 procesos, 18432 duraciones medidas, 6144 warmup, 24576 Window
y 24576 Document separados, tres rondas y 4096 estados finales claros.
Se conservan las 253 primeras rondas no claras, baselines nativos y los tres
snapshots del padre. Los 18 grupos de recursos mantienen Node/fase/motor/paquete
físico separados; no agregan efectos causales entre esos grupos.

## Decisión íntegra

17 de las 32 comparaciones tienen controles jsdom fuera de ±2%. La calibración
AA Rust de Node 22 en range-control-1000/1000 difiere -11,44239282177505%,
fuera de ±5%; corresponde a comparar copias del baseline. Se rechazan diez
filas AA y siete AB. Los recuentos se solapan y no se suman como fallos distintos.
Ninguna fila AB excede el límite numérico Rust de +5%, pero la decisión global
sigue rechazada por calibración. No atribuir una causa única ni aceptar solo
las filas favorables. comparisons.md/CSV y analysis.json conservan las 32 filas.

La captura duró aproximadamente 99 min 25 s, dentro de los 175 min declarados
y del job de 180 min. El exit code 1 corresponde al rechazo de la decisión;
el archivo está completo y no hay un timeout de captura. Los presupuestos,
warmup, filas, semillas, estimador e instrumentación permanecen originales.
Los rechazos históricos se conservan; historicalGateReevaluated=false.
No tag ni merge de ownership con este resultado y no relanzar la secuencia.

## Archivo y autenticación

Artifact 12579853745, del mismo run/fuente/intento/nombre. ZIP de 22879400 bytes,
SHA256 0c6d63bacf8cd4e5822f54d5844d336170ff37b99757ee03837bf12d66e5ed07;
tar de 22933868 bytes, SHA256
f76e90effe94b26d24e59ec3e76eb440ab5ff539f8faeb424bdfc2b49cabc3a7.
transport/ conserva ambos archivos, metadata API, logs y todas las observaciones.
archive-members.json.gz enumera 19214 miembros, 16203 archivos regulares,
1404005115 bytes regulares y seis enlaces. La extracción usó únicamente lectores
actuales autenticados; no se ejecutó código extraído del archivo.

original-index/manifest/source-manifest conservan los datos del capture original.
spans.csv contiene las 24576 duraciones, incluidos todos los warmup.
capture.stdout.log.gz conserva el stdout íntegro; capture.stderr.log y
capture-exit-code conservan las otras salidas. replay/ guarda ambas ejecuciones,
sus versiones/hashes, contexto Git real y salidas; qualification.json fija sus
digests y los cuatro exports comunes, sin reetiquetar identidades o errores Git.

## Validación y límites

Linux pasó seis contratos de extracción y ocho de transporte. Windows pasó
cinco y siete, con un omitido por suite tras probar el privilegio real de enlaces;
esos casos sí se ejercieron en Linux. La invocación inicial de extracción recibió
una ruta de cache incorrecta y produjo tres errores de input; la corrección usó
la colección histórica original sin modificarla. El CLI positivo también extrae
y autentica el archivo real de este run. Los logs finales y la corrección de
la invocación quedan registrados; la primera invocación errónea se documenta
en qualification.json y no tiene un archivo de log separado.

El rechazo de políticas sin pins se prueba ahora con una política explícitamente
no calificada; la política publicada ya fija el artifact auténtico terminado.
Las pruebas históricas mantienen su identidad y rechazo originales.

Los recursos están en reports/memory/range-collapse-study-40137458635.*.
Los snapshots no miden memoria pico ni demuestran ausencia universal de fugas.
El runtime sigue híbrido y la migración general permanece pendiente.
PREPARATION.md conserva el documento previo a disponer de resultados; sus
afirmaciones de espera son históricas. El estado vigente es el de esta página.
