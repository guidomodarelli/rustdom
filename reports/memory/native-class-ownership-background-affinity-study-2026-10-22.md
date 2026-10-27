# Liberación observada en el estudio original de afinidad auxiliar

El estudio original terminó en Node 22.12.0 y 24.14.1. Sus 2048 workers salieron
con exit 0 y pasaron la verificación completa de recursos e identidad. Cada uno
registró 12 Window y 12 Document: 24576 observaciones de cada tipo, incluidos
6144 owners de warmup por tipo. Los dos últimos endpoints de cada worker
estuvieron claros antes de salir.

El JSON compañero vincula por hash los 2048 registros de endpoints finales.
Los crudos completos conservan también las trazas y muestras de memoria en
reports/benchmarks/native-class-ownership/background-affinity-results/2026-10-22/.
La verificación del archivo no vuelve a ejecutar workloads o GC.

Son observaciones finitas de los owners declarados y los contratos del método.
No demuestran ausencia universal de fugas, crecimiento en procesos longevos o
memoria pico. Los snapshots RSS/heap/external no se convierten en garantías de
consumo estable. El resultado de rendimiento sigue rechazado; liberar estos
owners no aprueba los presupuestos numéricos.
