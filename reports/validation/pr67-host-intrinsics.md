# Unión de captura intrínseca y valores host de FormData

Validación local conjunta aprobada el 16/09/2026 UTC. El merge requiere todavía checks y revisión del nuevo commit publicado.

Base: 65abdbc1214fc2fa73ca67c50133f16d43648e63. Fixes locales integrados: cd94270411ddb0be1424fb3d555b99835fef80d7 y 49d52ba4c7edef474875b8612990c72d67f020e3. Runtime: /home/guido/rustdom-pr67-host-intrinsics-CTPtGb, con Git en la misma base.

SHA-256 de fuentes: 782808299539c841b3ac982fbbb37517d9332a8fddfa8e7b9f7e1323df0d0a97.
SHA-256 del addon: b3fcad02f2cbedff348930d9f9374b36f5d497b7f92f68b80f242dcb4ae0f903.
source-copy.json verifica que las fuentes de publicación y ejecución son idénticas.

## Comportamiento y ownership

XML captura el símbolo de iteración desde una propiedad propia del objeto arguments estricto recién creado. Elimina la dependencia de prototipos modificables y process.getBuiltinModule durante la carga del addon. pr67-loader-hardening.md documenta las cargas equivalentes, la especificación y los límites de la comparación fría. No cambia loader, caché ni API pública.

FormData conserva nombres y valores exactos producidos por conversiones observables de jsdom. Rust distingue nombres de texto e identidades host; los objetos permanecen en owners visibles al GC. Los tokens provistos deben estar activos y se rechazan antes de mutar la lista si no lo están. getAll y las vistas evitan el iterador mutable de Float64Array y preservan el snapshot anterior a getters. formdata-host-values/README.md documenta igualdad, orden, capacidad y liberación.

## Validación de la unión

- Formato, Clippy sin warnings y 251 tests Rust: aprobados.
- Node24: 2.180 tests de contratos; Jest 18; Vitest 29; pools VM 30.
- HTML: 1.784 casos comparables, 8 excluidos.
- WPT: 181 fixtures y 48.812 resultados en paridad; 47.615 pasan el estándar y 1.197 fallan también en jsdom. complete permanece false.
- Node22: 361 tests focales aprobados, incluidas las regresiones nuevas y GC de FormData.
- Ambos runtimes: controles de contextos intrínsecos y memoria FormData aprobados. Estrés nativo de 1.000 ciclos: cero supervivientes FormData/Document/Window y contadores devueltos al baseline.
- Paquete: 20 gates por runtime, 40 aprobados, con npm/pnpm, CJS/ESM, tipos, Workers, assets y runners reales.

Los siete gates generales están en pr67-host-intrinsics/validation.json. Los demás logs conservan comandos, resultados y la separación de runtimes. El primer intento de empaquetar invocó directamente el script sin npm_execpath: falló antes de producir el archivo. Se preserva package-invocation-failed.log. Se corrigió únicamente el comando a npm exec y se reanudó desde empaquetado, sin cambiar fuentes ni repetir los gates ya aprobados.

Paquete: rustdom-rustdom-0.1.0-alpha.0-linux-x64-glibc-2026-09-16T00-04-43.031Z.tgz.
SHA-256: 1526c2cd3815765ec5934fa145bd150216d054a1d5d39ee486122fadca1fb012.
Los reportes de instalación son reports/distribution/2026-09-16T00-04-46.020Z-linux-x64.json y reports/distribution/2026-09-16T00-06-55.676Z-linux-x64.json. Ambos verifican el mismo paquete.

## Evidencia y límites

Se copiaron 91 outputs nuevos o modificados, comprobando sus hashes. copy-manifest.json identifica archivos y destinos. El JSON WPT de 44.962.922 bytes se conserva sin pérdidas como gzip de 538.820 bytes; archive-manifest.json registra hashes y comprobación del roundtrip. El original permanece en la caché del runtime.

Los benchmarks individuales conservan sus fuentes y muestras: getAll registra una regresión de 39–61% frente al baseline en 100/1000 entradas; la optimización queda pendiente en ROADMAP.md. No se atribuye automáticamente una mejora de velocidad a la unión.

Los WPT mantienen el bloqueo CDATA de Range-deleteContents y la exclusión de interacción real del submitter. La paridad del corpus y los controles finitos de memoria no prueban compatibilidad universal ni ausencia absoluta de fugas. Los módulos y rutas delegados pendientes mantienen abierto el objetivo de migración integral.
