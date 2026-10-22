# Una distribución por proceso: completo, sin aceptación

El [run 39727878290](https://github.com/guidomodarelli/rustdom/actions/runs/39727878290)
terminó sobre `6f70846772e68ae3265616cdc52bb43f9e3c00e8`. Los 128 workers
salieron con código 0 y produjeron las 9.216 duraciones previstas. Los dos
drivers devolvieron 1 por presupuesto; no hubo errores de ejecución.

El ZIP oficial `artifact-12405762060.zip` conserva todo el artefacto:
49.022.957 bytes, SHA-256
`51d46871123f346547c6c2dd7c75fb292ec97287113a38907fa71ea5cdfcb140`,
coincidente con GitHub. Su tar interior tiene SHA-256
`c8d8395855f057e3b60024fd0a87ac76694c2a34d8c6340213c9f82cfe4b171a`;
se comprobaron 9.087 entradas y seis enlaces relativos antes de extraer.
Incluye paquetes, dependencias, fuentes, stdout/stderr y todos los reportes.

Se cotejaron los 380 archivos de cada arnés contra los bytes del commit publicado.
El SHA-256 se conserva en
`fc25f0b60292e1a394ab792acb21a21bfdb6b6e63a6923106367439fc1febbbe`.
Los verificadores congelados reprodujeron `verified=true, accepted=false` en
Node 22.12.0 y 24.14.1; también autenticaron de nuevo la preparación completa.
Estos replays no midieron DOM, ejecutaron GC ni recompilaron paquetes.

## Decisión original, sin cambiar límites

Se mantienen ±2% jsdom, ±5% Rustdom A/A y +5% Rustdom A/B, todas las filas y
ambos Node. A/A compara las copias originales; en A/B, B identifica al candidato C.

| Node | Fase | Filas calibradas | Rango de cambio Rustdom |
| --- | --- | ---: | ---: |
| 22.12.0 | A/A | 6/8 | −3,30% a +1,74% |
| 22.12.0 | A/B | 6/8 | −2,65% a +4,51% |
| 24.14.1 | A/A | 5/8 | −1,58% a +1,06% |
| 24.14.1 | A/B | 6/8 | −0,70% a +3,19% |

Todos los puntos Rustdom A/A están dentro de ±5% y ninguno A/B supera +5%.
La aceptación global sigue siendo falsa por el control jsdom: nueve de las
32 filas no calibran. No se aceptan solo las filas calibradas ni se interpreta
el rechazo como un error del CI general. En Node 22 A/A, el control llega a
−4,48% sin ejecutar C; las diferencias no permiten una atribución al guard.

El cálculo Python independiente conserva las 32 filas en analysis.json/rows.csv
y coincide con el estimador original de medianas agrupadas. process-rows.json
conserva 1.024 medianas descriptivas por proceso/fila, con PID y tratamiento;
no reemplaza el estimador ni convierte las muestras internas en procesos nuevos.

## Condiciones y recursos

El host fue AMD EPYC 7763, cuatro vCPU, Linux 6.8.0-1070-azure, runner Ubuntu
22.04. Node 22 ejecutó de 05:25:19 a 05:50:58 UTC y Node 24 de 05:50:59 a
06:14:10 UTC del 2026-10-22. Se usaron los paquetes oficiales del run 39720077911,
sin reconstruirlos ni mezclarlos con los binarios locales de otros estudios.

Cada worker cargó una sola distribución física, comprobada antes/después.
Se observaron 12.288 referencias de Window y otras tantas de Document,
incluidas las de warmup, con checks de longitud en el sampler. Las 3.072
observaciones de limpieza se conservan: 88 estados iniciales no claros y
2.048 endpoints finales exigidos claros, con baselines nativos verificados.
Los 88 estados no representan 88 objetos distintos ni fugas persistentes.

memory-ranges.json separa todos los estados de limpieza de los dos endpoints
finales, por Node/fase/motor/tratamiento y paquetes físicos. Son observaciones del proceso con una copia
del paquete, después de GC, no picos ni una prueba universal de ausencia de fugas.
El número de endpoints es menor que en el estudio anterior porque ya no observa
dos runtimes después de cada lote; no significa por sí mismo menor retención.

## Continuación

Retirar la coexistencia de dos paquetes no alcanzó para calibrar el conjunto.
Este ensayo terminó y no se repite; no hay merge ni checkpoint de ownership.
Los resultados anteriores se conservan y no se cambian los presupuestos.

order-factors.json registra una restricción del diseño: el orden de motores y
el orden A/B de cada par usan la misma paridad. Para cada motor solo aparecen
dos de las cuatro combinaciones posibles de esas dos variables. Es una
observación del schedule, no una prueba de que cause la variación medida.
Antes de otro ensayo se requiere evaluar un balance independiente de ambos
órdenes, con método, pruebas y revisión publicados antes de medir. No se
adopta todavía como solución demostrada ni se reinterpreta la aceptación actual.

El CI general de 181957b9 aprobó sus ocho checks; se conserva por separado en
`reports/validation/native-class-ownership/ci-181957b9/`. Ese éxito no sustituye
la aceptación de rendimiento. El producto sigue siendo híbrido y este estudio
no acredita nuevas APIs migradas.

`analyze.py` recalcula las filas/decisión y `describe-resources.py` genera los
rangos/factores desde el tar extraído, sin ejecutar DOM ni nuevas muestras.
