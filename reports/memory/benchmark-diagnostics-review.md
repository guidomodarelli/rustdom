# Recursos del diagnóstico del benchmark

Esta corrección afecta solamente al proceso CLI que agrega resultados; no modifica ownership Rust, N-API, wrappers DOM, eventos ni teardown de los entornos.

Se revisó la nueva retención: cada invocación tiene un `BenchmarkReport` local, cuatro procesos secuenciales como máximo y el mismo límite de captura de 16 MiB por worker. Se mantienen las salidas de esos procesos para poder persistirlas ante un fallo posterior; la retención es acotada por el plan y sus límites de captura, además de las muestras que ya se conservaban. No hay caché global, listeners, timers ni handles adicionales; las escrituras usan operaciones síncronas de archivos.

Los tests consumen artefactos reales y eliminan sus directorios temporales propios mediante teardown. En los errores de persistencia conservan la causa original y verifican que el archivo preexistente no se sobrescribe. Los procesos CLI reales finalizaron en todos los escenarios, con éxito o código 1 esperado, en Node 22.12.0 y 24.14.1.

Los benchmarks guardan `memoryAfterCleanup` de los workers como antes. No se midió el pico de memoria del agregador ni se repitió Valgrind porque el código nativo no cambió. Esta revisión demuestra ausencia de nuevas estructuras de crecimiento ilimitado en el flujo de cuatro procesos; no prueba ausencia absoluta de fugas.
