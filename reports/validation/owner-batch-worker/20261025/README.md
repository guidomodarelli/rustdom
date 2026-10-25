# Integración real de procesos nuevos

Pasaron 39 pruebas por Node22.12.0 y24.14.1: 32 workers de AB/posición0 cubren las
ocho filas, ambos motores y ambas etiquetas; otros cuatro rechazos comprueban
captura deshabilitada, semillas alteradas, preservación de un archivo parcial y
un manifiesto de candidato cambiado. Se conservan comandos, PID, stdout/stderr,
todos los reportes y los cambios Git crudos capturados antes de cada suite.

La revisión detectó un P2 al serializar valores arrojados que no eran Error. La
corrección usa la vista escalar existente sin reemplazar originalFailure. Tres
pruebas adicionales por SDK arrojan undefined/null/Symbol desde un observador de
progreso propio que recibe solo escalares. Ejercen DOM real, preservan exactamente
el valor original y comprueban tres rondas de cleanup del único realm creado.
fixed-node22/fixed-node24 conservan el cierre39/39. Los datos iniciales36/36 y
su versión de fuentes permanecen diferenciados y no se presentan como QA del fix.

Los 64 workers completos ejecutaron el ELF remoto4b52a84d y los controles físicos
autenticados. Usaron roots temporales previos al tar sellado; el paquete sellado
se reconstruyó y verificó por separado. Esa distinción sigue en summary.json.
La calificación integral del futuro método sobre el paquete sellado sigue pendiente.

Se guardan 9.216 duraciones funcionales medidas y3.072 de warmup, sin recortes ni
descarte de la primera tarea. Cada worker tiene doce realms, 16 tareas por bloque,
semilla original, probes RNG coincidentes, una sola distribución cargada y afinidad
del hilo principal en CPU2. Los timers son individuales y excluyen setup/validación.
La prueba contrasta todos los hashes públicos con la referencia histórica independiente.

Cada reporte conserva tres rondas de recursos y exige dos estados finales claros,
con Window y Document separados y todos los baselines nativos observados. Dos
primeras rondas no fueron claras y permanecen publicadas. El resumen de memoria
está en reports/memory/owner-batch-worker/20261025/.

Estos datos califican comportamiento y recursos del worker. No son un estudio de
rendimiento ni se usan para decidir ±2%/±5%. performanceAccepted=null,
gateReevaluated=false, executionReady=false. No hay tag/merge ni CI de rendimiento verde.
