# Contratos reales del sampler en Node 22 y 24

Por SDK pasaron 22 pruebas sin mocks de plataforma: dieciséis casos de las ocho
filas en jsdom y rustdom, una fila completa de doce realms, dos errores de progreso
con valores originales, dos controles retenidos separados y un rechazo de captura
no habilitada. Cada SDK conserva 448 tareas cronometradas funcionales, con hashes
de salida iguales a los originales, 144 tiempos medidos y 48 warmup en la fila
completa. No se convierten esos 144 tiempos en procesos independientes.

observations.json conserva los tiempos, resultados escalares, Native allocations y
23 probes de recursos por SDK. Los estados retenidos quedan visibles. Los probes
de liberación exigen las dos rondas finales claras, Window/Document separados y
las familias nativas de vuelta al baseline. Son pruebas finitas; no garantizan
ausencia universal de fugas ni miden memoria pico.

summary.json registra hashes del código ejecutado, HEAD y cambios Git reales del
código nuevo y del compilador local. Los archivos nuevos aún no estaban commiteados
al ejecutar estos contratos; no se declara un checkout limpio. El ELF probado es
f8c8af92, no el remoto seleccionado 4b52a84d. Los comandos y sus stdout/stderr se
preservan por SDK. Las duraciones son datos de calificación funcional: no hubo
captura científica, aceptación numérica ni modificación de los rechazos anteriores.
