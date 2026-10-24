# Launcher de la observación de optimización

Implementa la receta publicada en `window-identities/OPTIMIZATION-PROTOCOL.md`.
Todavía no ejecuta una captura hasta completar publicación y revisión de sus
fuentes. El método mantiene las ocho cargas originales en cuatro procesos
jsdom, sin modificar el sampler ni aceptar presupuestos de rendimiento.

Los inputs son un JSON con `frozenHarness`, `preparation`, `localManifest` y
`nodes` (paths de Node 22.12.0 y24.14.1 en ese orden). Se autentican los hashes
independientes del ledger de 387 fuentes, manifest local y reporte de referencia.
Los ocho outputs públicos deben coincidir con la referencia completa archivada.

```text
python3 -B run.py --preflight INPUTS.json NEW_OUTPUT
python3 -B run.py --sources
python3 -B run.py --capture INPUTS.json NEW_OUTPUT PUBLICATION.json
```

`PUBLICATION.json` contiene `commit` y `files` de `--sources`. El operador debe
cotejarlos con Git/GitHub antes de ejecutar; el JSON no demuestra publicación.
La captura exige el recibo completo antes de crear outputs o lanzar procesos.
Un marker exclusivo impide otra captura desde este checkout. No borrarlo para
reintentar; ante fallos preservar los crudos y el motivo. Preflight no ejecuta
DOM ni consume el marker; verifica versiones, flags, inputs y preparación.

El launcher guarda PID, argv, stdout/stderr, exit code y el reporte original,
incluido lo parcial al fallar. Copia sus fuentes y las 387 originales, sin
derivarlas. Comprueba preparación, fuentes y ejecutables después de cada Node.
Nunca se activan tracing nativo, CPU profiler o intrinsics de V8.

Hay 384 ejecuciones de muestra por construcción, incluidos 96 warmups. El
sampler original conserva solo las 288 duraciones medidas, no duraciones de
warmup ni intervalos absolutos. No se inventan spans y no se asignan eventos
a muestras sin alineación verificable. Los logs pueden cambiar el timing.
No se usan estas duraciones para aceptar, seleccionar filas o cambiar límites.

Los tests usan reportes reales archivados y procesos Node reales: rechazan
filas incompletas, duración inválida y owners retenidos; preservan stdout y
stderr de un exit7 y verifican exclusión del marker. No mockean plataformas.
Para ejecutarlos, definir `RUSTDOM_OPTIMIZATION_ARCHIVE` con la raíz del archivo
extraído y `RUSTDOM_OPTIMIZATION_NODE` con un Node ejecutable del host, y usar
`python3 -B -m unittest discover -s METHOD_DIRECTORY -p test_run.py -v`.

El driver conserva metadata y archivos, no referencias DOM. El worker original
observa Window/Document por separado. Los endpoints finitos no prueban ausencia
universal de fugas ni memoria pico. Ownership continúa abierto y los rechazos
anteriores no cambian; este launcher no agrega algoritmos DOM en Rust.
