# Memoria de la calificación row-isolation

Linux Node22.12.0 y24.14.1:42workers DOM reales por versión,40aislados y2seeded
anteriores. Cada versión ejerce56lotes y observa672Window/672Document mediante
WeakRef; total1344de cada tipo, incluyendo336warmups de cada tipo. Los endpoints
finales requeridos se observaron claros antes de la salida de cada worker.
El verificador contrasta supervivientes y baselines nativos reales; el proceso
terminado no sustituye la liberación. Los JSON crudos preservan las tres rondas
por lote, memoria del proceso y counters expuestos, incluso acumulativos.

El arnés nuevo solo cambia la partición y selección de cargas. No agrega caches,
referencias persistentes de N-API, callbacks o timers de producción. Las mismas
reglas previas exigen counters de vida en su baseline y handles reservados acotados.
No se exige poner a cero los counters acumulativos. La calificación ejerce cinco
distribuciones oficiales con addon real; no modifica ni recompila sus fuentes.

El JSON adjunto resume conteos y alcance. Crudos completos y fuentes están en
reports/validation/native-class-ownership/row-isolation-method/qualification.tar.gz.
Son observaciones finitas, no memoria pico ni demostración universal de ausencia
de fugas. Los tiempos funcionales no se usan para aceptar rendimiento; el estudio
nuevo todavía no se ejecutó al cerrar esta calificación.
