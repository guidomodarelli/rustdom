# Recursos del contraste con contexto completo

La secuencia jsdom A/A terminó con ocho procesos y 128 lotes, Node22 antes de
Node24. El worker comprobó 1.536 WeakRef de Window y 1.536 de Document,
incluyendo los warmups. El análisis recalculó 512 comprobaciones finales por
etiqueta y mantuvo dos endpoints claros al final de cada lote.

Los tres ciclos de limpieza por lote y el timeout del worker permanecieron
acotados. Los Maps guardan únicamente checksums de ocho filas y las listas
de observación contienen WeakRef; no se introdujeron referencias fuertes al DOM.
Todos los workers y ambos drivers terminaron con exit0.

Solo se ejecutó jsdom27.4.0. No se cargó el addon Rust ni se midieron sus
contadores nativos. Los datos post-GC no son memoria pico ni prueban ausencia
universal de fugas. No conceden aceptación del presupuesto de ownership.

Método, hardware, todas las observaciones y análisis portable:
[runner-sharing-context-diagnostics](../../benchmarks/native-class-ownership/runner-sharing-context-diagnostics/2026-10-22/README.md).
