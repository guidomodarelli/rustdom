# Liberación diferida en el contrato funcional

El fallo real de CI 39706343650/shard2 conservó dos Window/Document en sus dos
primeras rondas y alcanzó cero en la tercera. El contrato requería dos rondas
claras, pero agotaba su límite de tres justo después de la primera.

La prueba funcional ahora usa la política acotada existente de quiescencia:
12 rondas/10 segundos, con dos observaciones claras consecutivas y comparación
de todos los contadores nativos requeridos contra su baseline. Los samplers de
rendimiento conservan las tres rondas y su decisión real; no se relajan.

Node 22.12.0 y 24.14.1 aprobaron seis contratos de recursos cada uno, usando
jsdom 27.4.0, C y checkpoint67. Se conservaron 56 endpoints con 672 Window y
672 Document observados por tipo. Además, 24 ciclos de regresión sostuvieron
un Document durante tres observaciones, lo soltaron y exigieron al menos cinco
rondas y dos finales claros. La retención persistente sigue siendo rechazada.

Logs, observaciones y fuentes probadas en
[runner-sharing](../../validation/native-class-ownership/runner-sharing/README.md).
El fallo y su log original están en
[ci-quiescence-93856fdd](../../validation/native-class-ownership/ci-quiescence-93856fdd/README.md).
Son endpoints posteriores a GC; no son memoria pico ni una prueba universal
de ausencia de fugas. Este cambio modifica tests, no ownership del runtime.
