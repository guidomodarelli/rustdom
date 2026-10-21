# Revisión local de la corrección de ownership

El reviewer aislado, de solo lectura, revisó el diff local contra main
75db9bb095db8457a6ae567f219e2224a55b9f36 y terminó con cero hallazgos accionables.

Verificó asignaciones generadas, ambos layouts ZST, liberación antes del wrap,
transferencia de ownership antes del type tag, restauración de la bandera de
fábrica y cleanup de workers. No modificó archivos ni ejecutó validaciones.
Los tests y Memcheck publicados corresponden a las ejecuciones del agente principal.
La revisión remota del SHA final todavía es necesaria antes de integrar el PR.

Después se revisó la ampliación a `CallbackInfo::_construct` contra
`3d37f89976a48203e80cc5c435e099267f4ce346` mediante el reviewer nativo aislado
de Codex (`review_name_queries`), nuevamente sin cambios ni ejecuciones propias.
Resultado: cero hallazgos accionables. Verificó destrucción ante wrap fallido,
transferencia después del éxito y antes del bookkeeping/tag, y conservación del
error y de los receivers originales. No encontró una ruta nueva de double free.
`_factory` permanece fuera del cambio; no tiene consumidores `#[napi(factory)]`
en las fuentes de rustdom inspeccionadas. La matriz de ejecución y la revisión
remota final se registran por separado.

La revisión de las herramientas de medición y archivado detectó un P2: existir
el último log no prueba el exit correcto. Se corrigió exigiendo el comprobante
terminal antes de copiar, ligado a comando, runtime y binario; la ruta sin él
se ejerció y rechazó con exit 1. El mismo reviewer revisó el fix y la selección
final de reportes por ventana del runtime: cero hallazgos accionables. Estas
revisiones fueron estáticas y no sustituyen el archivado real, cuyo manifest
identifica los bytes originales y almacenados.

Tras completar A/B y A/A, el mismo reviewer recalculó en memoria las 5.184
duraciones de 96 procesos y verificó muestras, medianas, porcentajes e
identidad de fuentes: cero hallazgos accionables. Confirmó que la conclusión
mantiene inconcluso el presupuesto y que `linguist-generated` conserva visibles
SDK, tests, helpers y documentación. No modificó archivos ni ejecutó suites,
builds o benchmarks.

La comprobación real `--staged` inicialmente encontró `ENOBUFS` al listar el
índice entero. Se acotó a las 337 fuentes del manifest y se conservó el error
como `cause`; luego verificó correctamente bytes, hashes y muestras. El reviewer
revisó ese delta y la preservación de JSON originales, nuevamente con cero
hallazgos. Los atributos de archivos raw preservan también los CRLF del
comprobante de procedencia, sin reescribir observaciones.

La revisión de los nuevos diagnósticos encontró un P2 en el cálculo de cotas
de CPU: eventos reales con `tdur > dur` podían producir cotas invertidas.
Se aceptó el hallazgo y se retiró esa inferencia. El análisis original y el
código rechazado permanecen identificados en el manifest; el vigente usa solo
pared, márgenes en los extremos y valores CPU nulos/no válidos.

El mismo reviewer verificó los 113 archivos y recalculó 72 muestras: GC posible
en cero y compilación garantizada/posible en 69. Confirmó los resultados del
microdiagnóstico y cerró el P2: cero hallazgos accionables. Solo lectura y
cálculos en memoria; no ejecutó cargas ni modificó archivos. El chequeo real
`verify-diagnostics.cjs` también pasó antes de publicar los datos.

La revisión del experimento hosted encontró otro P2: ante un worker fallido,
el CLI guardaba el JSON parcial fuera del directorio subido por el workflow.
Se verificó el flujo real en `BenchmarkReport.fail` y se corrigió archivando
los nuevos `*-failed.json`, sus hashes y el índice antes de propagar el fallo.
Una regresión usa el generador real y observaciones históricas completas;
comprueba preservación byte por byte, muestras, hash e historia preexistente.
La creación final del directorio también es exclusiva para evitar carreras.

Los cinco contratos pasaron en Node 22.12.0/Linux y 24.14.1/Windows; `actionlint`
aprobó el workflow. El mismo reviewer nativo Codex aislado revisó el delta
corregido: cero hallazgos accionables, P2 cerrado, sin modificaciones ni cargas.
No acredita todavía una medición hosted ni reemplaza la review remota final.
