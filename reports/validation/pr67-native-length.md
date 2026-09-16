# FormData: longitud intrínseca y orden observable de getters

Validación local de la unión aprobada el 16/09/2026 UTC. El nuevo commit requiere sus propios checks y revisión antes del merge.

Base: 30bad7e5b8f72b112a0e30795f07e8cfd98da5c0. Integra el fix local 990a6a6f11e6162c92f429f423d2baeaf70c9c88 y las regresiones/contraprueba 1ab7ef963dd0f0d8f525b14cf51f74f2aae450ab. La ejecución se hizo en /home/guido/rustdom-pr67-native-length-union-UFgVpj con la misma base Git.

Fuentes SHA-256: 12f79db68137c33fd0b0fde9195a17ef7a49ee7ec538335f7c20360406887bdf.
Addon SHA-256: 5fbc72b4cce23a71853c7dd04f26240220a9acb5a506f0b52e0dab23d63f4394.
pr67-native-length/source-copy.json comprueba la identidad de las fuentes de publicación y ejecución.

## Decisiones

NativeFormDataEntries.idArrayLength obtiene en O(1) la longitud desde la metadata N-API del Float64Array real. El adapter captura ese método y conserva las APIs ids/allIds. No consulta el constructor global ni propiedades/prototipos del argumento; no agrega referencias persistentes. Producción cambia sólo en el adapter y el binding, con su declaración de tipos. formdata-native-length/README.md conserva las comparaciones de carga fría/preload y los fallos compartidos.

No se modificó form_data_construct.rs. El comentario 4021434614 suponía un cortocircuito que no existe en ese punto de jsdom 27.4.0: la referencia usa dos comprobaciones secuenciales. El informe pr67-formdata-checkbox-shortcircuit.md acredita el hash de la fuente oficial y 84 escenarios por runtime. Las mutaciones de type/name/checkedness y los throws coinciden; fusionar esas comprobaciones alteraría la exclusión de un checkbox que pasa a radio desmarcado.

## Validación

- Formato, Clippy y 251 tests Rust: aprobados.
- Node24: 2.286 contratos Node, Jest 18, Vitest 29 y VM 30.
- HTML: 1.784 casos comparables y 8 excluidos.
- WPT: 181 fixtures, 48.812 resultados en paridad, 47.615 estándares aprobados y 1.197 fallos compartidos.
- Node22: 467 tests focales aprobados, incluidas carga, getters y GC.
- GC: buffers/vistas del helper, owners host, caches, Document/Window y contextos intrínsecos; controles de ambas versiones aprobados. Estrés nativo adicional de 1.000 ciclos con supervivientes y operaciones activas en cero.
- Paquete instalado: 20 controles por runtime, 40 aprobados con npm/pnpm, tipos, CJS/ESM, Workers y runners reales.

Los siete gates completos constan en pr67-native-length/validation.json. Los logs específicos y los reportes de memoria conservan versiones, escenarios y mediciones.

Paquete: rustdom-rustdom-0.1.0-alpha.0-linux-x64-glibc-2026-09-16T00-53-00.003Z.tgz.
SHA-256: 0e4487e1f6247bb1906d4f1ecf06365459cf2b5dad83978ade92c764c662166c.
Distribución: reports/distribution/2026-09-16T00-53-03.176Z-linux-x64.json y 2026-09-16T00-55-08.623Z-linux-x64.json. Ambos verifican el mismo archivo.

## Costos y límites

El benchmark del helper conserva cuatro ejecuciones con el harness existente. En 1.000 entradas la mediana bruta sube 6,3%/6,9% frente a 30bad en Node22/24. Las muestras de 100 entradas son mixtas; no se afirma una mejora ni se suman estos porcentajes a mediciones de otros baselines. Los costos, controles jsdom y rangos están en reports/benchmarks/formdata-native-length/.

Se copiaron 93 outputs nuevos o modificados con hashes verificados. El JSON WPT de 44.962.922 bytes se archivó sin pérdidas en gzip de 538.821 bytes; pr67-native-length/archive-manifest.json acredita hashes y roundtrip. El original se conserva en la caché del runtime.

La paridad no equivale a conformidad completa: permanecen el bloqueo CDATA de Range-deleteContents, la exclusión de interacción real del submitter y fallos compartidos del estándar. Las pruebas finitas de memoria no certifican ausencia universal de fugas. La migración integral y la optimización de getAll siguen pendientes.
