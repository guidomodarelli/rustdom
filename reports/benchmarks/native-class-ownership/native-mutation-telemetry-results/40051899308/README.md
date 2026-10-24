# Diagnóstico nativo de MutationRecord/100 — run 40051899308

Captura autorizada y ejecutada **una sola vez**, intento 1, fuente
`0211bba042e8f6d72dd303e8b23c53c68b32df92`. [Run y logs](https://github.com/guidomodarelli/rustdom/actions/runs/40051899308).
Terminó con éxito; los replays estrictos en Node 22.12.0 y 24.14.1 son byte-idénticos,
SHA256 `91b8c7b101a3a6020e3f6fd90c6173a20cb133cf1511bce27d3400619128ff46`. El runtime continúa híbrido.

**Es un diagnóstico instrumentado: `performanceAccepted=null`, `gateReevaluated=false`.**
No acepta rendimiento ni reemplaza los rechazos originales y de fixtures compartidos.
No resuelve por sí solo la calibración fallida ni explica causalmente el +10.3053%
de la captura anterior sin instrumentar. No hay tag ni merge.

## Archivo y completitud

Artifact `12545165372`: ZIP 578899081 bytes, SHA256
`57448f31f6256a9e696af544ed68369c8ca4ba6d740958e5572a376f2f50325d`.
Tar 578725796 bytes, SHA256
`62452431491ec08d69760386b8f9641e9001a737cd5f6c1cd0f679805ee3fd7c`.
`parts.json` conserva ambos archivos en 46 partes sin pérdida, por debajo del límite
de GitHub por archivo. `metadata/` contiene autorización, activación única, APIs,
logs, índice y manifiesto de los 13983 miembros: 12455 archivos regulares,
6295232489 bytes regulares y seis enlaces. No ejecutar código desde ese archivo.

Se verificaron 512 procesos, 4608 duraciones medidas, 1536 warmup, 256 perfiles CPU
y 256 logs JIT. `spans.csv` conserva todas las 6144 operaciones, sin filtrar warmup.
Se observaron 6144 Window y 6144 Document por separado, tres rondas por proceso,
211 primeras rondas no claras y 1024 estados finales requeridos claros.
Los 46 pins del método, los 26 anteriores y las 434 fuentes congeladas no cambiaron.
Hardware y configuración reales: `metadata/machine.json` e índice original;
4 CPU lógicas, AMD EPYC 9V45 96-Core Processor,
linux 6.8.0-1064-azure.

## Lo observado y sus límites

Se conservan 235 deltas CPU negativos, sin corregirlos ni descartarlos. Los
26998 registros de frames de operaciones conservan URL/script ID y membresía
posible/garantizada. En modo JIT los campos CPU no observados siguen siendo null;
en modo CPU los campos JIT no observados también son null.

Los logs registran 8537000 emisiones de funciones;
11521 se atribuyen a operaciones con los intervalos de reloj originales. En las
operaciones medidas del motor híbrido se registraron 3160 emisiones
`turbofan` garantizadas dentro del intervalo y 0 spans con intersección GC.
Son observaciones de esta captura: el instante de emisión JIT no mide su costo,
un frame con URL JavaScript no identifica el stack interno Rust y la ausencia de
intersección GC aquí no describe causalmente los tiempos del estudio anterior.
`cpu-frames.csv`, `jit-operation-functions.csv` y las 64 celdas completas de
`analysis.json` incluyen ambos motores, Node, modos, AA/AB, labels y warmup.

Medianas descriptivas de las duraciones **instrumentadas**, en ms; cada celda
contiene 144 muestras medidas. Se publican todas las combinaciones, sin presupuesto
ni nueva decisión de aceptación:

| Node | Modo | Fase | jsdom A | jsdom B | rustdom A | rustdom B |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| v22.12.0 | cpu | AA | 1.556528 | 1.528637 | 4.413198 | 4.164384 |
| v22.12.0 | cpu | AB | 1.443072 | 1.517520 | 4.087723 | 4.156176 |
| v22.12.0 | jit | AA | 1.291664 | 1.304509 | 4.281019 | 4.263428 |
| v22.12.0 | jit | AB | 1.309250 | 1.302272 | 4.304245 | 4.323736 |
| v24.14.1 | cpu | AA | 0.807515 | 0.790473 | 2.947525 | 2.906695 |
| v24.14.1 | cpu | AB | 0.800141 | 0.811604 | 2.886464 | 2.916074 |
| v24.14.1 | jit | AA | 0.775338 | 0.807097 | 2.773103 | 2.801023 |
| v24.14.1 | jit | AB | 0.770891 | 0.771687 | 2.758040 | 2.731399 |

## Validación de los lectores

Pasaron 14 regresiones de transporte en Windows y Linux, reconstrucción íntegra
del ZIP/tar en ambos sistemas, extracción segura pública y comparación completa
de manifiestos. Cinco contratos por Node cubren CSV UTF-8, preservación del destino,
separación del corpus incluso por symlink, identidad y categorías de URLs reales.
Siete pruebas independientes contrastan todos los spans, frames CPU, registros
JIT exportados, rondas de recursos, deltas negativos y celdas con los originales.
Los siete exports finales son byte-idénticos entre ambos Node (`validation/analysis-proof.json`).

El primer exportador adicional agotó el heap al acumular datos derivados; se
conservan su snapshot y logs exit134. Se corrigió a CSV por bloques, con umbral
65536 unidades UTF-16 más la fila actual, y cierre independiente de descriptores.
La revisión encontró dos P2 aceptados: ausencia convertida en cero y salida dentro
del corpus. Se corrigieron y probaron. Los snapshots históricos de `validation/`
son evidencia de fallos; no son entrypoints de reproducción y no deben ejecutarse.
El fallo de ese lector no fue una fuga observada en Rust ni otra captura.

## Reproducción sin medir DOM

Usar Python sin optimización y directorios de salida nuevos con padre existente:

```sh
python3 -B <packet>/tools/materialize.py <packet> <fresh-transport>
python3 -B <packet>/tools/extract.py <result-checkout> <fresh-transport> <fresh-archive>
```

Usar un checkout Git real y limpio del commit fuente 0211bba0 para el replay;
no normalizar `sourceCommit/sourceChanges/sourceGitErrors`. Con Node 22.12.0 y
24.14.1 fijados y verificados por sus hashes en `replay-node*.meta.json`:

```sh
<node> <clean-0211-checkout>/reports/benchmarks/native-class-ownership/native-mutation-telemetry/run.cjs --verify <fresh-archive>/native-mutation/capture
<node> <packet>/tools/analyze.cjs <fresh-archive>/native-mutation/capture <fresh-analysis> <packet>/replay-node22.json
python3 -B <packet>/tools/transport.spec.py <fresh-transport>
python3 -B <packet>/tools/artifact.spec.py <packet> <capture> <analysis-node22> <analysis-node24>
```

Los scripts de estas instrucciones pertenecen al checkout publicado, no al tar.
No ejecutar samplers ni perfiles nuevos. Recursos y límites adicionales en
`reports/memory/native-mutation-telemetry-40051899308.{md,json}`.
