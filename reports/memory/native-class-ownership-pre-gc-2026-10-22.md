# Observaciones finitas del ensayo pre-GC

El ensayo completo terminó antes de iniciar la corrección WPT de Windows.
Sus 256 workers y 2048 lotes observan por separado 24576 Windows y 24576
Documents, incluidos 6144 warmups exteriores por tipo. Los endpoints finales
registran cero supervivientes de ambos tipos y `clear=true`. Los contadores
nativos y las muestras de heap, memoria externa y RSS se preservan íntegros en
`reports/benchmarks/native-class-ownership/pre-gc-warmup-results/2026-10-22/`.

Los contadores de clases N-API y caches de módulo se comparan con su baseline
por proceso, no con un cero artificial. Las muestras tras cleanup no son
memoria pico ni prueban ausencia absoluta de fugas; tampoco permiten atribuir
RSS del allocator a objetos retenidos sin evidencia adicional. La integridad
del conjunto pasó; el rendimiento fue rechazado por once controles jsdom.

La corrección WPT solo cambia planificación y diagnósticos de tests. Conserva
`window.close()` en finally y las aserciones de proceso terminado. Los reportes
WPT incluyen memoria inmediatamente después de close, sin GC posterior: no
deben interpretarse como memoria retenida después de recolección. El helper
nuevo escribe los datos al filesystem y no añade un registro persistente de
referencias JS o N-API. Sus tests limpian sus directorios temporales propios.
