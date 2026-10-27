# Evidencia del ensayo de suites completas

Ensayo único y terminal, driver exit0. `complete-study.tar.gz` conserva los
1.807 archivos crudos en 2.172 entradas; checksum y tamaño en `receipt.json`.
Incluye 342 CLIs, 54 warmups, 288 mediciones, todos los logs/reportes/recursos,
snapshots de 79 fuentes, probes y tres replays congelados que coinciden.
`study-index.json` es copia exacta del índice completo. `publication.json` y
su verificación registran el cotejo de fuentes con Git y GitHub antes de medir.
El launcher se conservó después de terminar como `operator-launch.py` dentro
del tar; no forma parte de las 79 fuentes fijadas del método.

La receta se publicó en `a10e7a04d433c1b44b16d02c5087884acbc6e33f` y no cambió
durante la captura. La preparación fija y sus dependencias se conservan en el
tar `runner-suites-qualification/qualification-and-inputs.tar.gz`, SHA-256
`905f195308e58d038eab929b6905cdd6ae9752e482de6144f927b85a985e14dd`.
No se incluye otra copia de esas dependencias en este archivo.

`readback.py` autentica cada archivo y fuente, reportes y relojes, y recalcula
las doce filas con medianas y productos enteros. Pasó con Python Windows y
Linux; los JSON coinciden. `readback-contracts.py NEW_OUTPUT` ejerce su CLI
real con cinco casos por plataforma: archivo válido, checksum alterado,
ledger incompleto, decisión fabricada e inventario de fuentes vacío con
checksums actualizados. Los casos alteran copias conservadas; el ensayo
original no cambia. Sus crudos y recibo están en `readback-contracts.tar.gz`
y `readback-contracts.json`.

El recibo del lector se coteja también contra las 79 fuentes del método
calificado publicado. La primera tanda de cuatro contratos por plataforma
se conserva en `reader-history/`; la tanda final añade el inventario vacío.

El ensayo pasó sus doce filas. No acepta microbenchmarks previos ni demuestra
ausencia de fugas o migración nueva. Resultados y límites completos están en
`reports/benchmarks/native-class-ownership/runner-suite-timing-results/` y el
informe equivalente de `reports/memory/native-class-ownership/`.

Raíz local: `/tmp/rustdom-runner-suite-timing-8wamjxj2`. El proceso de captura
session10111/PID421662 terminó; el replay session63028 también. No relanzar
ninguno. Los contratos finales están en
`/tmp/rustdom-suite-timing-reader-D6hTNPBZ`.
Para lectura offline se puede extraer el tar en otra raíz y usar el
`study.cjs --verify` congelado debajo de `results/sources/` sobre `results/`.
