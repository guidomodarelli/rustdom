# Trazabilidad de fuentes del benchmark — PR 65

Validación del cambio asociado a `discussion_r4017536006`, ejecutada el 15 de septiembre de 2026 sobre `f238ad06d838b8e8befa48aea92d79b5f3534bc7` más el fix local. La publicación e integración con `main` corresponden a la tarea orquestadora.

## Cambio y contrato

`benchmarks/sources.cjs` concentra las raíces utilizadas por `sourceHash`, `measuredSources` y `sourceChanges`. Conserva el digest SHA-256 ordenado de `nombre relativo + NUL + bytes + NUL` y la identidad independiente del runtime/binario. Las entradas porcelain conservan sus dos columnas de estado; los archivos no rastreados e ignorados se enumeran individualmente.

Una consulta de Git fallida produce `null` en su campo y una entrada en `sourceGitErrors` con operación, código de salida, señal y código de arranque. El diagnóstico no serializa stdout/stderr fallidos ni el entorno. Un índice corrupto puede conservar `sourceCommit` aunque `sourceChanges` sea `null`.

## Pruebas ejecutadas

Comando: `node --test tests/benchmarks/sources.spec.cjs tests/benchmarks/report.spec.cjs tests/benchmarks/shard.spec.cjs`.

| Entorno | Resultado |
|---|---|
| WSL Ubuntu 22.04, Node 24.14.1 | 18/18 aprobadas |
| Windows, Node 24.20.0 | 18/18 aprobadas |
| `npm ci` dentro del clon propio | 475 paquetes instalados; lockfile sin cambios |
| `node scripts/build-native.mjs`, Rust 1.98.1 | Build release del addon propio aprobado |
| `npm run build:js` | Build del runtime propio aprobado |
| `git diff --check` | Aprobado |

Las nueve regresiones nuevas crean repositorios Git reales y guardan/leen reportes JSON: árbol limpio y digest compatible; cambios tracked/untracked tanto en `third-party/napi` como en `tests/integration/read-dom-file.cjs`; directorio vendor no rastreado; archivo vendor ignorado; índice corrupto con commit legible; ejecutable Git ausente. Los reportes generados no modifican la identidad de fuentes. No se mockea Git ni bibliotecas de plataforma; las muestras de los tests del escritor son datos contractuales, sin interpretación de rendimiento.

## Runner real

Se ejecutó `RUSTDOM_BENCHMARK_SHARD_INDEX=0 RUSTDOM_BENCHMARK_SHARD_COUNT=2 node --expose-gc benchmarks/compare.cjs blob-endings` con el addon y dependencias propios, jsdom 27.4.0 independiente y el FileReader real.

El escenario agregó temporalmente al lector un salto de línea y el comentario `// Temporary benchmark provenance diagnostic; no runtime changes.` con salto final. También creó `third-party/napi/benchmark-provenance-diagnostic.txt` con la línea `Temporary benchmark provenance diagnostic; no runtime changes.` y salto final. Ambos cambios se restauraron al finalizar. Las fuentes funcionales y las secciones cronometradas permanecieron iguales.

[JSON crudo del runner](../benchmarks/2026-09-15T16-08-40.909Z-linux-x64.json) y [tabla generada](../benchmarks/2026-09-15T16-08-40.909Z-linux-x64.md). El reporte registró exactamente:

```text
 M benchmarks/compare.cjs
 M tests/integration/read-dom-file.cjs
?? benchmarks/sources.cjs
?? third-party/napi/benchmark-provenance-diagnostic.txt
```

El runner completó cuatro procesos, con tres warmups y nueve muestras por proceso: una partición de `blob-endings`, tamaño 100, dieciocho muestras por motor. Sus hashes de salida coincidieron y se comprobó `complete: true`, `sourceGitErrors: []`, la igualdad de los cuatro campos de fuentes con la captura previa y el hash del binario con `runtimeSource.nativeBuild.binarySha256`.

- `sourceHash`: `bd6cae52dc42bdfacbf16606fbf28030da65daeb8084cc01139a4f0ea09ab2fd`.
- `nativeBinarySha256`: `81691849e946188039dff0b39ecbe61feac6a297a53e8536082cd2ad83e66864`.
- Máquina: Intel Core i7-1360P, WSL2 `6.6.87.2-microsoft-standard-WSL2`, x64; hardware, memoria, versiones, configuración y muestras completas quedan en el JSON.

Esta ejecución valida trazabilidad e integración. Había otras validaciones activas en la máquina: sus tiempos y ratios no se usan como evidencia de mejora o regresión de rendimiento.

## Recursos y límites

La captura de fuentes es síncrona, previa a los workers y no conserva cachés, listeners, timers ni referencias a ventanas/documentos. La lista diagnóstica tiene como máximo dos operaciones Git. Los tests eliminan sus directorios temporales y el runner conserva su cierre y GC habituales. Este cambio no modifica ownership Rust/N-API ni permite concluir ausencia absoluta de fugas.

No se repitieron aquí las suites globales de DOM, Jest, Vitest y memoria: la tarea orquestadora valida esa superficie en su clon de unión. La evidencia de este clon cubre el cambio de provenance, el build real y la ejecución del benchmark descrito.
