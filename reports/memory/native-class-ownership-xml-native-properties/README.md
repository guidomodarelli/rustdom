# XML: ciclos de memoria del candidato con propiedades nativas

Se ejecutó el script real `scripts/xml-serializer-controller-memory.cjs` con
`--expose-gc` en Node 22.12.0 y 24.14.1, con jsdom independiente 27.4.0 y
rustdom, usando el addon SHA-256
`62e941778ff2974e697087ecbd4c11db5135df9b498ee08522f531442d6d50e2`.

Cada versión conserva 132 estados: 6 warmups, 108 liberaciones y 18 fases de
retención intencional. Son 57 fixtures liberados por motor, en tres realms
(default, outside-only, dangerously), con tres ciclos de seis escenarios:
éxito, getter fallido, getter de message que arroja, reentrancia, resultado
dinámico y serializer retenido. Window y Document se observan por separado,
junto con nodos, serializers, excepciones y callbacks.

Todos los 114 endpoints por Node alcanzaron dos muestras claras consecutivas:
cero supervivientes de los WeakRef observados y retorno de los campos de
recursos nativos a sus baselines. La fase held conserva los owners esperados;
al soltar el serializer también se observa su liberación. Los JSON preservan
cada intento de GC, heap JS, memoria externa y RSS, no solo el último estado.

El cambio Rust usa handles del callback síncrono y lecturas N-API, sin caches,
referencias persistentes o préstamos de TreeStore durante getters/factory.
La ruta legacy y ambas entradas comparten el guard de actividad. Las pruebas
funcionales adicionales comprueban errores primitivos, identidad, proxies,
orden de getters y teardown de workers.

La observación es finita y se limita a estos escenarios en Linux/WSL. No
demuestra ausencia absoluta de fugas, ni mide memoria pico. La retención del
allocator puede mantener RSS aunque se recolecten los owners; no se interpreta
automáticamente como fuga. El probe de preparación observa además 15 Window
y 15 Document por Node en cinco paquetes independientes; sus crudos e identidad
se preservan en la carpeta de validación.
