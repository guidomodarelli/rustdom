# Evidencia de la propuesta de auditoría de geometría

Solo inspección de fuentes e integridad de datos; sin ejecutar DOM, suites,
benchmarks ni otra captura durante el ensayo activo de ownership.

`receipt.json` enlaza los cinco originales con sus SHA del catálogo versionado,
los cinco módulos construidos y el bridge con el manifest fijado del paquete
oficial B, y las fuentes de implementación/build/tests de la base auditada.
No se recalcula el hash completo de los 531 archivos del paquete de referencia.
La correspondencia del bridge incluye la sustitución de import hecha por build.
`sources/` conserva los bytes exactos y `diffs/` las diferencias de los módulos
originales/construidos. No se modificaron esos paquetes.

Se comprobaron veinte IDs de cuerpos y diecisiete IDs de API del catálogo.
Las dos entradas de metadata `@@toStringTag` permanecen fuera de la propuesta.
No se regeneró ni cambió el ledger y no se acreditan APIs o módulos completos.
Los tests y resultados de memoria citados son históricos, con los límites
descritos en `reports/validation/dom-rect.md` y en la propuesta. No hay una
mejora de rendimiento o una prueba nueva de ausencia de fugas.
