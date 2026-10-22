# Recursos del diagnóstico de módulos de carga

La secuencia jsdom A/A completó 32 procesos y 64 lotes, en Node22/24. El worker
comprobó 12 WeakRef de Window y 12 de Document por lote, incluyendo warmups:
768 observaciones por tipo. El análisis offline recalculó 256 comprobaciones
finales por etiqueta; cada lote conservó tres rondas y dos endpoints finales
claros. Los procesos terminaron con exit0.

Solo se ejercitó jsdom 27.4.0. No se cargó el addon Rust ni se midieron contadores
nativos de C. Los snapshots de memoria están después de limpieza/GC, no son
picos ni una prueba universal de ausencia de fugas. Las observaciones no aceptan
el presupuesto de ownership ni resuelven por sí mismas el problema del runner.

Método, hardware, fuentes congeladas, datos y análisis reproducible en
[runner-sharing-diagnostics](../../benchmarks/native-class-ownership/runner-sharing-diagnostics/2026-10-22/README.md).
