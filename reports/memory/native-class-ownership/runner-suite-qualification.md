# Recursos de la calificación de runners

Se ejecutaron doce CLIs completos con los paquetes oficiales A y C, Node
22.12.0 y24.14.1, Jest, Vitest normal y los dos pools VM. Los 372 tests incluyen
16 probes que observan 32 asignaciones NativeRange al crear y clonar rangos
desde los globals reales. No se observó la liberación individual de esas
32 asignaciones y no se convierten esos contadores en evidencia de ausencia
de fugas. El producto y su ownership Rust no cambiaron.

El probe obtiene `document` mediante un callback del realm de ejecución para
funcionar también en VM; no almacena Window/Document en los resultados. Sus
objetos locales quedan bajo el ciclo de vida normal del test y el teardown
existente del entorno. No agrega caches o listeners globales persistentes.
Los drivers conservan rutas, estados, JSON y contadores escalares; cierran
descriptores de logs incluso al fallar el proceso.

El exit de cada CLI libera sus recursos de proceso, pero no demuestra que
Window o Document fueran recolectados antes del exit. No se midieron aquí
heap retenido, memoria externa, RSS pico o pendientes de memoria por ciclo.
Las observaciones previas de memoria mantienen sus propios escenarios y
límites; este arnés no las sustituye.

Los fallos de suite incompleta y carga de configuración se preservan junto
con sus estados parciales. Las dependencias duplicadas omitidas del tar tienen
bytes, enlaces y modos iguales a la copia completa conservada; esa reducción
de almacenamiento no es una medición de memoria del runtime.

Ver crudos y metodología en
`reports/validation/native-class-ownership/runner-suites-qualification/`.
