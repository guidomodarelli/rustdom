# XMLSerializer: controlador Rust en validación

Base: `checkpoint-066-reference-catalog`, `75db9bb095db8457a6ae567f219e2224a55b9f36`.
Rama: `feature/native-xml-serializer-controller`, PR 79. Todavía no es un
checkpoint integrado: Node 22 local y Node 24 en CI calibraron y pasaron A/B.
Falta publicar la evidencia y verificar CI/review sobre el SHA final. No hay
todavía tag funcional ni merge de este hito.

## Responsabilidad trasladada

`src/dom/xml_serializer_controller.rs` controla la llamada pública, captura el
valor original lanzado, ordena las lecturas de factory/realm/message, construye
los argumentos propios de la excepción y propaga errores secundarios. Invoca
directamente el serializador XML Rust, que ya existía; no se presenta como un
nuevo port del traversal, namespaces o escaping. `scripts/build.mjs` sustituye
el controlador de `XMLSerializer-impl.js` por el binding nuevo y elimina de esa
ruta su `try/catch` anterior.

`src/dom/xml-serializer-controller.cjs` conserva enlaces: ownership del realm
visible a V8, wrapper de Node, lecturas con los errores intrínsecos del lenguaje
y diagnóstico del motor para una factory no callable ya seleccionada por Rust.
La factory real de DOMException y las conversiones WebIDL generadas siguen en
JavaScript. La selección y el catch de serialización de fragmentos de
`domparsing/serialization.js` también permanecen pendientes. El motor global
sigue siendo híbrido.

No se agregan caches ni referencias persistentes de documentos, callbacks o
serializers. Los handles N-API pertenecen al scope sincrónico; los propietarios
temporales del resultado/error se liberan por RAII. La clase JavaScript retiene
su realm mediante una arista ordinaria que el GC puede observar.

## Evidencia funcional local

- Rust 1.98.1 y 1.99.1: fmt, Clippy con warnings como errores y 305 tests aprobados.
- Node 22.12.0 y 24.14.1: 102 diferenciales públicos nuevos contra jsdom 27.4.0,
  contador de ruta nativa y ocho terminaciones reales de workers por runtime.
  Los cinco fixtures XML, incluidos batches repetidos, completan 109 casos focales.
- Los mismos 102 contratos públicos pasan en el runtime anterior inmutable;
  `reference.json` conserva el digest y la prueba de fuentes de producción
  idénticas entre checkpoints 65 y 66. El contador nuevo se excluye solo de ese
  control anterior porque antes no existía.
- La revisión detectó que `napi_set_element` usa asignación y podía disparar un
  setter heredado o perder un valor por un índice no escribible. Doce casos lo
  reprodujeron antes del fix. Ahora se definen propiedades propias, con los
  atributos del literal original, restaurando el prototipo antes del teardown.
- Paquetes reales instalados con npm y pnpm: consumidores CJS/ESM/tipos y
  runners pasan en ambas versiones de Node. El primer intento falló por faltar
  Cargo/npm_execpath en el entorno del empaquetador; se conserva el log y la
  ejecución corregida, sin atribuirlo al addon.

La matriz general pasó en ambas versiones de Node: 3.730 contratos, Jest 22,
Vitest 33, VM 34, 16 contratos del validador y 110 del harness de benchmarks.
Después de actualizar las clasificaciones del inventario se repitieron sus siete
contratos en ambos Node. HTML5 conserva 1.784/1.784 casos comparables, con ocho
script-on excluidos. WPT conserva paridad en 240 fixtures y 83.007 resultados;
hay 1.203 fallos de estándar compartidos, una suite bloqueada y exclusiones
documentadas: `complete=false`. Los controles de distribución son 20 gates por
Node, repartidos entre npm y pnpm, sin publicación npm.

Los logs y las identidades están en `xml-serializer-controller/`. Una prueba
parcial no acredita por sí sola la compatibilidad completa del proyecto.

La matriz de CI `39613157914`, sobre `62cf726`, confirmó además 3.742 contratos
en Windows y macOS con Node 24.21.0, incluyendo los doce casos nuevos de proxies.
Pasaron los runners, los 305 tests Rust y la distribución en ambos hosts.
Los cuatro shards de benchmarks y su agregador pasaron; el arnés tiene ahora
112 contratos. Linux completó validación, memoria, distribución en Node 24/22
y Memcheck. La matriz terminó con sus ocho checks aprobados. El árbol del merge
temporal de GitHub coincide con el head revisado, cuya review terminó sin
hallazgos. La publicación posterior de resultados requiere verificar de nuevo
CI y review sobre su SHA final antes del merge.

Los informes grandes de compatibilidad se publican como `.json.gz`, conservando
los bytes originales sin pérdidas. `reports/compatibility/xml-serializer-controller-archives.json`
registra nombres, tamaños y SHA-256 antes y después de comprimir; se verificó la
descompresión completa. Los samples de benchmarks permanecen como JSON legible.

## Memoria y medición

El control focal guardó 132 observaciones por Node: seis warmups, 108 endpoints
de liberación y 18 observaciones con serializer retenido intencionalmente. Usa
seis escenarios, tres realms, tres ciclos y ambos motores. Observa Window,
Document, nodos, serializers, callbacks y excepciones por separado, además de
los contadores nativos. Retiene resultados primitivos/dinámicos mientras comprueba
que no sostengan propietarios ajenos. La prueba de workers termina el entorno
mientras hay un scope Rust activo y comprueba su liberación.

También pasan los cinco modos generales de memoria en ambos Node. Estas pruebas
finitas no demuestran ausencia universal de fugas ni miden memoria pico. Ver los
resultados crudos en `../memory/` y el protocolo previamente declarado en
`../benchmarks/xml-serializer-controller/README.md`.

Memcheck pasó los nueve tests Rust de XML: cero pérdidas definitivas/indirectas
y cero errores. Conserva 48 bytes posiblemente perdidos y 548 alcanzables;
el control de un test ajeno a XML reproduce ambos residuos. El control sin tests
conserva 548 alcanzables, sin pérdida posible. No se aplicaron supresiones.
La ejecución amplia inicial se interrumpió deliberadamente durante el parser
HTML de profundidad 10.000, ajeno al cambio; sus logs se conservan como
incompletos y no se cuentan como Memcheck completo de 305 tests. Los nueve tests
puros no ejercen por sí solos N-API: esa frontera se prueba con el addon real en
los escenarios de GC y workers descritos arriba.

El control posterior de CI sí completó Memcheck sobre los **305 tests Rust**,
en diez lotes con 305 nombres distintos, exit code cero y ejecución completa.
Se verificó el lockfile y el digest del artefacto descargado. Los 22 archivos
originales y su procedencia están en
`../memory/xml-serializer-controller/ci-39613157914/`. Esto no convierte en
completa la corrida local interrumpida ni cubre V8 o el addon cargado.

Un control independiente de construcción de clases reprodujo retención en
`NativeRange.copy` de la referencia ya integrada: dos rangos nativos después
de ocho interrupciones de workers en Node 24. El candidato de atributos con
guard del SDK terminó equilibrado en Node 22/24, pero todavía contiene otros
cambios y requiere validación aislada. Ver
`../memory/native-class-construction/README.md`. Es un pendiente conocido del
objetivo integral; no fue introducido por el controlador XMLSerializer ni se
oculta detrás del resultado de Memcheck.

La captura `xml-serializer-controller/sources/` conserva manifest, archivo de
fuentes y ejecutores. Incluye fuentes, tests y tipos; los corpus estáticos siguen
versionados en el repositorio base y sus identidades se registran en los informes
de compatibilidad. No incluye node_modules ni un binario portable entre sistemas.

## Rendimiento pendiente

El primer protocolo guardó doce procesos por Node: ocho A/A y cuatro contra
jsdom. Falló su calibración en 2/13 filas de Node 22 y 6/13 de Node 24; no hubo
A/B. La comparación descriptiva conserva también la desventaja de Rust frente
a jsdom en estas operaciones. Ver `../benchmarks/xml-serializer-controller/mixed-row-results.md`.

El piloto siguiente aisló una fila por proceso y guardó 104 procesos A/A en
Node 22. Doce filas calibraron; el error de getter de tamaño uno quedó en −4,891%
con el mismo binario. Según el protocolo previo, no hubo A/B, nueva referencia
ni repetición en Node 24. No se elevó ningún umbral y no se seleccionaron filas
favorables. El gate de +5% del candidato continúa sin verificar.

Las fuentes de ambos métodos se conservan por separado (`sources-mixed-rows/`
y `sources/`). No hay afirmación de mejora causada por esta migración. El
diagnóstico siguiente que se declaró fue GC/tiering/deopt/CPU de la fila
inestable, antes de intentar otra aceptación completa. El gate de clonado sigue
independiente y abierto.

Actualización: los diagnósticos de GC/CPU/JIT completaron cuarenta procesos con
warmup corto y extendido. La calibración revisada usó 208 A/A por Node; Node 22
calibró y completó 208 A/B más 52 descriptivos, aceptando las trece filas con
máximo +2,522%. Node 24 falló en dos filas de tamaño uno (+2,836%/+2,692%) y no
ejecutó A/B. Todos los archivos crudos locales se verificaron contra el índice.

El control siguiente se ejecutó en un runner limpio de CI con igual protocolo
y presupuesto, declarando su entorno y sin reemplazar los resultados locales.
El run `39613158016` completó 208 A/A, 208 A/B y 52 descriptivos: calibración
máxima absoluta 1,378% y máximo A/B +3,263%, dentro de ±2%/+5% en las trece filas.
Se recalcularon sus medianas y se verificaron todos los archivos crudos,
contadores, fuentes, árboles Git y digest del artefacto. La evidencia está en
`../benchmarks/xml-serializer-controller/hosted/39613158016/`. Junto a Node 22
local, completa el control declarado del hito en esos hosts; Rust conserva un
coste 5,03–6,76× el de jsdom en la referencia descriptiva del runner.
El CLI portable y sus protecciones de historial
pasaron siete contratos con fixtures reales por Node; actionlint 1.7.12 aprobó
el workflow. Ningún dato de estos pilotos acredita ausencia universal de fugas,
compatibilidad completa del proyecto ni rendimiento universal entre máquinas.
