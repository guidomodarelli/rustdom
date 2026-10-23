# Calificación remota real de las propuestas de inventario

[Run 39888943268](https://github.com/guidomodarelli/rustdom/actions/runs/39888943268)
terminó con success en Node 22.12.0 y 24.14.1. El runtime construido corresponde
a e17c39372e662f06332de9edf4de86e764ced233; las herramientas/tests corresponden al
snapshot a89ce8980c41a400e05860c36c50f09e31159741. Once fuentes auditadas coinciden.
El snapshot no compila su runtime antiguo: usa el dist real del PR mediante
symlinks y un jsdom independiente instalado desde el lockfile del PR.

Cada versión pasó 279 tests Node, sin fallos, skips, cancelaciones o pendientes:
13 de inventario, 175 públicos y seis nativos de DOMTokenList, 81 públicos y
cuatro nativos de DOMStringMap. Además pasaron cuatro tests Rust de tokens y
tres de dataset por versión; los tests filtrados no se cuentan como ejecutados.
Los dos reportes diferenciales por perfil son subconjuntos de los 279 tests.

El binario observado en ambos perfiles conserva SHA-256
221e6754e8e6ef461007f5d6834cb586ebbf0f0a6d8556651ab93b64e6b9c0f5;
el alcance canónico del runtime es source0b485. Context.json conserva versiones,
hashes, metadata y la identidad completa. No se cargó producto en esta máquina.

Los helpers reales de mapas y listas pasaron seis ciclos por familia y Node:
24 ciclos en total, más dos endpoints después de soltar snapshots de conjuntos
nativos. Window y Document se observaron por separado en los ciclos públicos;
los snapshots nativos tienen otro alcance y no se suman como ventanas observadas.
Todos los endpoints declarados llegaron a dos muestras claras. Los datos de
heap/external/RSS permanecen crudos; no representan memoria pico ni una prueba
de ausencia universal de fugas o de estabilidad en procesos longevos.

Los dos ZIP oficiales están completos y sus digests coinciden con GitHub.
Conservan los cinco catálogos regenerados; no se vuelven a expandir aquí para
duplicar archivos grandes. Cuatro archivos —reference, implementation-units,
classification y summary— coinciden byte a byte entre Node. Surface se conserva
completa en ambos ZIP: Node24 agrega SuppressedError, DisposableStack,
AsyncDisposableStack y Float16Array como exclusiones ECMAScript. El job las
validó contra la referencia y un realm real; las declaraciones DOM y exclusiones
privadas permanecen iguales. No se ignoraron diferencias de APIs incluidas.

node22/ y node24/ conservan los logs, contexto, lista de exclusiones y reportes
nuevos crudos. El workflow registró los nombres previos antes de ejecutar y
selected-reports.json identifica exactamente los cuatro nuevos por perfil:
no se cuentan históricos ya versionados. files.json autentica los inputs crudos
y receipt.json; excluye sus propios bytes y documentos/verificadores posteriores.

El ledger sigue en 105 auditorías: 18 módulos, 32 APIs y 55 anclas, con alcance
abierto y migrationPercent=null. Esta calificación permite revisar la futura
integración de las propuestas; no las incorpora todavía, no agrega Rust ni
acepta rendimiento. No hubo captura V8, benchmark o suite local nueva.
