# Baseline del CLI de inventario

El [baseline del esquema 2](inherited-declarations/README.md) conserva las nuevas
mediciones con 4.374 declaraciones. Usa otro layout de filesystem; sus resultados
no se presentan como comparación directa con los valores históricos de abajo.

Se midió el comando real `npm run inventory -- --output TEMP`, completo: startup
de npm/Node, resolución de la referencia, AST, observación pública, clasificación,
serialización y escritura. **No ejecuta Rust ni mide rendimiento del motor DOM.**

En un i7-1360P con WSL2 se guardaron dos procesos de warmup y cinco procesos
medidos por Node. Cada proceso generó el catálogo completo y comprobó todos sus
digests contra la salida validada de ese runtime. El warmup no vacía la caché de
archivos del sistema: cada proceso es nuevo, pero no se afirma I/O frío.

| Node | Mediana completa | Mínimo–máximo | Máximo RSS reportado |
| --- | ---: | ---: | ---: |
| 22.12.0 | 1.399,69 ms | 1.367,50–1.623,96 ms | 206.364 KiB |
| 24.14.1 | 1.138,23 ms | 1.015,97–1.222,87 ms | 250.892 KiB |

`2026-10-21-cli.json` conserva todas las muestras, incluidas las de warmup,
comandos, exit codes, CPU, RSS, versiones, hardware y hashes de salida.
`summary.json` conserva el cálculo. `raw-command-output.tar.gz` guarda stdout,
stderr y las observaciones GNU time de las catorce invocaciones.

GNU time reporta CPU del comando y sus descendientes; el máximo RSS no es la
suma de memoria simultánea de todos los procesos. La duración incluye el comando
completo observado desde el coordinador. Las identidades de fuentes, auditorías,
package.json y lockfile coincidieron antes/después. No hubo builds ni suites
competidoras durante la medición.

Las mediciones usaron las fuentes sobre NTFS y las dependencias Linux locales
mediante NODE_PATH, sin node_modules Windows en el worktree en ese momento. Los
resultados no deben compararse directamente con ejecuciones que cambien esa
disposición de I/O. Las instalaciones Linux/Windows de referencia tienen las
mismas versiones verificadas en la procedencia de validación.

`run-benchmark.cjs` conserva la orquestación exacta del entorno histórico. Una
ejecución anterior al fix de locale, sus muestras y sus fuentes verificadas se
conservan en `history/pre-locale-fix/`. No se presenta esa diferencia de tiempos
como una mejora: son baselines de tooling en un solo host y pocas muestras,
sin presupuesto de regresión del motor ni comparación con jsdom como DOM.
