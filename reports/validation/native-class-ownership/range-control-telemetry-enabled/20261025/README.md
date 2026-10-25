# QA del método AA con capacidad habilitada

Checkout real Git Linux privado limpio
`55842ac1efb29d56a0e10fd635f7765348ac1e3f`, sobre la base publicada
`e61dceac9b6e12b8ea97d739b1dd165e090c2684`. No es un commit publicado ni
un runtime recompilado. Se conserva el autor ya configurado; signing se
deshabilitó solo por invocación para esa QA privada, sin tocar la publicación.

Los 599 hashes de `summary.json` corresponden exactamente a primary y al
checkout de QA. Los mapas finales mantienen893archivos por modo e incluyen
captureImplemented=true. Los563pins históricos no cambian. Se mantienen los
256procesos declarados, presupuestos55/65/90/15/10min y todos los parámetros.

Pasaron17contratos en cada Node22.12.0/24.14.1 autenticado por versión/hash,
seisPython de derivación y seisdellectorLinux. Planes/preflights byteidénticos;
Actionlint1.7.12 aprobó ambos workflows. Los ocho procesos históricos y96spans
por lector mantienen sus bytes e identidad MutationRecord. El lector Windows
no se repitió porque está intacto; su QA previa5pass/1skip por symlinks sigue
en range-control-telemetry-portable/20261025, cubierta por Linux.

El contrato del colector lee Git real y un evento fixture válido; no llama
run(), readiness APIs ni profilers. También rechaza diez combinaciones de
host/intento/repo/workflow/run/commit/evento incorrectos en hijos aislados.
Esto prueba el boundary de contexto, no una captura hospedada real. El worker
real rechaza cuatro contextos inválidos por Node/modo antes de escribir reporte,
sidecar o fuente e iniciar observadores. No se simulan muestras o CPU profiles.

`qa.zip`:19928523bytes, SHA256
`3af44fc0cf0103fb9032b83e09fec4c0cb58d273bac06a74c66c96499757c803`,
2421miembros íntegramente contrastados en `members.json`. Conserva fuentes,
derivaciones, comandos, contexto, logs y pruebas. Los paquetes y datos históricos
ya versionados se enlazan por sus hashes sin duplicarlos; sus comandos/recibos
de extracción están preservados. No ejecutar scripts archivados.

La capacidad configurada no activa una ejecución. Antes de aplicar una sola
etiqueta nueva se exigen revisión íntegra del método, recibo exacto, publicación
y los seis checks del SHA final. La autorización permanente está concedida.
No se ejecutaron DOM, profiling o mediciones nuevos. No hay replay positivo
de una captura Range inexistente. performanceAccepted=null/gateReevaluated=false
mantienen el diagnóstico separado del rechazo histórico de ownership.

Recursos: reports/memory/range-control-telemetry-enabled-20261025.md. Esta QA
no mide memoria pico ni demuestra ausencia universal de fugas. Sin tag/merge.

## Recibo de revisión y comprobación adicional

La revisión aislada íntegra cerró cero hallazgos sobre601paths, incluido el
grafo ejecutable599 exacto. El recibo canónico está en
reports/validation/native-class-ownership/range-control-telemetry-method/review.json,
SHA256 `bdab7f4639f99054c93b1f4f962f233a9e5feb98db6ea6c708de4da87e5be9fb`.
Ese recibo no acepta rendimiento ni sustituye los checks del SHA publicado.

publication-proof/ conserva diez invocaciones del lector real, cinco por Node:
un recibo positivo y cuatro mutaciones rechazadas de revisión, capacidad,
hallazgos o grafo. Usó el commit privado real bb48a085 sobre55842ac1, que añade
solo el recibo auténtico y mantiene el grafo599. No reemplaza la QA original
del ZIP ni se presenta como commit publicado. Las mutaciones afectan únicamente
ese recibo dentro del checkout propio; sus logs conservan literalmente el
estado Git ` M` observado y HEAD real. Finally restaura los bytes originales
y Git termina limpio. Nunca se alteró el recibo canónico de primary.

Las comprobaciones ejecutaron código actual, en ambos binarios Linux fijados,
sin APIs, DOM, profiling ni captura. No prueban un replay completo nuevo.
