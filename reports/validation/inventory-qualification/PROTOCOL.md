# Calificación funcional remota de propuestas del inventario

El workflow `Validar propuestas del inventario` compila el runtime del HEAD real del
PR en Ubuntu 22.04, Rust 1.99.1 y cada Node 22.12.0/24.14.1 por separado.
No ejecuta benchmarks ni cambia criterios de rendimiento.

Las herramientas, tests y propuestas provienen del snapshot inmutable
a89ce8980c41a400e05860c36c50f09e31159741, alojado en `.inventory`. Esa rama todavía
no incorpora seis archivos internos de N-API del PR80. Por ello no se compila
su runtime antiguo ni se presenta como una integración completa de ramas.

Antes de ejecutar producto se comparan los once archivos de la unión de los
recibos DOMTokenList/DOMStringMap: cada archivo actual del PR y del snapshot
debe coincidir con su hash auditado. Solo después, dist y node_modules del
snapshot apuntan mediante symlinks al build real del PR. Los tests importan
ese SUT real y un jsdom independiente fijado por el lockfile del PR. No hay
mocks, sustituciones de APIs, mezclas de fuentes productivas o compilaciones
del snapshot. El contexto conserva ambos commits, hashes de código, lockfile,
binario nativo, metadata de build y versiones efectivamente utilizadas.

Se ejecutan los tests Rust existentes de token_list y string_map, los contratos
del catálogo y las suites públicas/nativas de DOMTokenList y DOMStringMap. El
CLI real regenera cinco archivos en una carpeta temporal, sin modificar el
ledger. Las declaraciones incluidas, aliases, constructores y demás contratos
se comparan estrictamente con el catálogo versionado. Se verifica y normaliza
la versión observada de Node en el perfil. Las exclusiones ECMAScript pueden
variar entre Node22/24: se comprueban por separado contra js-globals.json de la
referencia y las propiedades propias de un realm real. Las exclusiones privadas
deben coincidir. Se conservan ambas superficies completas y sus listas de
exclusiones; no se eliminan diferencias de APIs incluidas para obtener verde.

Los helpers existentes de listas y dataset ejercitan retención/liberación real
con GC y observaciones separadas de Window y Document. Sus datos conservan
también propietarios, snapshots independientes, contadores y memoria de los
endpoints. Son controles finitos; no certifican ausencia universal de fugas,
memoria pico o todos los caminos de la plataforma.

Se conserva la lista de reportes presentes antes de ejecutar. El artefacto solo
copia reportes JSON nuevos, además de logs y salidas completas, incluso ante
fallos parciales. Así los históricos ya versionados no se cuentan como resultados
del job. La colección final comprueba que el alcance canónico del runtime y los
seis archivos del catálogo/ledger permanecen intactos. Un paso fallido conserva
el job rojo; copiar su evidencia no significa aceptación funcional.

La primera publicación habilita la ejecución remota, pendiente de sus resultados
reales. No se ejecutan suites, builds o GC en la máquina del estudio original,
ni se modifican sus 422 fuentes. Una ejecución verde será evidencia funcional
de las propuestas y el SUT identificado, sin acreditar Rust nuevo, cerrar el
inventario, repinear resultados históricos de rendimiento o habilitar merge/tag.
