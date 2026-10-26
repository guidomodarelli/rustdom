# Evidencia actual de CI sobre `4196c496`

Se autenticaron 14 ZIP de contratos40395417183 y general40395416750, intento 1,
234.895.282 bytes. Cada ZIP completo está en `artifacts/<role>/<id>/zip.parts/`;
`transport/summary.json` conserva el orden, tamaño, SHA256 original y de cada
parte, commits y lecturas remotas independientes. Ningún byte del ZIP cambió.
La metadataAPI, logs e inventarios completos están legibles en `collection/`
y también íntegros en `artifacts/collection-metadata.tar.gz.parts/`.

Se materializaron fuera del checkout los 14 ZIP y se verificaron ocho replays
usando código actual revisado de4196 en un Git Linux real y limpio, con Node
22.12.0/24.14.1 fijados. Son cuatro criterios funcionales y 128 procesos únicos:
no sumar una segunda
vez las mismas muestras por el segundo lector. No se ejecutó DOM nuevo ni
código archivado. `readers-as-run/` es auditoría: no ejecutarlo ciegamente.

Los 13 casos del lector y cuatro guards del publicador/replay pasaron. El hallazgo P2
de dependencias transitivas se corrigió antes de la colección. Los primeros
tests también se conservan, sin mezclarlos como muestras nuevas. La revisión
aislada del método y los resultados no encontró hallazgos pendientes.

`reports/benchmarks/ci-general/40395416750/` publica todas las 332 comparaciones:
213 medianas rustdom mayores y 119 menores. Son datos descriptivos ordinarios de
hosts separados; no aceptan ownership. Veinte reportes de contrato adicionales
siguen separados. La fuente real observada es34eb7b9b y Node24.21.0; no se
normalizaron sourceCommit, sourceChanges ni sourceGitErrors a la fuente del PR.

`reports/memory/ci-general/40395416750/` conserva el análisis de 311 tests Rust
en diez batches de Memcheck y los endpoints jsdom. Los límites incluyen V8, addon cargado
y memoria pico no cubiertos. No prueban ausencia universal de fugas.

Este QA completa el transporte funcional actual. Su colector fija 14 artifacts
y 256 MiB; falta integrar el transporte científico por criterio antes de aplicar
la etiqueta v2. Rendimiento histórico sigue rechazado: no tag ni merge.
Runtime híbrido y migración general activa. Mantener 903 entradas y 850 pins.
