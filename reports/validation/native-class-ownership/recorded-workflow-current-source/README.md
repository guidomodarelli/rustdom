# Replay histórico y rechazo de fuentes actuales

El contrato de CLI invocaba el gate desde el checkout actual mientras esperaba
el rechazo de presupuesto (`exit1`) de una captura antigua. El gate devuelve
correctamente `exit2` cuando la implementación difiere de la medida. El test
ahora usa el candidato físico autenticado de esa captura para comprobar todos
sus resultados: 7429 archivos, 1024 workers y 9216 duraciones por Node, con
cuatro controles jsdom rechazados en Node22 y tres en Node24. No se modifica
ningún presupuesto ni se acepta ese archivo.

Una regresión independiente modifica una copia real de la implementación y
exige `exit2`, sin resultados de rendimiento. Se conserva además el rechazo
de un build script cambiado. Los 35 contratos de transporte, evidencia y CLI
pasaron por Node22.12.0 y Node24.14.1 con directorios temporales separados.
El gate ejecutado desde las fuentes actuales conserva `exit2` en ambos.

Se archivaron logs, salidas de procesos reales y sus hashes en raw-members.json.
No se ejecutó DOM, GC ni ninguna medición nueva. Los tests recalculan archivos
originales completos; los tiempos de estos tests no son benchmarks del producto.

La primera corrida local concurrente compartía `/tmp`: Node24 pasó33/35 y
dos snapshots globales observaron temporales creados por Node22. Además,
editar el wrapper local mientras seguía ejecutándose truncó el log de Node22;
ese intento no demuestra un resultado de suite. Se conservan ambos logs
iniciales. Las corridas finales usaron `TMPDIR` distinto por perfil y fixtures
con salidas nuevas, manteniendo intactas las capturas originales.

La revisión aislada Codex cerró el hallazgo de Python optimizado y terminó
sin hallazgos accionables en el delta de código. La evidencia XML aprobada
está separada de ownership; el rendimiento de ownership continúa pendiente.
No hay tag ni merge del PR80.
