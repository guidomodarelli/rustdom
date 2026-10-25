# Exploración de pares y orden temporal del diagnóstico AA

Este análisis **post hoc** usa exclusivamente la captura completa40154725015,
fuente d5ec4186. No ejecuta DOM, profiling, warmup ni mediciones nuevas.
`performanceAccepted=null`, `gateReevaluated=false`; los rechazos históricos
se conservan. No reemplaza el estimador de los estudios de ownership ni aporta
implementación Rust. El runtime sigue híbrido y el objetivo general incompleto.

## Qué cambia la siguiente investigación

Las medianas agrupadas publicadas no describen por sí solas la variación entre
procesos ni el orden temporal dentro de uno. Este paquete expone ambas sin
seleccionar pares, etapas, semillas o motores favorables. En jsdom CPU/Node22,
la diferencia de medianas agrupadas es+19.1964%; la mediana de diferencias entre
procesos emparejados es+4.1625%, con13de16pares positivos y rango−25.1403% a
+73.5012%. No son dos resultados alternativos de una misma fórmula y no se
elige uno para aceptar rendimiento: cada uno responde una pregunta distinta.

Además, en los32procesos jsdom JIT/Node22, la mediana de cambio entre los tres
primeros y los tres últimos spans medidos es+22.9116%; los cambios individuales
van de−27.2139% a+99.6612%. Son diferencias descriptivas de esta ejecución
instrumentada, no una prueba de estacionariedad, causalidad JIT o GC, un
intervalo de confianza ni una explicación de las regresiones históricas.

La siguiente medición prospectiva de un candidato deberá declarar antes cómo
trata procesos independientes y observaciones repetidas, el warmup y el trabajo
público completo. No agregar muestras al run consumido, ajustar su presupuesto
ni sustituir silenciosamente su estimador. La autorización permanente ya cubre
esa preparación. Estos resultados no califican al candidato B ni a StaticRange.

## Resultados completos

Cada cohorte tiene16pares de procesos A/B, con9duraciones medidas por proceso.
Las etiquetas A/B no son motores ni el candidato B. Copias físicasA0/A1 son
rustdom yJ0/J1 son jsdom en ambos modos, con inversión de asignación original.
`pairs.csv` conserva ordinales, orden real, posición, semilla y ambas copias.
No se intercambian etiquetas para hacer positivo o negativo un resultado.

| Node | Modo | Motor | Diferencia agrupada | Mediana de diferencias por par | Pares B más lento | Mediana cambio dentro del proceso |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| v22.12.0 | cpu | jsdom | +19.1964% | +4.1625% | 13/16 | +8.4395% |
| v22.12.0 | cpu | rustdom | -0.4837% | -2.7413% | 5/16 | -0.5434% |
| v22.12.0 | jit | jsdom | +5.6963% | +8.6114% | 11/16 | +22.9116% |
| v22.12.0 | jit | rustdom | +1.2932% | +0.1528% | 8/16 | -1.5053% |
| v24.14.1 | cpu | jsdom | -0.6851% | +1.0445% | 9/16 | -11.0479% |
| v24.14.1 | cpu | rustdom | -0.5223% | -1.6758% | 7/16 | -4.5334% |
| v24.14.1 | jit | jsdom | -2.2985% | -5.1369% | 6/16 | -4.1725% |
| v24.14.1 | jit | rustdom | +1.4042% | +1.3444% | 10/16 | +0.2591% |

Definiciones, sin umbrales ni decisiones de aceptación:

- Diferencia agrupada: `100*(median(144 spans B)/median(144 spans A)-1)`.
  Reproduce exactamente las ocho filas del informe publicado anterior.
- Diferencia por par: `100*(median(9 spans del proceso B)/median(9 spans del proceso A)-1)`.
  La columna muestra la mediana de los16valores; `pairs.csv` conserva todos.
- Cambio dentro del proceso: `100*(median(indices 9,10,11)/median(indices 3,4,5)-1)`.
  La tabla muestra la mediana de32procesos de cada cohorte; `process-drift.csv`
  conserva las256filas y ambos valores originales derivados. Un cambio no
  demuestra una tendencia monotónica ni que tres muestras caractericen una fase.

`span-order.csv` expone los192grupos por Node/modo/motor/label/etapa/índice,
con16procesos cada uno y mínimo/mediana/máximo. Incluye los índices warmup0–2
y medidos3–11:768warmup y2304duraciones medidas, sin exclusiones. Nueve spans
del mismo proceso comparten ejecución y entorno; no son nueve procesos nuevos.
Las mediciones CPU y JIT no son equivalentes a tiempos sin instrumentación.

## Fuentes y reproducción

El [paquete íntegro anterior](../../range-control-telemetry-results/40154725015/README.md)
conserva ZIP/tar/manifest/API/logs, perfiles y todos los recursos originales;
permanece byteidéntico. `tools/constants/exploration.json` fija cuatro exports
originales por SHA256 y el alcance de esta exploración, decidido después de la
captura. No es una modificación retroactiva del método original de599pins.

```sh
python3 -B reports/benchmarks/native-class-ownership/range-aa-exploration/40154725015/tools/explore.py \
  reports/benchmarks/native-class-ownership/range-control-telemetry-results/40154725015 \
  /directorio-de-salida-nuevo
python3 -B reports/benchmarks/native-class-ownership/range-aa-exploration/40154725015/tools/explore.spec.py \
  reports/benchmarks/native-class-ownership/range-control-telemetry-results/40154725015
```

El lector rechaza entradas alteradas, destino preexistente/solapado y Python
optimizado antes de publicar resultados. Los8contratos reales por Windows/Linux
cubren identidad de los128pares, todas las duraciones/índices, fórmulas contra
los exports autenticados, determinismo del CLI y preservación de entradas/salidas.
Los cinco outputs son byteidénticos entre plataformas. Actionlint aprueba la
extensión del workflow de lectores; el CI nuevo ejecutará también estos contratos.
No hay mocks ni librerías DOM cargadas por esta herramienta Python.

`validation/evidence.zip` conserva comandos, fuentes de validación y logs;
los scripts archivados son solo inspección. Usar los tools actuales del paquete.
No se volvió a ejecutar el sampler ni el replay para producir esta exploración:
la autenticación se apoya en los exports y replay estricto previamente publicados
en Node22.12.0/24.14.1; no se afirma una captura o validación Node nueva aquí.

## Memoria y alcance

Este cambio no altera ownership, bindings, callbacks ni caches del runtime.
La herramienta mantiene tablas acotadas a los256procesos/3072spans autenticados
y sus128pares, conserva los inputs y libera sus directorios de test al terminar.
No se midió memoria pico de Python ni se afirma ausencia universal de fugas.
La evidencia de Window/Document, contadores, endpoints y snapshots del padre
permanece en el [informe de recursos](../../../../memory/native-class-ownership-range-aa-40154725015.md).
Esta exploración no añade cobertura de memoria DOM ni reemplaza esos límites.
