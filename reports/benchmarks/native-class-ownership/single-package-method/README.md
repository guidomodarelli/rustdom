# Evidencia de contratos del nuevo sampler

`validation.tar.gz` conserva las fuentes congeladas y todas las salidas crudas
de las dos etapas de validación: `initial/` y `final/`. `validation.json`
identifica sus huellas, el SHA-256 del tar y los contadores. No incluye los
paquetes compilados porque son los del artefacto oficial versionado `12400802735`.
Las rutas originales de los reportes se preservan como metadata histórica.
`host.json` registra versiones, CPU y sistema observados después de los contratos:
Intel i7-1360P y WSL2 Linux 6.6.87.2; no se presenta como un host de GitHub.

Los ocho workers de contratos, cuatro por Node, produjeron 64 lotes y 576
duraciones medidas. Las ocho cargas públicas dieron los mismos hashes entre
A0, A1, C y jsdom independiente, incluidos ambos Node. Cada proceso cargó
una sola distribución física. Estos tiempos pertenecen a pruebas funcionales
del sampler y **no evalúan el presupuesto**, no forman una comparación
balanceada ni demuestran mejora o regresión del candidato.

Se conservan todas las muestras y los ocho endpoints inicialmente no claros.
Los 128 endpoints finales exigidos quedaron claros. Ver el [alcance de memoria](../../../memory/native-class-ownership/single-package-method.md)
y la [validación/revisión](../../../validation/native-class-ownership/single-package-method/README.md).
La metodología completa está en [SINGLE-PACKAGE-PROTOCOL.md](../SINGLE-PACKAGE-PROTOCOL.md).
El ensayo completo de 128 workers sigue pendiente; ownership permanece abierto.
