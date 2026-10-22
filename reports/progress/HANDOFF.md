# Continuar rustdom en otra máquina

## Estado actual: geometría incorporada al inventario

La rama feature/inventory-node-helpers incorpora 42 clasificaciones de geometría:
5 módulos,20 anclas,17 APIs. Total auditado:16 módulos (10 híbridos/6 pendientes),
45 anclas (19 Rust existentes/8 híbridas/18 pendientes),23 APIs híbridas.
Denominadores531/4374/7246 y12151 IDs intactos; ninguna API o módulo completo.
El alcance sigue abierto y migrationPercent=null. No hay Rust nuevo.

Pasaron12 contratos por versión en Linux22.12.0/24.14.1 y
Windows22.12.0/24.22.1, con DOMRect de jsdom real y release de Window/Document.
Las declaraciones API coinciden; perfiles Node y cuatro globals ECMAScript
excluidos difieren y se preservan. No afirmar igualdad binaria de surface.json
entre versiones. Evidencia en reports/validation/inventory-geometry-ledger/:
204 crudos/fuentes y recibo; memoria en reports/memory/inventory-geometry-ledger/.
Archivo SHA-256:803e3ae1a2af320b6adc1df32dadb9ac94a7649a67b73681a8aaa83cd6321ad9.
Se conservan los fallos del arnés/NTFS y el mismo límite CLI de30s.

Ownership PR80 sigue abierto. Su corrección WPT está publicada en343efdc8:
Windows ya pasó validate del CI39828339458; comprobar resultado terminal ySHA
antes de afirmar todo el job verde. El ensayo pre-GC está terminal/rechazado:
256 workers,18432 tiempos,11 controles jsdom fuera de presupuesto; no repetir.
La captura de optimización y el ensayo anterior también están consumidos.
No merge/tag ni nueva fase de runtime hasta cerrar ownership. Esta rama de
inventario permanece separada, sin crear otro PR draft. La propuesta Storage
f9e3cf98 sigue solo como propuesta auditada, todavía sin incorporar al ledger.

## Histórico: XML y construcción auditados con criterio estricto

El inventario agrega cuatro módulos relacionados: parser/index pendiente,
parser/xml y las implementaciones DOMParser/DOMImplementation híbridas. Queda
con once módulos auditados (ocho híbridos/tres pendientes), veinticinco anclas
(dos Rust/cinco híbridas/dieciocho pendientes) y seis APIs híbridas auditadas.
No cambia el denominador 531/4.374/7.246. Solo hasFeature recibe nuevo crédito
de cuerpo Rust existente; ningún módulo/API queda completo y el alcance sigue
abierto. Orquestar helpers desde Rust no completa opciones o errores aún JS.

Se conservan 434 tests iniciales aprobados por Node22/24 y el hallazgo de
sobrecrédito de cinco anclas, corregidas a híbridas. Tras el fix pasaron los
once tests del inventario y el CLI por Node; los otros 423 tests se reutilizan
con producto/fuentes iguales. No afirmar 434 reejecutados sobre metadata final.
Los reportes `document-parsing-audit` guardan ambas instantáneas de 230 fuentes,
compatibilidad, memoria, catorce procesos CLI y ocho verificaciones idénticas
de preparación. No se implementó ni recompiló producto.

La rama inventory sigue separada hasta cerrar ownership. El CI general
afba8091, run 39735898622, aprobó sus ocho jobs; sus logs están en cache para
publicar con el resultado del ensayo. El run científico 39735778846 continúa
siendo el único vigente sobre f5526bc1: comprobar estado real, sin reintentos,
cambios de método o presupuestos. No crear otro PR ni checkpoint del hito abierto.

## Histórico (superado): parsing HTML auditado como híbrido

Esta rama `feature/inventory-node-helpers` agrega la auditoría completa del
módulo `browser/parser/html.js`: Rust/html5ever produce tapes; selección de ruta,
replay, factories y efectos siguen en JavaScript. Hay fallbacks parse5 incluso
después de algunos intentos Rust. El catálogo queda con siete módulos auditados
(cinco híbridos/dos pendientes), diecisiete anclas y una API auditadas, sin nuevo
Rust completo ni cambio del denominador 531/4.374/7.246. Las veinte anclas del
adaptador requieren clasificación individual; esta entrega no las acredita.

Los 54 tests finales pasan en cada Node22/24, con 41 contratos del parser y trece
anteriores. El primer fixture omitió una evidencia histórica: sus dos fallos de
inventario están conservados junto con el conjunto final, sin cambiar tests ni
producto. Reportes `html-parser-audit` de validación, benchmarks y memoria:
217 fuentes finales, catálogos, logs, catorce procesos del CLI y ciclos de GC
con Window/Document separados. Las cuatro identidades de preparación coinciden.

Mantener esta rama separada hasta cerrar ownership. El run 39735778846 sobre
f5526bc1 sigue siendo el ensayo único vigente: comprobar su estado real y no
reiniciar ni modificar su método o límites. El HANDOFF de la rama ownership
está publicado en afba8091. No crear otro PR o checkpoint del hito pendiente.

## Histórico (superado): auditoría de validación de nombres

Esta rama `feature/inventory-node-helpers` conserva ahora seis módulos y
diecisiete anclas con clasificación revisada. `helpers/validate-names.js` y sus
tres funciones siguen pendientes: usan JavaScript y xml-name-validator, distinto
del lookup de namespaces nativo. No cambia el denominador 531/4.374/7.246 ni
hay crédito Rust o porcentaje global defendible. Solo cuatro filas del ledger
cambiaron; las APIs y anclas de referencia permanecen idénticas.

Pasaron 13 pruebas por Node 22.12.0/24.14.1, con un contrato diferencial público
de 60 casos más coerción/reentrancia/realm. Se autenticaron los paquetes A0/C
oficiales antes/después. Los reportes `name-validation-audit` de validación,
benchmarks y memoria conservan las 212 fuentes, catálogos, logs, catorce procesos
del CLI y los ciclos de GC con Window/Document separados. Los tiempos absolutos
del CLI no son aceptación de rendimiento DOM. No se modificó el producto.

Integrar esta rama después de cerrar ownership. El ensayo anterior 39727878290
ya terminó rechazado; no reiniciarlo ni seguir sus antiguas esperas de abajo.
El método nuevo está publicado en `feature/native-class-ownership`, f5526bc1,
con HANDOFF actualizado en afba8091. Su run 39735778846 se confirmó vivo y debe
observarse sin reintentos ni cambios de método. No abrir otro PR ni crear un
checkpoint de este hito mientras ownership siga pendiente.

## Histórico (superado): correspondencia de las 531 fuentes

Además de la auditoría de strings publicada en `bf4c683a`, esta rama guarda
`reports/progress/inventory/runtime-correspondence.json` y su método/validación.
El mapa enlaza los 531 archivos de referencia con las copias construidas A0/C:
473 JavaScript conservan el texto salvo el adaptador de require, 55 están
reescritos y tres son datos. No es una auditoría de alcance de ejecución y no
se convierte en porcentaje de migración. Los cinco módulos/catorce anclas
clasificados y los denominadores 531/4.374/7.246 no cambian.

Tres contratos por Node 22.12.0/24.14.1 pasaron; ambas salidas son idénticas.
Catorce procesos de benchmark del CLI verificaron todos los bytes y la
preparación oficial se autenticó antes/después en ambos Node. Los tiempos
son del tooling: no se ejecuta el addon ni se crean Window/Document. No se
modificó el motor ni el ensayo `39727878290`, que sigue siendo la prioridad.
Integrar este trabajo después de cerrar ownership, sin inventar crédito Rust.

## Histórico (superado): strings sigue en JavaScript

Continuar esta rama `feature/inventory-node-helpers` desde su auditoría de
`living/helpers/strings.js`, sobre `b6a44f50`. No integrar todavía: el PR #80
sigue siendo el hito prioritario. El ensayo nuevo `39727878290`, sobre
`6f708467`, se observó activo; no reiniciarlo ni modificar su método.

Se auditaron el módulo completo y sus trece anclas: todos quedan pendientes
sin nuevo crédito Rust. Hay cinco módulos revisados (cuatro híbridos, uno
pendiente), catorce anclas revisadas (una Rust, trece pendientes), 531 fuentes,
4.374 APIs y 7.246 anclas totales. No cambia el denominador ni hay porcentaje
global defendible. La inyección local de require explica la diferencia de
hash entre referencia y archivo construido; no traslada sus algoritmos.

Doce contratos por Node 22.12.0/24.14.1 pasaron sin exclusiones. El nuevo contrato
público compara jsdom independiente y el paquete real A0. El CLI completó dos
warmups y cinco procesos medidos por Node, con todos los digests correctos;
los tiempos absolutos no se presentan como mejoras. Tres ciclos GC por Node
liberaron Window/Document conservando reportes. Evidencia, snapshot de 208
fuentes, comandos y trazas: subdirectorios `strings-audit` en los reportes de
validación/benchmarks/memoria. No se modificó el motor ni se cargó Rust durante
la generación del inventario; el contrato DOM sí usa el addon real A0.

## Histórico (superado): inventario, esquema 2

Este bloque y las secciones siguientes conservan estados anteriores. Las
instrucciones vigentes están al principio del documento. El run `39721610003`
terminó y su evidencia está archivada; sus antiguas esperas no están pendientes.
No reiniciarlo.

Continuar esta entrega en `feature/inventory-node-helpers`, worktree
`migration-inventory`. Parte de `014c7dae` y la base de implementación auditada
es `main` / checkpoint 67, `3d37f89976a48203e80cc5c435e099267f4ce346`.
Las secciones anteriores al esquema 2, conservadas abajo, describen estados
históricos y no reemplazan estas instrucciones.

Se agregan 43 declaraciones heredadas: 4.374 APIs, 531 fuentes y 7.246 anclas.
Las 4.331 APIs anteriores conservan sus registros; fuentes/anclas son idénticas.
`reports/progress/inventory/denominator-v2.json` conserva los IDs y el cambio
del denominador. Los contadores de Rust acreditado no cambian; el alcance
global sigue abierto y `migrationPercent=null`.

Once contratos reales por Node 22.12.0/24.14.1 pasaron en copias Linux con
fuentes verificadas; no se amplió el timeout. Se conserva el timeout inicial
de Node 22 sobre NTFS montado. Validación, benchmarks absolutos del CLI y
memoria están en los subdirectorios `inherited-declarations` correspondientes.
La revisión estática terminó con cero hallazgos.

Esta rama no cambia el runtime de producción. El hito prioritario continúa
en el PR 80 / `feature/native-class-ownership`. Su secuencia única hosted,
run `39721610003`, sigue en ejecución según la última consulta. Consultarla
antes de actuar; no quitar/reaplicar su etiqueta ni reiniciar muestras.
Integrar este inventario después de cerrar ese hito, con sus checks/revisión,
sin presentar estas declaraciones nuevas como nuevas APIs Rust terminadas.

## Histórico (superado): XMLSerializer validado, publicación final del PR 79

La base estable es `main`, `75db9bb095db8457a6ae567f219e2224a55b9f36`,
`checkpoint-066-reference-catalog`. Continuar en
`feature/native-xml-serializer-controller`, worktree `migration-inventory`.
El head de implementación validado es
`62cf726cc0ed0d1487db9dfa2100a78568638108`; los cambios posteriores de esta
entrega publican resultados, memoria y documentación. El alcance global del
inventario sigue abierto: no hay un porcentaje de migración defendible.

Codex revisó `62cf726` sin hallazgos. Su matriz general `39613157914` terminó
con ocho checks aprobados: Linux, Windows, macOS, cuatro shards y agregador.
Windows y macOS confirmaron 3.742 contratos en Node 24.21.0, 305 tests Rust y
los runners. El arnés de benchmarks tiene 112 contratos. Linux también aprobó
la distribución npm/pnpm en Node 24 y 22 y Memcheck completo.

El control dedicado `39613158016`, job `119267080556`, terminó correctamente:
Node 24.14.1/Rust 1.99.1, runner Ubuntu 22.04, AMD EPYC 7763, CPU 0. Se
verificaron 468 procesos (208 A/A, 208 A/B, 52 descriptivos), cada stdout,
medianas, orden, contadores y fuentes. Las trece filas calibraron: máximo
absoluto 1,378%; máximo A/B +3,263%, dentro de ±2%/+5%. El ZIP coincide con el
digest de GitHub. Resultados, verificador, procedencia y manifest están en
`reports/benchmarks/xml-serializer-controller/hosted/39613158016/`.

El merge temporal `e0d6021eefce8ba3a6602e9e2fc3147f29a1473f` tiene el mismo
árbol `80c9cf8bedb2ed6e4e4dd53e070ad113a6233e6b` que el head revisado.
La fuente medida candidata tiene hash
`67523bf38c8bfd32286618de24cee952b684f32fd91a322c407f7111cd73be3f`.
Node 22 local ya había calibrado y pasado A/B con máximo +2,522%. Se completa
la aceptación declarada del hito para esos hosts y protocolos; permanecen
publicados los fallos locales de Node 24 y todos los métodos anteriores.
La referencia del runner conserva costes Rust de 5,03–6,76× jsdom: no hay una
aceleración global demostrada ni un resultado universal entre máquinas.

El primer job tenía límite global de 50 minutos y terminó cerca del límite.
Los siguientes tienen 90 minutos de margen de infraestructura; no cambia el
protocolo, sus muestras, número de procesos ni umbrales. Ver
`reports/benchmarks/xml-serializer-controller/hosted-protocol.md`.

Se trasladó a Rust el control de serializeToString, captura de valores
lanzados, argumentos propios de Array y propagación de errores. El algoritmo
XML ya era Rust. WebIDL, DOMException y el controlador de fragmentos conservan
responsabilidades JavaScript. El inventario acredita tres módulos híbridos,
una API híbrida y un ancla con control Rust completo dentro de su alcance;
no acredita migración completa de sus dependencias.

La validación local conserva 109 focales por Node 22.12.0/24.14.1, 102
contratos públicos también sobre el runtime anterior, 305 tests Rust en
1.98.1/1.99.1, paquetes reales, runners y corpus. Hay 132 observaciones focales
de memoria por Node y ocho terminaciones de workers. HTML5 conserva 1.784
casos comparables y ocho exclusiones; WPT conserva paridad en 240 fixtures /
83.007 resultados, 1.203 fallos compartidos, una suite bloqueada y alcance
incompleto. Leer `reports/validation/xml-serializer-controller.md`.

Memcheck local pasó nueve tests XML; su corrida amplia interrumpida sigue
identificada como incompleta. El control posterior de CI sí completó 305
tests distintos en diez lotes: se verificaron y guardaron los 22 archivos
originales y su procedencia en
`reports/memory/xml-serializer-controller/ci-39613157914/`. Este ejecutable
Rust no sustituye las pruebas del addon real en V8.

Prioridad siguiente de memoria: aislar el guard de construcción del SDK que
estaba en el WIP de atributos. El probe de `NativeRange.copy`, ya integrado
en main, dejó dos rangos vivos después de ocho workers en Node 24. Su fuente,
cuatro salidas y límites están en `reports/memory/native-class-construction/`.
No atribuir esa fuga al controlador XML ni presentar el WIP como integrado.
La corrección aislada está en trabajo local, aún sin publicar, en
`feature/native-class-ownership`, worktree `native-class-ownership`, base 66.
Pasaron 311 tests Rust y Clippy en ambas toolchains, seis tests del guard en
Memcheck y 71 focales por Node. La regresión formal falla con el SDK anterior
y pasa aislada; la matriz amplia está en ejecución. No depende de aceptar las
primitivas experimentales de clonado.

Siguiente acción concreta: publicar esta evidencia, pedir revisión y verificar
los checks del head final del PR 79 antes de merge/tag. Consultar el estado
actual del PR y sus runs, sin relanzar handles todavía activos. Tras el merge,
verificar árbol y base, crear el siguiente tag incremental libre y eliminar la
rama integrada. Después completar la corrección de memoria aislada y continuar
las fases abiertas de ROADMAP.md. No cerrar el goal: siguen muchos módulos y
rutas de plataforma JavaScript pendientes.

Los resultados grandes de compatibilidad se conservan como JSON gzip sin
pérdidas, con manifest de bytes originales/comprimidos en
`reports/compatibility/xml-serializer-controller-archives.json`. Las fuentes de
los protocolos previos se conservan por separado. No ejecutar los archivadores
sobre resultados históricos ni sobrescribir sus muestras.

## Registro: catálogo inicial del inventario

La base integrada al comenzar esta entrega era `main`, `271221abbfeafebebb7dd817b98fd559592696d3`,
`checkpoint-065-attribute-reads` (PR 77). Los cuatro fallos históricos de DOMParser
ya están resueltos desde PR 70/checkpoint 58.

La entrega `feature/migration-inventory` agrega el generador real
`npm run inventory`, sus contratos y el catálogo de jsdom 27.4.0 en
`reports/progress/inventory/`. Incluye Location, constructores sin miembros
propios, APIs de Window, exports del paquete y dependencias; no se limita a
métodos escritos dentro de clases. Leer el README del catálogo para los
denominadores, el alcance abierto y la auditoría pendiente. No interpretar los
registros sin auditar como ausencia de implementación Rust ni publicar un
porcentaje antes de completar esa auditoría.

El WIP independiente `feature/native-attribute-copy` sigue publicado en
`c51f9fb578e30762474152765af01bb980ad2c12`, worktree `native-clone-seeds`.
Conserva la primitiva Rust y el fix de ownership. Su A/A pareado de Node 22
guardó 3.840 observaciones pero no calibró: cuatro filas superaron 5% sin cambiar
el motor. No habilita una nueva aceptación A/B ni un checkpoint de ese motor.
Las fuentes y el diagnóstico están publicados en esa rama; leer su HANDOFF
antes de retomar optimizaciones. El driver de clonado previo sigue preservado
en `feature/native-node-clone`, worktree `native-collection-queries`.

Después de este catálogo inicial, completar la clasificación por rutas públicas,
agrupar anclas en algoritmos y ampliar el inventario de dependencias y contratos
dinámicos. Conservar todas las diferencias y fallos conocidos. Priorizar después
entregas que retiren módulos completos, sin convertir un catálogo en certificación
de compatibilidad o de migración terminada.

## Registro histórico: lecturas de atributos

La base estable es main, commit baa87fa3eb1a62ec6477013bb305b2a79a0c3bb6,
tag checkpoint-064-id-lookups. El PR 76 está mergeado: ocho checks aprobados,
revisión limpia de be90ba1, árbol del squash idéntico al head revisado y rama
integrada eliminada. El índice de Document conserva orden de registro y aliases;
SVG incluye el root y admite un atributo ID vacío explícito. Los cuatro fallos
originales de DOMParser están resueltos desde PR 70/checkpoint 58.

El siguiente hito es feature/native-attribute-reads. getAttribute/getAttributeNS
combinan selección y valor en una llamada Rust; hasAttribute/hasAttributeNS
resuelven presencia sin mapear wrappers Attr. Los helpers de valor reflejado
resuelven el vacío en Rust; title y sus wrappers mantienen su propio fallback
en el host. Se conservan aliases históricos, orden físico NS, folding ASCII,
adopción y UTF-16. No se agregó cache ni ownership persistente.
WebIDL, factories y efectos generales permanecen pendientes; el runtime es híbrido.
Verificar PR, CI y SHA revisado antes de asumir integrado este hito.

La validación local pasó 305 tests Rust en 1.98.1/1.99.1 y, por Node
22.12.0/24.14.1, 3638 contratos Node, Jest 21, Vitest 32, VM 32,
273 focales y 105 de harness. Los veinte diferenciales públicos nuevos también
pasaron contra checkpoint 64, junto a diecisiete contratos previos. Pasaron
32 escenarios nuevos de GC por Node, cinco modos generales, Memcheck y cuarenta
controles del mismo paquete instalado. HTML5 pasó 1784/1784 casos comparables;
WPT ejecutó los 240 fixtures por Node, con paridad, 83007 resultados y 1203
fallos de estándar compartidos, complete=false y exclusiones sin reducir.

Los benchmarks finales guardan ambos órdenes, ocho reportes, 32 workers y
36 muestras por fila/motor/etapa/runtime. Incluyen once tareas públicas de
atributos y cuatro de Document/controles; las regresiones y el ruido se publican.
Un piloto previo de conversión inline UTF-16 se descartó por no mostrar una
mejora consistente; sus fuentes y muestras están archivadas por separado.
Queda optimizar attribute-get-miss: +14,95%/+8,96% en Node 22 a 100/1.000 Attrs
y +6,88% en Node 24 a 1.000. Los hits NS siguen en 0,16–0,82× frente a jsdom.
La tabla completa conserva también los costos de copia de valores largos.

- [Validación e identidades](../validation/attribute-reads.md).
- [Benchmarks](../benchmarks/attribute-reads/README.md).
- [Memoria](../memory/attribute-reads/README.md).
- [Piloto descartado](../benchmarks/utf16-input-pilot/README.md).

Conservar la llamada observable getAttributeNS durante alta/baja del Element:
quitarla rompió 86 trazas de FormData en el hito anterior. Las regresiones,
aliases, excepciones y mutaciones durante ese getter siguen verificadas.
El índice global permanece en 45,8% por áreas y no mide compatibilidad completa.
Continuar con los algoritmos generales de Node/Document/Element, factories,
WebIDL y las familias aún delegadas de ROADMAP.md; el objetivo integral está abierto.

Prompt para retomar:

```text
Retomá rustdom desde feature/native-attribute-reads; si fue mergeada, partí de main.
Leé AGENTS.md, reports/progress/HANDOFF.md, ROADMAP.md y
reports/validation/attribute-reads.md. Verificá el estado remoto, los checks y el
SHA revisado de cada PR antes de dar por integrada una rama.

Los cuatro fallos originales de DOMParser están resueltos desde checkpoint 58.
La base checkpoint 64 incorpora IDs Document/SVG. Terminá CI/reviews del hito de
atributos y continuá migrando los algoritmos de Node/Document/Element y las APIs
aún delegadas. Conservá aliases históricos, namespaces, UTF-16, errores,
identidades y efectos parciales. No elimines el hook observable getAttributeNS
del lifecycle. El fallback generado de title sigue en el host; no presentar
este hito como una migración completa de reflexión o del DOM.

El objetivo sigue siendo 100% Rust y compatibilidad verificable con jsdom;
la versión híbrida es intermedia. Instalá lo necesario sin preguntar.
Validá Node 22 y 24, guardá benchmarks y análisis de memoria observando
Document y Window por separado. Publicá cada hito bien probado con commit,
push y checkpoint. Aplicá codex-autofix-loop en cada PR, verificá revisión
del SHA actual y CI antes del merge y eliminá las ramas integradas.
No publiques paquetes npm automáticamente.
```

## Actualización del 20 de octubre de 2026

Los cuatro fallos originales de DOMParser están corregidos e integrados en
`main` por el PR 70. CharacterData conserva `undefined` en Rust, separado de texto vacío y de
`null`. También se corrigieron los errores de Range y el orden de mutaciones
parciales de `normalize()` que la revisión detectó al ampliar las regresiones.

- Clippy y los **262 tests Rust** pasan en Rust **1.98.1 y 1.99.1**.
- Los **279 casos focales**, incluido el control de GC de Window, Document,
  textos, rangos, grupos y errores, pasan en **Node 22.12.0 y 24.14.1**.
- La revisión independiente confirmó **76 casos adicionales por versión**,
  incluidos rangos vivos durante normalización; terminó sin hallazgos accionables.
- La validación general final pasó: **2.757 contratos Node, Jest 20, Vitest 31 y
  VM 30**, en ambas versiones; corpus HTML5 1.784/1.784, paridad WPT en 221
  fixtures, Memcheck sobre los 259 tests Rust y 40 controles del paquete instalado.
- Los [benchmarks antes/después](../benchmarks/dom-parser/README.md) conservan
  ocho procesos y todas sus muestras. Las variaciones frente al baseline son
  pequeñas en estas entradas; el parsing pequeño y normalize siguen teniendo
  costos frente a jsdom que requieren optimización. No se afirma una mejora general.
- Evidencia e identidades de fuentes/binario/paquete en
  [DOMParser y CharacterData](../validation/dom-parser-undefined.md). Comprobar
  el estado remoto del PR antes de continuar: después del merge, usar `main`.
- Para las pruebas de instalación en Node 22 usar **npm 11.19.0**, como en CI.
  npm 10.9.0 falla en su instalador con `Cannot read properties of null
  (reading 'edgesOut')`; no es un fallo del addon.

El PR **70** contiene el hito. Su primera ejecución de CI detectó que Rust
1.99.1 deprecó `AtomicU64::fetch_update`: los tres sistemas fallaron en Clippy.
Se reemplazó por un bucle CAS con atomics estables y se agregaron tres tests de
unicidad concurrente y agotamiento del espacio seguro de IDs JavaScript.
La suite general y los 40 controles del paquete instalado volvieron a pasar
en Node 22/24. Valgrind pasó los ocho tests del módulo y un control separado,
con los mismos residuos del harness. La evidencia de esta continuación está
en [compatibilidad con Rust 1.99](../validation/rust199-atomic.md); no reemplaza
las mediciones históricas de DOMParser hechas con Rust 1.98.1.

El objetivo integral sigue abierto: el runtime conserva factories, WebIDL,
drivers y otras APIs de jsdom. Estos resultados no equivalen a una reescritura
completa en Rust ni a conformidad completa con los estándares. Continuar con
los pendientes de [ROADMAP.md](../../ROADMAP.md) después de cerrar este hito.

Engram no está disponible en este entorno. No se usó otro sistema de memoria
persistente. Este archivo es el entregable de continuación solicitado por el
usuario; verificar siempre el código, los resultados y el estado remoto actual.

## Registro del traspaso anterior

Estado publicado el 16 de octubre de 2026. La evidencia de ejecución indicada abajo
es del 16 de septiembre de 2026; esta publicación conserva trabajo en curso y no
declara un nuevo checkpoint funcional.

## Punto de partida

- Repositorio: <https://github.com/guidomodarelli/rustdom>.
- Rama para continuar: `feature/native-dom-parser`.
- Último estado estable integrado: `main`, commit
  `c3b0f18a31fcb209fb0a3e66f5a7b7e0ea9f20ca`, tag
  `checkpoint-057-document-implementation`, PR 69 mergeado.
- El objetivo sigue abierto: migrar el 100% de la implementación a Rust con
  compatibilidad verificable con jsdom. La implementación actual es híbrida.
  Leer [ROADMAP.md](../../ROADMAP.md),
  [avance por módulos](native-migration.md) y [AGENTS.md](../../AGENTS.md).
  Las fases históricas completas y los índices de avance de esos documentos no
  certifican compatibilidad total ni terminación de la migración.
- No se creó un tag funcional ni se mergeó este trabajo pendiente a `main`.

## Preparar el entorno

```sh
git clone --branch feature/native-dom-parser git@github.com:guidomodarelli/rustdom.git
cd rustdom
npm ci
npm run build
```

Instalar Node, npm y Rust con Cargo, rustfmt y Clippy si faltan. El usuario autoriza
instalar las dependencias necesarias sin pedirle permiso. Se necesita un linker
y la toolchain nativa de la plataforma; Windows usa MSVC. Para reproducir la
evidencia anterior se usaron Linux x64, Node 24.20.0 y Rust 1.98.1. El paquete
admite Node `^22.12.0 || >=24.0.0`; usar las dependencias de `package-lock.json`
y `Cargo.lock`. El repositorio no fija un archivo `rust-toolchain`.

El addon se reconstruye para la máquina de destino. Los directorios `dist/`,
`target/`, `node_modules/`, `.tools/` y `.cache/` son locales y no forman parte
de esta publicación. Para continuar no hace falta recuperar los antiguos
clones de WSL ni sus rutas absolutas.

## Qué contiene el trabajo pendiente

- [Controlador Rust de DOMParser](../../src/dom/dom_parser.rs): selección MIME,
  creación de documentos con scripting deshabilitado y recuperación XML con
  `parsererror`. Los valores lanzados desde JavaScript se conservan mediante
  handles del scope N-API, incluidos valores primitivos.
- [Puente JavaScript](../../src/dom/dom-parser.cjs): conserva los realms,
  factories y entrada del parser existentes. Mantiene las llamadas observables
  a `String`, `TypeError`, getters, receptor y cantidad de argumentos. Esto
  todavía no migra las factories, WebIDL ni todo el parsing a Rust.
- Integración en build, manifiesto de distribución, exports, tipos y estadísticas
  `getNativeTreeStatistics().domParserOperations`.
- [Tests de contratos](../../tests/dom-parser-controller.spec.cjs) y
  [tests de recuperación](../../tests/dom-parser-recovery.spec.cjs), comparados
  con el jsdom independiente de `node_modules`, versión 27.4.0.
- [Procedencia de la integración](../validation/parser-main57/context.json):
  snapshots `base`, `parser`, `upstream` y `merged`. Son evidencia histórica;
  los archivos activos están en `src/`, `scripts/` y `types/`.

## Validación conservada y límite actual

La primera ejecución usó el controlador DOMParser sobre el commit base
`9f9970297dd28a87500b7faaac1bbe495798728e`, anterior al hito 57:

| Comprobación | Resultado conservado |
| --- | --- |
| Clippy con warnings como errores | Aprobado después de quitar un `to_vec` innecesario |
| Test Rust de selección MIME | 1 aprobado |
| Build nativo y JavaScript | Aprobado |
| Contratos DOMParser, Node 24.20.0 | 170 casos: 166 aprobados, 4 fallidos |
| Los mismos contratos en Node 22 | No ejecutados: el script terminó tras el fallo en Node 24 |

Los [logs](../validation/dom-parser/) y los resultados diferenciales de
[contratos](../compatibility/2026-09-16T03-14-57.103Z-dom-parser-controller.json)
y [recuperación](../compatibility/2026-09-16T03-14-57.103Z-dom-parser-recovery.json)
están incluidos. `clippy-before.log` conserva el fallo inicial ya corregido.

Después se integró el trabajo sobre `main` en el hito 57, preservando tanto
DOMImplementation como DOMParser. **Esta combinación publicada aún no fue
compilada ni testeada.** No se ejecutaron benchmarks, análisis de GC, WPT ni
validación de distribución específicos de DOMParser. Los resultados históricos
de otros hitos no validan esta combinación. En esta publicación no se volvieron
a ejecutar las suites: se guarda el estado pendiente para continuarlo.

## Próximo paso concreto: CharacterData con `undefined`

Los cuatro fallos son los casos XML que lanzan un número o un símbolo desde
`createScriptingDisabledDocument`, en los realms default y VM. Su propiedad
`message` es `undefined`. jsdom crea un Text interno cuyo `_data` conserva ese
valor y recién falla al serializar el `parsererror`. Rustdom falla antes al
convertirlo a `Utf16String`.

La [comparación con el baseline](../validation/dom-parser/undefined-character-data-baseline.jsonl)
demuestra que el problema también existe antes del nuevo controlador. La
[superficie de referencia](../validation/dom-parser/undefined-reference-surface.json)
registra 17 operaciones. Ejemplos que debe conservar la solución:

- `Text.data`, `nodeValue`, `textContent` y `wholeText` de un único Text devuelven
  `undefined`; el `textContent` del padre devuelve la cadena `"undefined"`.
- Longitud, substring, sustitución de datos, normalize y selección de contenido
  por Range conservan sus errores de acceso a `length`.
- Clonar preserva el valor; el clon es igual al original y distinto de Text vacío.
- La serialización XML falla con `InvalidStateError` al acceder a `replace`;
  la HTML conserva su error al acceder a `substring`. `:empty` devuelve false.

No se implementó todavía ninguna representación nativa para ese valor. No
sustituirlo por una cadena vacía ni debilitar los tests. Probar además `wholeText`
con varios Text adyacentes antes de decidir su concatenación: aún no está medido.

Revisar `src/dom/data.rs`, `character_data.rs`, `store.rs`, `napi_string.rs`,
`tree.rs`, `node_comparison.rs`, el puente `src/dom/native-tree.cjs`, las
sustituciones de CharacterData en `scripts/build.mjs` y ambas serializaciones.
El valor debe conservarse de manera coherente en almacenamiento, getters,
igualdad, clones, operaciones de texto y errores de serialización.

## Secuencia para cerrar el hito

1. Reconstruir esta rama y reproducir los fallos sin modificar las expectativas:

   ```sh
   cargo clippy --locked --all-targets -- -D warnings
   cargo test --locked dom::dom_parser::tests
   npm run build
   node --test tests/dom-parser-controller.spec.cjs tests/dom-parser-recovery.spec.cjs
   ```

2. Corregir CharacterData con pruebas diferenciales reales y regresiones sobre
   los consumidores afectados. Revisar también las reglas actuales de constantes
   y documentación antes de cerrar el diff de DOMParser.
3. Ampliar las pruebas de `String`, `TypeError`, acceso al realm/URL, orden de
   efectos, aridad, reentrada y errores de recuperación. Ejecutar en Node 22 y 24.
4. Medir ciclos repetidos de éxito y recuperación, errores primitivos y con
   referencias al DOM. Observar Document y Window por separado, GC, heap,
   memoria externa/RSS y retorno de contadores nativos al baseline. Guardar los
   resultados en `reports/memory/` y describir los límites de la medición.
5. Crear y ejecutar benchmarks equivalentes antes/después, con controles jsdom,
   muestras crudas, versiones, hardware y costo del puente. Guardarlos en
   `reports/benchmarks/`, incluidas las regresiones.
6. Ejecutar `npm run validate`, `npm run test:memory`,
   `npm run test:native-memory` en Linux con Valgrind, `npm run package` y
   `npm run test:package`; revisar Jest, Vitest, VM, corpus y WPT. Conservar
   resultados y cualquier exclusión, sin confundir paridad con conformidad total.
7. Cuando esté validado: commit, push y PR hacia `main`; aplicar las skills de
   descripción, review y `codex-autofix-loop`. Atender comentarios, repetir review
   sobre el SHA publicado, esperar checks, mergear, eliminar la rama integrada y
   crear el siguiente tag incremental sin mover tags existentes. Continuar con
   los módulos pendientes del roadmap; no publicar paquetes npm automáticamente.

MCP `memory` no estuvo disponible al preparar esta publicación. Este documento,
las reglas y la evidencia versionada permiten retomar el trabajo sin esa
integración ni el historial local del chat.

## Prompt original guardado antes de corregir los cuatro fallos

Este prompt se conserva como registro del pedido. Para retomar, leer primero la
actualización del 20 de octubre y la evidencia actual, sin repetir trabajo ya validado.

```text
Continuá el desarrollo de rustdom desde la rama feature/native-dom-parser:
https://github.com/guidomodarelli/rustdom

El avance publicado está en el commit b974df3. Actualizá la rama sin sobrescribir cambios locales ni usar force-push.

Antes de modificar código, leé:
- AGENTS.md y las instrucciones aplicables del entorno.
- reports/progress/HANDOFF.md completo.
- ROADMAP.md.

Seguí las instrucciones del HANDOFF para preparar el entorno. Instalá directamente las herramientas y dependencias necesarias, sin pedirme permiso.

Tu primera tarea es reproducir y corregir los cuatro tests pendientes de DOMParser:
- tests/dom-parser-controller.spec.cjs
- tests/dom-parser-recovery.spec.cjs

La ejecución anterior dio 166/170 aprobados sobre una base anterior. La combinación publicada con el último main todavía necesita compilarse y validarse.

Los cuatro fallos conocidos involucran errores numéricos o símbolos durante la recuperación XML, en los realms default y VM. Exponen una diferencia preexistente de CharacterData cuando su dato interno es undefined. Revisá la evidencia en reports/validation/dom-parser/.

Implementá una solución coherente en Rust que preserve el comportamiento del jsdom independiente, incluyendo getters, clones, igualdad, operaciones de texto y serialización. No debilites las expectativas ni sustituyas undefined por una cadena vacía para hacer pasar los tests. Los snapshots dentro de reports son evidencia histórica, no código activo.

Agregá las regresiones necesarias, ejecutá las pruebas relevantes en Node 22 y 24, analizá retención y liberación de memoria, y guardá los resultados y benchmarks según AGENTS.md.

Avanzá autónomamente. Antes de crear un checkpoint funcional, completá la validación y la revisión exigidas. Hacé commit y push de los avances validados y actualizá el HANDOFF con lo resuelto y lo pendiente. Comunicá el progreso en español.
```
