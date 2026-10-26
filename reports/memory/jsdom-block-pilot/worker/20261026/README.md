# Teardown del productor funcional

Los archivos por SDK conservan tres snapshots del padre, cada endpoint de los
16 procesos positivos y el fallo real del callback. `fixed-auth/` es la época
corregida; los archivos de la raíz son preliminares y se mantienen separados.

La época final observó 386 Window y386 Document por separado, en32 positivos y
dos procesos adversos con DOM. Los34 procesos conservaron tres rondas y dos
estados finales claros; hubo dos primeras rondas no claras, publicadas en el
análisis y raw. Los otros diez adversos rechazaron entradas/salida antes de DOM.
Los positivos conservan4608 duraciones/1536 warmup y los adversos32 warmup
adicionales. Es validación funcional, no una captura ni comparación de rendimiento.

Cada child usa un grupo propio del runner existente, con timeout, cancelación,
cierre de descriptores y comprobación de grupos sobrantes. Los callbacks reciben
solo escalares y no escapan referencias DOM. El padre conserva estadísticas y
trazas escalares; no carga los runtimes de los hijos. El test de error conserva
la excepción y comprueba Window/Document después de cerrar el realm.

Solo se ejecutó jsdom independiente: no se inventan baselines ni counters
nativos para estos controles y no se atribuyen al ELF a277. Los snapshots son
endpoints, no memoria pico. Las pruebas finitas no demuestran ausencia universal
de fugas, ni reemplazan el estudio integral futuro de Rust y su puente.
