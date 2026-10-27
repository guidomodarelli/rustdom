# Diagnóstico descriptivo del orden de lotes

Análisis offline de la secuencia C completa; no ejecuta cargas ni modifica su aceptación.
Incluye las 64 combinaciones Node/fase/motor/fila y las 9.216 duraciones originales.
El script verifica los 931 archivos del estudio y reproduce exactamente las medianas
de cada proceso y las agrupadas del verificador JavaScript antes de describir el orden.
Linux Python3.10 y Windows Python3.12 produjeron analysis.json idéntico byte por byte.

## Observación concreta

En jsdom Node22 A/A range-control-1000/250, el primer lote cronometrado fue más lento
que el segundo en 7/8 procesos. La mediana descriptiva de las ocho diferencias
primero/segundo es +36,250775%, con rango −5,472932% a +67,446205%.
A fue primero cuatro veces (+44,199114% de mediana descriptiva) y B otras cuatro
(+22,404436%). Las asignaciones J0/J1 y el orden de carga también se conservaron.
Balancear las etiquetas no eliminó la asociación observada con el orden de lotes.

La diferencia original de medianas agrupadas B/A permanece −16,542983%, sin calibrar.
El diagnóstico primero/segundo no la reemplaza ni es una comparación de tratamientos.
A/A de jsdom no ejecuta el candidato Rust C. Estos datos no identifican una causa:
no registran tiering, actividad de compilación ni eventos GC dentro del cronómetro,
y tampoco conservan duraciones de warmup. No prueban que esas causas expliquen el patrón.

| Posición | Físicos A/B | Carga | Primer lote | Mediana A ms | Mediana B ms | Primero/segundo Δ% |
| --- | --- | --- | --- | ---: | ---: | ---: |
| 0 | J0/J1 | A/B | B | 1.428704 | 1.350512 | -5.472932 |
| 1 | J0/J1 | B/A | B | 1.442925 | 1.842477 | +27.690420 |
| 2 | J1/J0 | A/B | B | 1.465816 | 1.716741 | +17.118451 |
| 3 | J1/J0 | B/A | B | 1.487077 | 2.490054 | +67.446205 |
| 4 | J0/J1 | A/B | A | 1.939920 | 1.463723 | +32.533273 |
| 5 | J0/J1 | B/A | A | 2.217565 | 1.584334 | +39.968277 |
| 6 | J1/J0 | A/B | A | 2.365681 | 1.593803 | +48.429950 |
| 7 | J1/J0 | B/A | A | 2.327144 | 1.485163 | +56.692834 |

## Todas las combinaciones

La calibración y el delta agrupado siguientes son los originales, sin recalcular una
decisión alternativa. Primero más lento es solo un conteo descriptivo entre ocho procesos.
analysis.json conserva cada PID, posición, físico, orden, índices y medianas por etiqueta.

| Node | Fase | Motor | Carga/tamaño | Δ agrupado original % | Fila original calibra | Primero más lento | Mediana primero/segundo Δ% |
| --- | --- | --- | --- | ---: | --- | ---: | ---: |
| v22.12.0 | AA | jsdom | mutation-records-collect/100 | +0.545197 | Sí | 3/8 | -6.057446 |
| v22.12.0 | AA | jsdom | mutation-records-collect/1000 | +0.033080 | Sí | 5/8 | +5.635540 |
| v22.12.0 | AA | jsdom | observer-delivery-records/100 | -6.278118 | No | 5/8 | +4.465238 |
| v22.12.0 | AA | jsdom | observer-delivery-records/1000 | -0.042161 | Sí | 3/8 | -0.355471 |
| v22.12.0 | AA | jsdom | range-control-1000/1000 | +2.375559 | No | 2/8 | -12.373702 |
| v22.12.0 | AA | jsdom | range-control-1000/250 | -16.542983 | No | 7/8 | +36.250775 |
| v22.12.0 | AA | jsdom | range-state-lifecycle-1000/1000 | -6.794801 | No | 3/8 | -9.419447 |
| v22.12.0 | AA | jsdom | range-state-lifecycle-1000/250 | -1.802236 | Sí | 6/8 | +7.618770 |
| v22.12.0 | AA | rustdom | mutation-records-collect/100 | -0.193601 | Sí | 0/8 | -4.945781 |
| v22.12.0 | AA | rustdom | mutation-records-collect/1000 | -1.378399 | Sí | 6/8 | +0.565900 |
| v22.12.0 | AA | rustdom | observer-delivery-records/100 | -0.243651 | No | 2/8 | -3.714227 |
| v22.12.0 | AA | rustdom | observer-delivery-records/1000 | +3.738681 | Sí | 3/8 | -2.517206 |
| v22.12.0 | AA | rustdom | range-control-1000/1000 | -1.310793 | No | 1/8 | -2.219515 |
| v22.12.0 | AA | rustdom | range-control-1000/250 | +2.105292 | No | 8/8 | +18.580793 |
| v22.12.0 | AA | rustdom | range-state-lifecycle-1000/1000 | +0.411063 | No | 3/8 | -1.885967 |
| v22.12.0 | AA | rustdom | range-state-lifecycle-1000/250 | +2.585210 | Sí | 5/8 | +1.770218 |
| v22.12.0 | AB | jsdom | mutation-records-collect/100 | -3.419620 | No | 4/8 | +0.036234 |
| v22.12.0 | AB | jsdom | mutation-records-collect/1000 | +0.049417 | Sí | 4/8 | -0.806841 |
| v22.12.0 | AB | jsdom | observer-delivery-records/100 | -1.538943 | Sí | 5/8 | +2.053449 |
| v22.12.0 | AB | jsdom | observer-delivery-records/1000 | +2.268166 | No | 6/8 | +1.047404 |
| v22.12.0 | AB | jsdom | range-control-1000/1000 | +0.865991 | Sí | 1/8 | -13.899760 |
| v22.12.0 | AB | jsdom | range-control-1000/250 | +12.506767 | No | 7/8 | +44.500962 |
| v22.12.0 | AB | jsdom | range-state-lifecycle-1000/1000 | +1.709817 | Sí | 2/8 | -3.622955 |
| v22.12.0 | AB | jsdom | range-state-lifecycle-1000/250 | +4.369554 | No | 6/8 | +9.024131 |
| v22.12.0 | AB | rustdom | mutation-records-collect/100 | -0.602169 | No | 4/8 | -0.132821 |
| v22.12.0 | AB | rustdom | mutation-records-collect/1000 | -0.621998 | Sí | 5/8 | +1.499194 |
| v22.12.0 | AB | rustdom | observer-delivery-records/100 | -3.664409 | Sí | 1/8 | -9.732884 |
| v22.12.0 | AB | rustdom | observer-delivery-records/1000 | -0.010483 | No | 3/8 | -1.156176 |
| v22.12.0 | AB | rustdom | range-control-1000/1000 | -2.703189 | Sí | 4/8 | -0.241971 |
| v22.12.0 | AB | rustdom | range-control-1000/250 | -2.543352 | No | 5/8 | +18.392371 |
| v22.12.0 | AB | rustdom | range-state-lifecycle-1000/1000 | +1.791277 | Sí | 3/8 | -1.525452 |
| v22.12.0 | AB | rustdom | range-state-lifecycle-1000/250 | -2.420192 | No | 5/8 | +0.224555 |
| v24.14.1 | AA | jsdom | mutation-records-collect/100 | +1.651450 | Sí | 3/8 | -0.846126 |
| v24.14.1 | AA | jsdom | mutation-records-collect/1000 | -3.030080 | No | 6/8 | +5.827964 |
| v24.14.1 | AA | jsdom | observer-delivery-records/100 | -2.964086 | No | 5/8 | +3.276829 |
| v24.14.1 | AA | jsdom | observer-delivery-records/1000 | +1.964621 | Sí | 4/8 | +1.265571 |
| v24.14.1 | AA | jsdom | range-control-1000/1000 | +0.386928 | Sí | 7/8 | +5.669117 |
| v24.14.1 | AA | jsdom | range-control-1000/250 | +3.976293 | No | 4/8 | +0.231705 |
| v24.14.1 | AA | jsdom | range-state-lifecycle-1000/1000 | +1.788009 | Sí | 5/8 | +1.822144 |
| v24.14.1 | AA | jsdom | range-state-lifecycle-1000/250 | -0.223319 | Sí | 3/8 | -1.052417 |
| v24.14.1 | AA | rustdom | mutation-records-collect/100 | +1.522987 | Sí | 2/8 | -1.685074 |
| v24.14.1 | AA | rustdom | mutation-records-collect/1000 | -1.259845 | No | 3/8 | -1.013432 |
| v24.14.1 | AA | rustdom | observer-delivery-records/100 | +1.052914 | No | 3/8 | -2.637574 |
| v24.14.1 | AA | rustdom | observer-delivery-records/1000 | -2.955208 | Sí | 4/8 | +0.451051 |
| v24.14.1 | AA | rustdom | range-control-1000/1000 | +4.249837 | Sí | 3/8 | -1.793033 |
| v24.14.1 | AA | rustdom | range-control-1000/250 | -0.968534 | No | 6/8 | +2.994846 |
| v24.14.1 | AA | rustdom | range-state-lifecycle-1000/1000 | +3.198772 | Sí | 5/8 | +0.621998 |
| v24.14.1 | AA | rustdom | range-state-lifecycle-1000/250 | +2.976698 | Sí | 4/8 | +0.223635 |
| v24.14.1 | AB | jsdom | mutation-records-collect/100 | -1.302265 | Sí | 3/8 | -5.346578 |
| v24.14.1 | AB | jsdom | mutation-records-collect/1000 | +1.526084 | Sí | 5/8 | +3.527653 |
| v24.14.1 | AB | jsdom | observer-delivery-records/100 | -0.983707 | Sí | 6/8 | +2.310724 |
| v24.14.1 | AB | jsdom | observer-delivery-records/1000 | +2.342850 | No | 3/8 | -0.536250 |
| v24.14.1 | AB | jsdom | range-control-1000/1000 | +3.531075 | No | 5/8 | +2.359537 |
| v24.14.1 | AB | jsdom | range-control-1000/250 | -2.530126 | No | 5/8 | +2.908627 |
| v24.14.1 | AB | jsdom | range-state-lifecycle-1000/1000 | -0.199901 | Sí | 4/8 | +0.281098 |
| v24.14.1 | AB | jsdom | range-state-lifecycle-1000/250 | -1.244243 | Sí | 3/8 | -0.864457 |
| v24.14.1 | AB | rustdom | mutation-records-collect/100 | +0.704117 | Sí | 0/8 | -4.978503 |
| v24.14.1 | AB | rustdom | mutation-records-collect/1000 | +0.951976 | Sí | 3/8 | -0.818636 |
| v24.14.1 | AB | rustdom | observer-delivery-records/100 | -0.121158 | Sí | 1/8 | -3.550710 |
| v24.14.1 | AB | rustdom | observer-delivery-records/1000 | -2.995657 | No | 2/8 | -4.521687 |
| v24.14.1 | AB | rustdom | range-control-1000/1000 | +5.189336 | No | 4/8 | +1.211879 |
| v24.14.1 | AB | rustdom | range-control-1000/250 | -1.216364 | No | 5/8 | +1.229378 |
| v24.14.1 | AB | rustdom | range-state-lifecycle-1000/1000 | -2.214659 | Sí | 6/8 | +0.525500 |
| v24.14.1 | AB | rustdom | range-state-lifecycle-1000/250 | +0.490506 | Sí | 2/8 | -2.960479 |

## Reproducción y siguiente paso

```sh
python -B reports/benchmarks/native-class-ownership/paired-inline-diagnostics/2026-10-22/analyze.py --output .cache/inline-analysis-recomputed.json
```

El destino debe tener su directorio creado. Comparar el resultado con analysis.json.
La comprobación cruza todos los cálculos con el archivo original y no carga un addon.
Es un diagnóstico posterior a observar los datos, no un análisis predeclarado para aceptación.
No habilita seleccionar otra mediana, quitar muestras, relanzar la secuencia idéntica o
aceptar el presupuesto anterior. Investigar el aislamiento y el estado compartido del
runner con una hipótesis y un protocolo nuevos antes de tomar más mediciones.
