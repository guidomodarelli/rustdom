# Copia de Attr: microbenchmark, regresiones y control A/A

El checkpoint sigue pendiente. La copia de datos nativa mejora los seis
microbenchmarks medidos, pero ninguno de los dos candidatos aprobó todas las
filas públicas. Un control posterior con el mismo motor en ambas etapas
encontró variación importante. No se atribuyen automáticamente esas diferencias
al código y tampoco se convierten en una aprobación del candidato.

## Candidatos conservados

| Variante | Fuente medida | Resultado público contra checkpoint 65 |
|---|---|---|
| Métodos de copia en NativeTree | `46db35fc6b1edba59f810b3eb831e1940ec1edc6e507b25e3798dd8c1e8a0f16` | 3/40 filas fuera del +5%; `history/tree-methods/summary.json` |
| API concentrada en NativeAttributeCopy | `d97fca6faed2505f980041d9248fcc432eb41ed973bb2c9fa8a1c9bc104da723` | 4/40 filas fuera del +5%; `summary.json` |

Cada variante conserva ocho reportes públicos, ambos órdenes de etapa y de
motor, tres warmups por worker y 36 muestras crudas por fila/motor/etapa/Node.
Se mantienen las veinte filas originales por runtime y el presupuesto original
de `public-clone-budget.json`, sin compensar una regresión con otra ganancia.
Los hashes de salida validan datos y ownership fuera del tiempo medido. El
JavaScript de producción coincide con checkpoint 65; cambian addon y exports.

La segunda variante excedió el presupuesto en shallow template 100 de Node 24
(+7,39%); attribute-get 1.000 (+5,11%), shallow template 100 (+8,79%) y nested
templates 32 (+5,18%) de Node 22. La primera conserva también todas sus filas,
incluidas las tres que fallaron, en su directorio histórico.

## Copia de datos: alcance pequeño y explícito

| Caso, 1.000 copias | Node 22: bridge → nativo (ms) | Node 24: bridge → nativo (ms) |
|---|---:|---:|
| Plano, 32 unidades | 2,498 → 1,589 | 2,099 → 1,571 |
| Plano, 4.096 unidades | 6,864 → 2,148 | 7,088 → 2,078 |
| Namespace y UTF-16 aislado, 4.096 unidades | 139,816 → 2,783 | 146,494 → 2,630 |

Son medianas de 18 muestras por modo/caso/runtime en la segunda variante. Se
incluye para cada copia la lectura y escritura del bridge original, o la
preparación e inicialización nativas. No se reutiliza una preparación fuera del
tiempo medido. Setup, validación completa, liberación y GC explícito se excluyen;
se conservan los samples de warmup, memoria tras GC y contadores de snapshots.

Estas mejoras de aproximadamente 25–98% corresponden a esa operación de datos
en la misma máquina y con el mismo addon. No incluyen factories, wrappers,
hooks, parsing, suites ni un `cloneNode`/`importNode` completo. No resuelven el
presupuesto del driver de clonado aún pendiente.

## Control de repetibilidad A/A

`aa-control/` conserva cuatro reportes de Node 22 con dos órdenes de etapa.
Ambas etiquetas cargan el mismo directorio inmutable y el mismo binario:
`10ebf630ccc70bf2ac94fec4c4a2e8ba2aaacb90070c4f229dabcde164a96803`.
Se comprobaron su hash antes/después, equivalencia de salidas y 36 muestras por
etapa/fila. Son seis workloads y doce filas; es diagnóstico, no un gate reducido.

| Fila sin cambio de motor | Diferencia entre etapas |
|---|---:|
| attribute-get 100 | +6,23% |
| clone-deep-children 100 | +7,52% |
| clone-shallow-template 100 | −5,62% |
| clone-nested-templates 256 | −9,03% |

Cuatro de doce filas superan el 5% en valor absoluto sin cambios de código.
Esto demuestra que el procedimiento puede producir señales de regresión o
mejora de ese tamaño por falta de repetibilidad. No demuestra que todas las
diferencias entre candidatos sean ruido ni permite considerarlos aprobados.

El siguiente paso es analizar muestras por worker, warmup, orden y duración,
y calibrar la precisión con A/A antes de optimizar nuevamente. Conservar casos,
referencia y presupuesto. Cualquier mejora metodológica debe documentarse,
calibrarse antes de evaluar candidatos y mantener visibles estas mediciones.
No repetir variantes equivalentes hasta obtener una corrida favorable.

`variants.json` identifica fuente, distribución completa, binario, dependencias
y referencia de la segunda variante. `raw/` conserva cada reporte completo.
Los archivos históricos permanecen separados; ninguna variante está publicada
como checkpoint funcional.
