# Recursos de la calificación con semillas

Los siete workers positivos por Node (cinco sembrados y dos default) observan
672 Windows y672 Documents por separado, incluidos168 warmups exteriores.
Los endpoints finales están claros y el verificador comprueba baselines
nativos. Ambos Node conservan crudos en la calificación seeded-pre-gc-method:
heap, memoria externa/RSS y trazas de cleanup por lote. No es memoria pico ni
una prueba absoluta de ausencia de fugas fuera de los escenarios ejecutados.

El reporte añade tres números RNG por worker con semilla y grupos temporales
de reportes escalares en el verificador. Math.random conserva también su estado
interno del motor; no se atribuye ese almacenamiento a una fuga de DOM.
El cambio no añade referencias persistentes a
Window/Document, caches de DOM ni cambios de ownership Rust. Los workers sin
semillas mantienen el reporte anterior y también alcanzan su endpoint.
Esta evidencia funcional no aprueba rendimiento; el ensayo completo requiere
revisión, publicación y ambas versiones Node antes de decidir presupuestos.
