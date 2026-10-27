# Memoria de los contratos de orden independiente

Se observaron por separado Window y Document en 16 workers reales: ocho por
Node 22.12.0/24.14.1, repartidos entre el método legado y el nuevo. Cada proceso
cargó un único paquete preparado A0, A1, C o jsdom. Las ocho cargas públicas,
3 warmups, 9 muestras y 3 rondas finales de cleanup se conservaron sin cambios.

Los contadores recalculados desde el tar dan 1.536 referencias Window y 1.536
Document, 384 observaciones de cleanup y 256 endpoints finales exigidos claros.
Se conservan 12 observaciones iniciales no claras. No equivalen a doce objetos
únicos ni demuestran doce fugas. Las dos rondas finales de cada lote cumplen
`clear=true` y ambos tipos tienen cero supervivientes. Los reportes conservan
también baselines y estados nativos; los contratos ejercen el verificador real.

`reports/benchmarks/native-class-ownership/independent-order-method/analysis.json`
incluye los rangos heapUsed/external/RSS por reporte, versión, motor, fase,
tratamiento y paquete físico, separando todas las rondas de las dos finales.
Los valores corresponden al proceso completo tras GC; no miden picos ni memoria
exclusiva del DOM. Las muestras crudas y los estados nativos permanecen en
`contracts-and-sources.tar.gz` junto con las fuentes exactas y los logs.

Esta comprobación finita verifica la liberación observable de estos escenarios.
No certifica ausencia universal de fugas ni atribuye RSS retenido al DOM o al
allocator. No modifica el ownership del producto ni sustituye la secuencia
completa de rendimiento/memoria, todavía pendiente. No hay nueva afirmación
de mejora de memoria.
