# PR67: unión de captura intrínseca y protocolo FormData

La unión parte de 7d3c5b38c7b21aacf3a0a1169c56210136368247 e incorpora
7999c42bbd2364a9eb53c33f38e24adfbd567218 y
325fa73bb6304b01a3b7bc16ae3aa036c2973e7e, sin conflictos de código.

Las fuentes medidas tienen SHA-256
ad14895a7b0080d056700cab42f35cfbfaa91732ac07ad896e0f8584caa32625.
El archivo pr67-final-protocol/source-copy.json registra la identidad entre
el checkout de publicación y el entorno Linux ejecutado.

## Comportamiento

XML conserva las rutas de captura existentes y obtiene Symbol.iterator desde
un realm limpio sólo si ambas fuentes host faltan. Únicamente se conserva el
símbolo primitivo; el sandbox y contexto temporales se recolectan. Se emplean
APIs públicas de Node, sin ABI privada V8.

FormData valida los slots de su protocolo antes de invocarlos y obtiene los
diagnósticos del motor sin volver a ejecutar el iterador del consumidor. Las
conversiones StringCtor(value).toWellFormed() conservan sus hooks observables,
throws y IteratorClose. El constructor sigue controlado por Rust.

Los informes pr67-intrinsic-key-hardening.md y
formdata-iterator-errors/README.md conservan reproducciones, matrices, GC,
benchmarks y límites de los cambios individuales. No se atribuyen sus cifras
a una mejora general de rendimiento. La ruta extrema de realm limpio tiene
un costo propio; las conversiones y errores FormData agregan costo medido.

## Validación conjunta

La unión pasó los siete gates: formato, Clippy, 249 tests Rust, build,
2.169 contratos Node, Jest 18, Vitest 29, VM 30, HTML5 y WPT. HTML conserva
1.784 casos comparables y ocho exclusiones. WPT conserva 181 fixtures en
paridad, 48.812 resultados, 47.615 aprobados de estándar y 1.197 fallos
compartidos. El corpus sigue incompleto: continúan el bloqueo CDATA del
bootstrap Range-deleteContents y la exclusión del submitter con click real.

El archivo WPT completo quedó comprimido sin pérdida en
reports/compatibility/2026-09-15T22-37-36.147Z-linux-wpt.json.gz;
pr67-final-protocol/wpt-summary.json registra tamaños, hashes y roundtrip.
Las 46 matrices históricas FormData mayores de 256 KiB también se comprimieron:
33.046.570 bytes originales a 531.027 bytes, sin descartar casos. El manifiesto
formdata-iterator-errors/archive-manifest.json permite recuperar sus rutas
originales y verificar todos los SHA-256.

Addon final: 793f53a81b7965b8e12661c8c6be76e7e14fcc35117f697b1622e7cf7b037a63.
Paquete rustdom-rustdom-0.1.0-alpha.0-linux-x64-glibc-2026-09-15T22-40-27.520Z.tgz,
SHA-256 6379304cffc66cc3b36ffd9b051f1a4b8b941dfc0cea72464a456a64027faec4.

Pasaron 20 gates por versión de Node 22.12.0 y 24.20.0, 40 en total, con
npm 11.19.0 y pnpm aislado: tipos, CJS/ESM, assets, Workers y runners reales.
Los reportes reports/distribution/2026-09-15T22-40-30.578Z-linux-x64.json y
2026-09-15T22-42-21.960Z-linux-x64.json corresponden al mismo archivo instalado,
cuyo hash se volvió a comprobar al copiarlo al checkout de publicación.

Los 47 contratos focales de Node22 pasaron, incluida la recolección tras errores
FormData. El chequeo de contextos del realm temporal pasó 24 ciclos por runtime,
también sobre esta unión. Sus reportes son
reports/memory/2026-09-15T22-39-41.739Z-intrinsic-realm-contexts.json y
2026-09-15T22-42-16.728Z-intrinsic-realm-contexts.json. Se conservan los límites
de pruebas finitas y las observaciones de los cambios individuales.

Las mediciones de rendimiento de cada fix mantienen su fuente y addon propios:
se registran sus costos y no se presenta la unión como una mejora de velocidad.
La compilación combinada verifica ambos cambios en el mismo runtime. El nuevo
commit requiere sus propios checks y revisión; los checks de 7d3 no los sustituyen.
