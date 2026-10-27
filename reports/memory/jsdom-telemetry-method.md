# Recursos de la herramienta de diagnóstico de jsdom

La calificación final ejecutó 32 procesos reales y observó 384 Window y
384 Document por separado. Los 64 endpoints finales requeridos quedaron
claros antes de salir; también se conservan las rondas iniciales no claras.
Las 16 sesiones Inspector iniciadas se detuvieron y desconectaron. Los
16 procesos JIT no crearon una sesión Inspector. El observer conserva solo
escalares y se desconecta en finally; no se agregaron referencias DOM.

| Node / modo | Procesos | Window | Document | Primeros endpoints no claros | Finales claros |
| --- | ---: | ---: | ---: | ---: | ---: |
| v22.12.0/cpu | 8 | 96 | 96 | 2 | 16 |
| v22.12.0/jit | 8 | 96 | 96 | 1 | 16 |
| v24.14.1/jit | 8 | 96 | 96 | 0 | 16 |
| v24.14.1/cpu | 8 | 96 | 96 | 0 | 16 |

Los rangos completos de heapUsed, heapTotal, RSS, external y arrayBuffers
están en el JSON, con todas las rondas. Son snapshots tras GC y no memoria
pico. La finalización del proceso no sustituye las observaciones previas.
No se afirma ausencia universal de fugas ni se valida ownership nativo de
rustdom: este diagnóstico solo ejerce jsdom y las herramientas de Node.

Los dos intentos iniciales parciales y la recuperación del lector están
conservados por separado en el archivo de validación; no se suman como
muestras de la captura completa, que aún no se lanzó.
