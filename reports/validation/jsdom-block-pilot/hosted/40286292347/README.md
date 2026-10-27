# CI del calendario original: dos jobs aprobados

Run40286292347, intento1, commit `ec57e3bc1ead7d80e5cf0374b68374ce22b04da1`.
Los dos SDK aprobaron seis contratos de calendario/agregación/CLI por job.
Este productor es anterior al módulo de intervalos: **no se presenta como CI
de los once contratos nuevos**.

| Node | Job | Artefacto | Bytes | SHA256 ZIP |
|---|---:|---:|---:|---|
| 22.12.0 | 121450623506 | 12633769055 | 161436 | 250e08c52dc5b7ccf72d22eb6a67f535b8058c634bf2f3aac178beb5cc1be235 |
| 24.14.1 | 121450623592 | 12633709207 | 161366 | 64b67e2c81ed6ce93f5d5f83fdf77ddc06f9bba43f3ac3de8bc853cd7dd71f8b |

Se conservan ZIP, metadata API, jobs, run, logs y manifiestos de todos los
miembros. Los calendarios íntegros dentro de ambos ZIP coinciden con el SHA
local `6e6c0daf78493567b9ad8723b6ea3d09ea59d33821f05a68163ccb9a69b5fc9a`.
Son 16384 **procesos propuestos**, sin ejecutar el DOM ni registrar duraciones.

El lector actual `../tools/verify.py` usa pins independientes junto al código,
lee archivos/miembros con límites y rechaza una política aportada por el input.
No importa ni ejecuta miembros archivados. Verifica run/head/intento, workflow,
jobs, tamaños/digests, timestamps de upload, siete miembros por ZIP, calendario,
checkout y los resultados públicos de los tests. Sus seis contratos ejercen
datos reales, corrupción de procedencia, reseal coherente, logs truncados,
manifiestos faltantes y Python optimizado.

```sh
python -B reports/validation/jsdom-block-pilot/hosted/tools/verify.py reports/validation/jsdom-block-pilot/hosted/40286292347
```

El recibo original de transporte conserva publicationOfHostedArchivePending=true
como estado histórico al recogerlo; esta publicación y su manifiesto versionado
documentan el paso posterior. No hubo captura científica ni aceptación:
`performanceAccepted=null`, `gateReevaluated=false`. Gate ownership rechazado,
sin tag/merge. El runtime sigue híbrido.
