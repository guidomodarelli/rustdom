# Comparación descriptiva de posiciones

Se leyeron los 80 lotes de la captura `2af7a05c`, sin nuevos procesos DOM ni
muestras. Para cada lote se conservan los tres primeros intervalos medidos
índices 3/4/5 y los tres últimos 9/10/11. El tamaño del bloque está fijado en
`constants/settings.json`, como en la lectura previa de tendencias de muestras.

`rows.json` incluye los 160 bloques, medianas, cambios relativos y todos los
frames hoja agregados por función/URL/línea/columna. Los grupos de source location
no identifican tiers ni identidades de closures. Los conteos de ticks de cada
bloque coinciden con los de sus intervalos originales; el hash del input y los
960 intervalos crudos permanecen conservados. No se usan estos bloques para
excluir muestras ni recalcular aceptación.

| jsdom, range-control-1000/1000 | Primeras tres ms | Últimas tres ms | Cambio |
| --- | ---: | ---: | ---: |
| Node22 J0 | 2,838240 | 1,657912 | −41,59% |
| Node22 J1 | 2,680766 | 1,596206 | −40,46% |
| Node24 J0 | 2,145872 | 1,859299 | −13,35% |
| Node24 J1 | 2,325107 | 3,440443 | +47,97% |

Estos ejemplos motivan observar compilación, sin resumir los otros lotes como
si fueran equivalentes: todos los 80 están en el JSON, incluidos observers,
mutations y Rustdom. Es un proceso local por paquete y versión, con profiler,
pocos ticks por operación y variación de ambas direcciones. No hay explicación
causal, evidencia de mejora, selección de warmup ni decisión de aceptación.

La inspección de los diez perfiles originales encontró `id`, `callFrame`,
`hitCount`, `children` y `positionTicks`; no contiene metadata de tiers,
deoptimizaciones ni timestamps de compilación. Los frames de Range y SymbolTree
no permiten deducir esos eventos. La ruta siguiente se declara en
`reports/benchmarks/native-class-ownership/compilation-diagnostics/PROTOCOL.md`.

Reproducir solo lectura:

```text
python3 -B describe.py ../analysis.json NEW_ROWS.json
```
