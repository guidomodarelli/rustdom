# FormData: métodos intrínsecos de colecciones

Durante la validación de la unión de PR67 con main se reprodujo una diferencia adicional frente a jsdom 27.4.0: reemplazar `Map.prototype.set` hacía fallar `append()` después de crear la entrada Rust. Al restaurar el método, `get()` encontraba una entrada sin proyección JavaScript. El probe inicial está en `../compatibility/2026-09-15T17-36-05.768Z-formdata-map-method-probe.json`.

## Cambio

El adapter captura las operaciones que utiliza de Map, WeakMap y Set durante su inicialización. Las funciones enlazadas reciben la colección en cada llamada; no capturan instancias de FormData ni propietarios de File, Document o Window. Las colecciones siguen siendo propias de cada FormData.

El Set temporal se construye vacío y se completa mediante el `add` capturado. Capturar solamente el constructor no alcanza: `new Set(iterable)` consulta el método `add` mutable de su prototipo. Se conserva el índice temporal para evitar búsquedas cuadráticas en la eliminación de duplicados.

No se alteran globals ni prototipos desde el runtime, ni se cambian las primitivas compartidas con la implementación de referencia. El cambio se limita a la contabilidad privada introducida por este adapter.

## Regresión real

`tests/form-data-collection-methods.spec.cjs` ejecuta dos procesos aislados, uno por modo default/VM. Cada proceso prueba 21 combinaciones: get/set/delete de Map, get/set de WeakMap, has/add de Set; con valor null, función que arroja y getter que arroja. El descriptor se restaura antes del teardown y la serialización de diagnósticos.

Las observaciones usan los FormData, File y serializers reales. Comprueban append/get/getAll/set/delete, duplicados, orden, identidad de File, una vista materializada y la posibilidad de seguir leyendo después de restaurar el método. No se inspeccionan strings del código fuente ni se reemplazan módulos de plataforma.

Antes del fix, los 42 casos pasaron en jsdom y fallaron en rustdom. Se observaron además seis lecturas posteriores inconsistentes, correspondientes a las variantes de Map.set. Los resultados completos están en `../compatibility/2026-09-15T17-42-24.967Z-formdata-collection-methods-default.json`, `../compatibility/2026-09-15T17-42-46.000Z-formdata-collection-methods-vm.json` y `pr67-union/prototype-methods-before.log`.

Con el nuevo build JavaScript, los 42 casos pasaron en Node24.20.0: ningún método/getter sustituido fue consultado, los resultados coinciden con jsdom y las lecturas posteriores conservan el estado correcto. Resultados: `../compatibility/2026-09-15T17-53-54.179Z-formdata-collection-methods-default.json` y `../compatibility/2026-09-15T17-54-13.424Z-formdata-collection-methods-vm.json`.

## Estado de validación

La batería focal del fix de métodos pasó 106/106 tests en Node24.20.0. El helper de memoria pasó 28 escenarios; el estrés de 1000 ciclos creó y liberó 1100 listas, sin FormData, Document o Window observados al final, sin entries/capacidades restantes ni operaciones activas. El JSON de memoria está en `../memory/2026-09-15T17-58-17.790Z-form-data.json` y los logs en `pr67-union/prototype-*.log`. La unión final aprobó además 120/120 focales de Node22, 2108 tests Node24, Jest/Vitest/VM y 40 gates del paquete instalado. El informe `pr67-final.md` identifica el estado completo y sus benchmarks; el checkpoint todavía requiere CI y revisión del SHA publicado.

La ejecución anterior de la unión (`pr67-union/pre-prototype-fix/`) corresponde al runtime previo a esta corrección: 249 tests Rust, 2045 Node, Jest18/Vitest29/VM30, corpus y WPT; el paquete Node24 pasó 20 gates. Node22 falló al importar una dependencia ESM desde el fixture VM del paquete instalado. Ese problema de loader se está corrigiendo por separado y no se considera validado aquí.

El baseline WPT se conserva sin pérdida como `../compatibility/2026-09-15T17-40-39.987Z-linux-wpt.json.gz`, con hashes y alcance en `pr67-union/pre-prototype-fix/wpt-summary.json`: 181 fixtures en paridad, 48812 resultados, 47615 aprobaciones de estándares, exclusión de interacción real del submitter y bloqueo CDATA documentado. No acredita compatibilidad completa.

La identidad del adapter y del addon anteriores quedó registrada en `pr67-union/pre-prototype-fix/scope.json`. Los resultados anteriores no se atribuyen al nuevo adapter. El análisis de ownership no sustituye las pruebas finitas de GC/Memcheck ni prueba ausencia universal de fugas.

## Extensión: constructor Array y fábrica Array.from

El comentario 4018478151 del PR67 señaló la consulta mutable de `Array.from` en `getAll`. El probe de `pr67-union/new-review-intrinsics-before.log` confirma que `Array = null` preserva la operación en jsdom y la rompe en rustdom.

Las nuevas pruebas de `tests/form-data-array-intrinsic.spec.cjs` cubren 12 combinaciones: global Array o su fábrica from; null, función que arroja y getter que arroja; default/VM. Comprueban campos repetidos, resultado vacío, identidad File y materialización de la vista del serializer. Antes del fix, los 12 casos pasan en jsdom y fallan en rustdom, con evidencia en `../compatibility/2026-09-15T18-10-43.775Z-formdata-array-intrinsic-default.json` y `../compatibility/2026-09-15T18-11-09.968Z-formdata-array-intrinsic-vm.json`.

El source captura `Array.from.bind(Array)` y lo usa en `getAll` y `_entries`. Se reconstruyó la unión final en Linux, incluyendo esta ampliación. Los 12 casos de Array pasan en Node22/24 y forman parte de los gates finales identificados en `pr67-final.md`; los resultados anteriores de 106 tests permanecen como evidencia del estado previo a Array.
