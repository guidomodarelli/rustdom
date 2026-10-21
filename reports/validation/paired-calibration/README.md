# Contratos del coordinador pareado

Se validó el harness real en Node 22.12.0 y 24.14.1, usando el addon y el jsdom
27.4.0 independientes. No se introdujeron mocks. Este trabajo modifica el
muestreo y extrae el fixture HTML compartido; no cambia el motor Rust ni los
algoritmos DOM del WIP publicado anteriormente.

| Validación | Node 22 | Node 24 |
| --- | ---: | ---: |
| `node --test tests/benchmarks/*.spec.cjs` | 124/124 | 124/124 |
| Integración pareada de clonado, importación, atributos y FormData | Aprobada | Aprobada |
| Liberación observable de Window/Document por muestra | Aprobada | Aprobada |
| Fallo real de carga de un runtime y cierre del peer | Aprobado | Aprobado |
| Ejecutable inexistente: error ENOENT y cierre acotado | Aprobado | Aprobado |

`all-contracts-v*.log` conserva la ejecución final completa. Los resultados
anteriores, incluidos el fallo detectado por la nueva regresión, están en
`history/`. No se repitieron Cargo, Clippy, Memcheck o runners generales: sus
fuentes de producto no cambiaron y aquí no se afirma una nueva validación
integral del candidato de atributos.

`fixture-equivalence.json` y los reportes de `fixture-parity/` prueban que las
veinte filas originales conservaron tamaño de entrada y hash de salida completo
en ambos motores. La última ejecución comprobó 160 observaciones con Node 24;
el muestreo corto sirve para comprobar contratos, no rendimiento.

La revisión independiente de Codex aceptó un P2: un fallo de `fork` puede llegar
al cierre sin emitir `exit`. Se cambió la espera a `close`. La regresión real
detectó además que enviar `stop` al IPC roto reemplazaba ENOENT por EPIPE.
Ahora se conserva el primer error y se evita ese envío. Se repitieron los tests
y el mismo reviewer revisó todos los archivos del harness actual, cerrando con
cero hallazgos accionables. Fue una revisión estática, sin ejecutar cargas ni
modificar archivos. Los tres reportes de `spawn-regression/` preservan el caso
anterior y el resultado corregido en ambos Node.

`measured-sources.tar.gz` conserva las fuentes exactas. `source-archive.json`
registra su hash y la comparación de los 333 archivos del alcance medido tras
extraerlos, además del test pareado identificado por separado. También se
cotejaron esos archivos con el worktree administrado. Esto permite reproducir
los bytes medidos aunque otro checkout normalice los finales de línea.

La calibración A/A está en `reports/benchmarks/paired-calibration/`: falló el
criterio de precisión previo. Estos contratos verdes no aprueban rendimiento,
compatibilidad total, ausencia universal de fugas ni el hito del motor.
