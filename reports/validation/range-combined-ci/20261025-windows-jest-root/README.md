# Jest real en Windows: corrección de la ruta del checkout

El job Windows/Node24 de b6146131/run40165972204 pasó Rust, build/Clippy,
consumidores,84 dirigidos y compatibilidad, pero Jest no descubrió tests. El glob
normalizado conserva la barra anterior al componente .cache del root Windows.
Se cambia la ruta del checkout a artifacts/combined-range-source, sin cambiar
Jest, sus patrones, el calificador ni fuentes del candidato. artifacts/ ya está
ignorado en el repositorio; se conserva la exclusión del Cargo.toml auxiliar.
No se usa passWithNoTests ni se reemplazan pruebas por un arnés sintético.

Reproducción con Git y procesos reales: dos checkouts base f781c3b7 + patch
combinado, fuente y DLL del artifact 12588507573 autenticado por ID/run/commit/
intento/nombre/tamaño/digest. Las mismas fuentes y configuración en ambas rutas.
Dependencias propias instaladas mediante npm ci desde el lockfile autenticado.
Node 22.12.0 y 24.14.1 verificados por versión y bytes contra sus ZIP oficiales.
Por cada SDK: la ruta anterior falla con No tests found; la ruta nueva ejecuta
22 Jest/33 Vitest/34 VM y pasa todo. El addon y las bibliotecas son reales, sin mocks.

La preparación inicial intentó compartir node_modules del checkout principal,
que no tenía los shims Windows .cmd. Ese intento falló antes de Jest y se preservó.
Se retiraron únicamente nuestras junctions con os.rmdir, sin recursión ni cambios
al destino compartido; se instalaron dependencias propias. No se confunde ese
error inicial con el fallo real de descubrimiento, reproducido después con éxito.
También se conserva el error inicial de empaquetado del nombre del ZIP del SDK.

qa.zip contiene73 miembros, incluidos el artifact íntegro, API/manifiesto por
miembro, fuentes de configuración, comandos, logs de ambas rutas/SDK y ambos
preparadores. qa.json autentica sus bytes. Los scripts archivados son solo
inspección. summary.json registra los SDK, versiones y hashes reales.

La nueva matriz del workflow todavía debe ejecutar el cambio publicado.
No hay cambios de owners ni nueva captura: performanceAccepted=null,
gateReevaluated=false. Los599 pins y48 entradas ajenas se conservan. Las pruebas
no miden memoria pico ni prueban ausencia universal de fugas; la evidencia finita
de recursos del candidato se conserva por separado. Sin integración, tag o merge.
