# Recursos de publicación, activación y lectura

Las observaciones por SDK conservan32 rechazos binarios con descriptores 4 antes y 4
después. Los contratos Node retienen la prueba de errores anteriores yposteriores
a abrir archivos. Los módulos nuevos no mantienen caches de muestras,callbacks
ni objetos DOM: trabajan con grafos acotados y bytes autenticados. Los hijos del
lector tienen timeout y maxBuffer; todo resultado parcial queda preservado.

El parser de progreso lee con el límite JSON/log de 16 MiB. Los hashes continúan
en bloques de 1 MiB con límites separados de 64 MiB por snapshot y 256 MiB por SDK.
La extracción conserva su manifiesto completo yno importa implementaciones del
archivo. Los datos medidos históricos ylos 64 funcionales no vuelven a ejecutarse.

Un contrato por SDK entra al sampler con un manifiesto inválido ytermina antes de
cargar DOM; ese proceso no es una medición ni prueba de teardown. Estas pruebas
finitas no demuestran memoria pico ni ausencia universal de fugas. Los resultados
de Document/Window del candidato siguen separados ysin aceptación nueva.
