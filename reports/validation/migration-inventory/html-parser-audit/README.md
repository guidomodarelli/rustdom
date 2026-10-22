# Validación de la auditoría del parser HTML

El módulo de referencia `browser/parser/html.js` queda auditado como híbrido:
el parseo admitido usa Rust/html5ever, mientras selección, replay, construcción
y efectos conservan lógica JavaScript. Persisten rutas de producción parse5,
algunas posteriores a un intento nativo. No se acreditan individualmente sus
veinte anclas ni sus APIs públicas. El catálogo tiene siete módulos auditados
(cinco híbridos, dos pendientes); las diecisiete anclas y una API auditadas no
cambian, ni los denominadores 531/4.374/7.246.

Pasaron 54 tests por Node 22.12.0 y 24.14.1, sin skips: 41 del parser y trece
del inventario/contratos anteriores. Se usa jsdom independiente y el A0 público
real. Los tests existentes ahora verifican fallbacks observados además del
resultado público; los dos casos nuevos ejercen custom element construction/
connection y UTF-16 mal formado en atributos del contexto. El selector de paquete
permite usar el artefacto oficial sin construir otra distribución; por defecto
el test sigue usando el producto local. No se agregaron mocks.

El intento inicial Node22 pasó 52/54 tests. Dos comprobaciones de inventario
fallaron porque la copia Linux omitió `reports/validation/html5lib.json`, una
evidencia histórica declarada en el audit. Los 41 tests del parser pasaron.
Se corrigió el preparador para copiar todas las rutas declaradas, sin cambiar
producto ni tests, y se ejecutó el conjunto completo en ambos Node. El tar y
recibo `initial-*` conservan ese intento separado, con 216 fuentes y sus logs.
No se ocultan fallos ni se relajan checks para obtener el resultado final.

`evidence.tar.gz` conserva las 217 fuentes finales verificadas, comandos, logs,
catálogos y observaciones de GC; `receipt.json` fija tamaño y SHA-256. Solo cambia
una clasificación: el módulo HTML. Fuentes, anclas y surface Node22 permanecen
idénticos al catálogo anterior. Entre versiones, APIs, constructores, aliases
y declaraciones heredadas coinciden; profile/exclusions son distintos.
`comparison.json` conserva estas distinciones.

La inspección conserva referencia y archivos construidos A0/C, con el diff
completo y sus hashes. La preparación oficial 39720077911/12400802735 se verificó
completa antes/después de ambos Node con el helper congelado; las cuatro
identidades coinciden. No se recompilaron paquetes ni cambió el estudio de
ownership activo en GitHub. Este incremento no cambia código del producto;
no se reejecutaron sus suites amplias Rust/Jest/Vitest o el corpus HTML5 completo.
Los contratos específicos no sustituyen esas validaciones ni certifican estándares.
