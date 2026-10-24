# Método nativo de observación de compilación, sin captura completa nueva

La lectura de posiciones de los 80 lotes anteriores no identifica un mecanismo
universal de variación. Los perfiles CPU no registran eventos de compilación o
tiers; el protocolo nuevo observa categorías nativas de V8 sin cambiar sampler,
fixtures, warmups, muestras, paquetes o limpieza. Los flags de tracing añaden
overhead y no se comparan con tiempos del CPU profiler.

La prueba de capacidad CLI y los contratos reales en ambos Node pasan: cuatro
procesos DOM, 32 cargas, 384 spans, eventos compilador/hilos y salidas iguales.
Los contratos y su memoria están conservados por separado; no se incorporarán
a la captura de diez procesos prevista, que todavía no se ejecutó.

Crudos, fuentes y hashes en
`reports/validation/native-class-ownership/compilation-diagnostics-method/`.
La decisión de rendimiento 39735778846 continúa rechazada y ownership abierto.
