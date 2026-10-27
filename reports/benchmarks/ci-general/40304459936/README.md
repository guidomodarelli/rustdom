# Benchmarks ordinarios del CI 9a6

Los cuatro shards del run `40304459936`, intento 1, terminaron aprobados.
Los ZIP completos, API, logs e inventarios están preservados y autenticados por
ID, run, commit del PR, nombre, tamaño, digest y ventana temporal del job.
Se conservaron once miembros por ZIP, incluidos los controles adversos de los
tests del CLI: deadline de 1 ms y workload desconocido. No se reejecutó ninguna
medición para recolectarlos. Los scripts `*.txt` son procedencia, no ejecutables.

`all-main-comparisons.csv` contiene **las 332 filas** de las cuatro particiones
principales. **213 tienen una mediana rustdom más lenta que jsdom** y 119 más
rápida. Son diferencias descriptivas, sin certificación estadística de regresión
ni pooling de hosts. Se conservan los veinte reportes de invocaciones de
contrato adicionales, incluidos fallos esperados; no sustituyen particiones.
La selección de particiones exige exactamente un reporte completo con count=4
y su índice de matriz; no depende de tiempos, aceptación o nombre de archivo.

El head del PR fue `9a6f62a982c64f5c02c54c6cd80b5a4d8474b6b7`.
El checkout real observado por los benchmarks fue el merge de CI
`6233aecf62bc1432e463166930d71f769d76416e`, cuyo padre es ese head.
Los campos Git se conservan sin normalizar. Los reportes contienen Node
**24.21.0**, hardware, entradas, metodología, muestras y hashes de sus propios
binarios. Este runtime híbrido corresponde al CI general; estos resultados no
se atribuyen al candidato numérico a277 ni a los SDK fijados de otro estudio.

El CI general terminó **8/8 aprobado**; su prueba final y los artifacts de
validación están en
`reports/validation/jsdom-block-pilot/envelope/20261026/previous-general-ci-9a6/`.
La observación inicial de esta carpeta era parcial y se conserva. No se
reevaluó el gate de ownership, cuyo rechazo sigue vigente. Estos benchmarks
no aprueban ese presupuesto ni demuestran compatibilidad completa.
