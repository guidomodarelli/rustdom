# Próximo cambio a investigar, sin nueva medición todavía

El rechazo completo y la autorización permanente no habilitan repetir el run
40184510898 ni integrar su candidato como aceptado. El objetivo general sigue abierto.

En benchmarks/ownership-operations.cjs, control() ejecuta cloneRange(), collapse()
y compareBoundaryPoints(); lifecycle() crea Range, lo clona, construye StaticRange,
actualiza un endpoint y lee offsets. lifecycle() no invoca collapse(). Estos archivos
pertenecen al grafo preservado de la medición y no se cambiaron.

El candidato publicado añade construcción StaticRange en Rust y un fast path de
collapse para owners iguales. La parte StaticRange conserva cuatro lecturas
potenciales de nodeType y callbacks síncronos de identificación de ambos owners,
además del transporte y creación del estado nativo. Es una hipótesis de costo para
lifecycle, no causalidad demostrada por los tiempos ni un motivo para borrar filas.

El siguiente candidato debe reducir cruces o transporte de construcción sin mover
las decisiones DOM de vuelta a JavaScript, cambiar lecturas observables/getters,
perder errores de realm/reentrancia ni retener referencias JS. Contrastar contra
jsdom independiente y los casos adversariales existentes, observar Window y Document
por separado y conservar la salida binaria anterior para el replay histórico.

La calibración también permanece rechazada: 31/32 controles jsdom no cumplieron
intervalos ±2%. Una investigación posterior debe justificar y revisar su diseño
antes de ejecutarse, conservando denominadores, criterios originales y este rechazo.
No llamar aceptado a un resultado por mejorar solo un workload o cambiar presupuestos.
