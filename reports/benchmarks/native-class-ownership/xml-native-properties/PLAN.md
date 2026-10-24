# Medición del candidato con lecturas de propiedades XML en Rust

Esta es una comparación prospectiva de otra implementación, no una repetición
del estudio consumido `39896591561`. Ese resultado continúa rechazado y sus
archivos, muestras, presupuestos y políticas de lectura no cambian.

- Candidato: fuente canónica `5ef668c47a78bb73ef5b0881fbf20e6d36c4d4cc9686198c26e722d8fc9c6806`.
  Retira las tres llamadas al helper JS para propiedades de objetos/funciones
  en la ruta de error XML. Conserva la exportación nativa anterior y el helper
  para primitivas. No introduce caches ni referencias persistentes.
- Referencia A: `checkpoint-066-reference-catalog`, fuente
  `993a1efdbd928991028f8831c62ef65fe4612b1797727afda3870c5058a87415`.
  El delta A/B incluye el controlador XML del checkpoint 067 y el arreglo de
  ownership; no atribuir toda la variación al cambio de esta sesión.
- Método: `benchmarks/xml-controller-experiment.cjs` y el wrapper
  `xml-current-run.cjs` existentes, sin cambios en algoritmo de muestreo,
  corpus, warmup, tamaños, orden, agregación ni estimador. Se conservan las
  trece filas, AA, AB y comparación directa con jsdom 27.4.0.
- Presupuestos: todas las filas AA dentro de ±2%; ninguna fila AB por encima
  de +5%. Una calibración inválida no permite aprobar el candidato. Publicar
  todas las muestras y las razones de rechazo, incluidas las filas desfavorables.
- Entorno: una ejecución en Ubuntu 22.04 x64/glibc 2.35 de GitHub Actions,
  Node 24.14.1, Rust 1.99.1, CPU 0. Registrar hardware real, herramientas,
  fuentes, paquetes, dependencias y checksums completos antes y después.
  No es una medición de rendimiento en Node 22.
- Ejecución única: workflow `xml-native-properties-evidence.yml`, etiqueta
  `xml-native-properties-v1`. No reutilizar `xml-full-inputs-v1`, reintentar
  runs ni descartar filas. Antes de lanzar: QA Node 22/24 del addon real,
  revisión independiente, commit/push y autenticación de fuentes y recibo.
- Integridad y compatibilidad son condiciones previas; no equivalen a
  aceptación de rendimiento. No cambiar los gates históricos ni crear tag
  o merge mientras los requisitos de cierre del PR 80 sigan pendientes.

El sistema sigue siendo híbrido. Esta optimización no acredita la migración
completa ni resuelve por sí sola la deuda global de velocidad respecto de jsdom.
