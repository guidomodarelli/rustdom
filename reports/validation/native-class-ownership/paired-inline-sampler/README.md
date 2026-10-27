# Validación del sampler con C

Cuatro workers reales completaron las ocho filas, los lotes de tres warmups/nueve
muestras y las tres rondas de GC. Son 576 duraciones de validación, excluidas del
estudio de aceptación. C usa el nuevo addon con inline; A y jsdom conservan sus
pins independientes. Los paquetes se verificaron antes/después y el aislamiento
se ejerció en ambos sentidos.

Se observaron 768 Window y 768 Document distintos. Los últimos dos endpoints de
cada lote exigieron cero supervivientes y los baselines nativos de ambos paquetes:
256 endpoints claros. Los reportes conservan también cada intento inicial y sus
observaciones escalares. No son memoria pico ni ausencia universal de fugas.

El PID del primer smoke worker proviene de su reporte de afinidad, sin un registro
independiente del padre; está señalado en validation.json. Los tres restantes
registran el PID obtenido de Popen y exit 0. Ninguno integra la secuencia formal
de 64 procesos, cuyo driver debe registrar todos los PIDs independientemente.

Pasaron 23 contratos por Linux Node 22.12.0 y 24.14.1: se verifican estos workers,
pins de C, rechazo de datos antiguos y Document retenido, CLI/preflight y el
archivo histórico completo. El resultado antiguo conserva accepted=false. Los
hashes de las fuentes finales y logs se conservan; no se acredita mejora temporal.

Windows Node 24.14.1 aprobó 20 de los 23 contratos, con tres casos de preflight
Linux omitidos explícitamente. Es verificación offline de los datos Linux, no
una construcción o prueba del addon C para Windows.

La copia de build C no tiene Git y no se presenta como limpia. La procedencia
de compilación y sus entradas se registran por separado. La validación amplia
de C y la review del SHA publicado deben completarse antes de medir aceptación.

El comando completo incorporado al workflow aprobó además 29 contratos por
Linux Node 22/24 (logs ci-contracts). La validación funcional amplia de C y
sus veinte gates npm/pnpm por Node están en ../inline-candidate/; sigue
pendiente la aceptación de rendimiento y la review del SHA que los publique.
