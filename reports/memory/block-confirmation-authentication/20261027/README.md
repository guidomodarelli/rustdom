# Recursos de la calificación funcional del adaptador

`endpoints.json` conserva baselines nativos, tres rondas por worker, Window y
Document por separado, y tres snapshots parentales por SDK, en los puntos de
0/32/64 procesos completos. Hay 1.536 Window y 1.536 Document observados,
diez primeras rondas no claras y 256 estados finales claros requeridos.
Los dos fallos deliberados de progreso añaden dos Window/Document y 32 tareas
warmup, separados de los 128 procesos completos y sus 6.144 warmup.

Los datos completos están en el archivo de
`reports/benchmarks/native-class-ownership/block-confirmation-authentication/20261027/`.
Se verificó el cierre de los 140 comandos de workers y ambos padres. Los
snapshots no miden memoria pico ni demuestran ausencia universal de fugas.
Esta calificación no decide rendimiento ni modifica los rechazos históricos.
