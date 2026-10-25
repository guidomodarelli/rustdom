# Recursos de la preparación de telemetría AA

La preparación lee fuentes y datos fijados, copia árboles de código y calcula
SHA256. No crea Window/Document, carga addons ni inicia Inspector/GC observers.
Los mapas finales enumeran 893 archivos por modo, con su recibo externo aparte.
No hay reconstrucción o instalación de paquetes ni muestras nuevas de DOM.

El wrapper real recibió intentos negativos en ambos Node/modos: con la captura
deshabilitada salió antes de crear reportes o sidecars de observación. El
binding se inspeccionó sin invocar la operación. Esas pruebas comprueban el
boundary de preparación, no el teardown del colector futuro aún pendiente.

Los directorios temporales de los seis contratos de derivación se limpian con
TemporaryDirectory. Se restaura sys.pycache_prefix y dont_write_bytecode tras
usar el productor actual; el prefijo nuevo impide sustituirlo por bytecode
preexistente. Los handles de lectura/copia pertenecen a operaciones síncronas.

No se midieron memoria pico, pendiente de RSS, liberación del allocator ni
retención del futuro profiling. No se afirma ausencia universal de fugas. El
diagnóstico futuro deberá conservar Window/Document separados, tres rondas,
dos estados finales claros y baselines, además de intentar independientemente
stop/disable/disconnect de Inspector y desconexión de PerformanceObserver.

La evidencia y los comandos reales se conservan en
reports/validation/native-class-ownership/range-control-telemetry-preparation/20261025/.
