# Límites explícitos del CI habitual

`Validate rustdom` no fijaba `timeout-minutes` en ninguno de sus tres jobs.
En ese caso GitHub aplica 360 minutos por defecto, según su
[documentación oficial](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#jobsjob_idtimeout-minutes).
Ahora el workflow configura:

| Job | Límite | Máximo observado | Jobs exitosos observados |
| --- | ---: | ---: | ---: |
| `validate` por sistema operativo | 60 min | 34 min 34 s | 6 |
| `benchmark_shards` por shard | 45 min | 22 min 36 s | 8 |
| `benchmarks`, agregador | 5 min | 5 s | 2 |

Los tiempos se obtuvieron de los runs exitosos `39998303899` y `39981349120`,
conservando metadata de runs/jobs y el cálculo en `validation.json`.
Los límites dan margen a la ejecución observada y acotan jobs atascados;
dos runs no garantizan una cota universal para cachés frías o runners futuros.

Actionlint aprobó el workflow real. No se agregaron tests que lean strings del
YAML ni una ejecución artificial que espere a agotar el timeout. El comportamiento
de cancelación lo aplica GitHub; la comprobación end-to-end corresponde al CI
publicado. Los nuevos valores no acortan los runs que ya habían empezado y no
garantizan que `always()` alcance a subir artifacts después de un timeout global.

Se verificaron sin cambios los 26 pins y las 434 fuentes congeladas del método
de ownership. `ci.yml` no pertenece a ese grafo. El estudio consumido conserva
sus 180 minutos, matriz, semillas, warmup, estimador y presupuestos. No se relanzó
ninguna captura ni se ejecutó DOM local. El runtime y sus rutas de memoria no
cambiaron; no corresponde atribuir mejoras de tiempo o memoria a estos límites.

Ownership continúa rechazado. Este cambio mejora el límite operativo del CI,
pero no resuelve la calibración de rendimiento ni permite tag o merge.
