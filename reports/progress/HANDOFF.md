# Continuar rustdom en otra máquina

## Estado actual: corrección aislada de ownership de clases nativas

La base estable es `main`, `3d37f89976a48203e80cc5c435e099267f4ce346`,
`checkpoint-067-xml-serializer-controller`. El PR 79 está mergeado y su rama
integrada está eliminada. Nueve checks y revisión remota limpia cubrieron
`a424bdd7be36af6c894b75c6579dbe3520348b78`; se verificó que el squash conserva
su árbol `9175f0953aba0ad4259bce6d81042dca3783f1bf`. El artefacto del último run
también se conserva en `reports/benchmarks/native-class-ownership/upstream-xml-controller/`.

Continuar en `feature/native-class-ownership`, worktree `native-class-ownership`.
El guard del SDK cubre tanto los class returns de `new_instance<T>` como los
constructores directos de `CallbackInfo::_construct`. La propiedad se transfiere
solo después de un wrap correcto; los errores anteriores destruyen el valor
Rust y los posteriores quedan a cargo del finalizador registrado. No incorpora
las primitivas experimentales del WIP de atributos ni completa APIs DOM.

La referencia inmutable del checkpoint 67 retiene ocho rangos, ocho parsers y
32.824 unidades UTF-16 después de ocho errores de cada constructor en Node
22.12.0 y 24.14.1. La regresión formal falla con ese SDK en ambos Node. El
candidato final `04863365060a1be4fe135880a89bdc1a289a0ae8247a0d3da922a90a9803069f`
registra diferencias cero y mantiene utilizables los receivers originales.
Los probes de ocho workers por Node terminaron balanceados: 1.051/357
asignaciones, respectivamente, sin retención observada.

Pasaron 311 tests Rust, fmt y Clippy en 1.98.1/1.99.1, seis tests del guard bajo
Memcheck y la revisión local del código contra la nueva base sin hallazgos.
Ambos Node completaron 3.743 tests Node, 22 Jest, 33 Vitest, 34 Vitest VM,
16 de validación, 112 del harness, HTML5, WPT, cinco modos generales de memoria
y veinte gates del paquete npm/pnpm. WPT conserva 240 fixtures/83.007 resultados,
1.203 fallos de estándar compartidos, bloqueo/exclusiones y `complete=false`.

La sesión de ejecución `19868`, comando
`.cache/validate-native-class-base67.sh`, runtime Linux
`/home/guido/rustdom-native-class-NMmiki`, terminó con exit 0. El comprobante
terminal y las salidas finales se guardan en
`reports/validation/native-class-ownership/base67/` y ya están archivados en el
worktree. La fuente validada tiene digest `8332276799c5ccc18c7a45a5136a856b039736597d5e104e22f074f8e23f1ddd`.
`manifest.json` enumera 245 reportes, sus compresiones reversibles y las fuentes;
`distribution-lockfiles.sha256` cubre además los locks pnpm. El protocolo ya
declarado en `reports/benchmarks/native-class-ownership/PROTOCOL.md` terminó
con exit 0 en la sesión `3734`: ocho bloques A B B A B A A B por Node, sin
builds/tests simultáneos. El driver conserva `index.json` y cada stdout/stderr/JSON en
`/home/guido/rustdom-native-class-NMmiki/reports/benchmarks/native-class-ownership/local/`.
Los 16 bloques/64 procesos y 4.608 duraciones ya están copiados al worktree en
`reports/benchmarks/native-class-ownership/local/`, con su comprobante terminal.
No repetir ni prolongar esa corrida según sus resultados. La referencia
inmutable está en `/home/guido/rustdom-checkpoint67-reference-0N9EG6`.
Rama de publicación de esta corrección: `feature/native-class-ownership`.
Consultar `git log` y el PR de esa rama para su SHA y estado remoto. Los datos
completos y la revisión local están archivados; merge y tag siguen pendientes
de resolver la precisión/atribución de la fila señalada y de review/CI del
head publicado. No se declara aceptado el presupuesto de rendimiento.

El resumen Node 22 está completo: seis de ocho controles jsdom no calibran.
`range-control-1000/1000` señala +9,4097% Rust con +0,7927% jsdom y requiere
investigación antes del checkpoint; no está aprobado el presupuesto de esa
fila. Node 24 completó ocho bloques: cuatro controles calibran y sus filas
quedan dentro del presupuesto, incluida esa Range con −2,7846% Rust y +1,5285%
jsdom; las otras cuatro filas permanecen inconclusas. Se declaró antes de nuevas
muestras un control negativo acotado en
`reports/benchmarks/native-class-ownership/DIAGNOSTIC-PROTOCOL.md`, sin alterar
los datos ni los umbrales del A/B. No repetir el A/B por ruido ni atribuir al
parche la aparente mejora grande de observers con control no calibrado.

La sesión `81635`, control negativo mediante
`reports/benchmarks/native-class-ownership/run-negative-control.cjs`, revisado
sin hallazgos. Solo seleccionó Node 22 y `range-control-1000`, con ambos tamaños;
ambas etiquetas cargan el mismo binario checkpoint 67. Sus archivos se guardan
en `/home/guido/rustdom-native-class-NMmiki/reports/benchmarks/native-class-ownership/negative-control/`.
terminó con exit 0: ocho bloques/32 procesos y 576 duraciones, archivados en
`reports/benchmarks/native-class-ownership/negative-control/`. Rust varió
−0,3895%/1000 y +0,7013%/250, pero jsdom −5,3452% y −20,5067%: no calibra y no
aprueba el A/B. No quedan benchmarks locales activos. No repetir el control
local hasta aprobar; resolver la precisión/atribución de la fila original antes
de aceptar su presupuesto y crear el checkpoint. Se publican el código probado
y los resultados para revisión, con merge/tag todavía pendientes.

El verificador `reports/validation/native-class-ownership/verify-evidence.cjs`
recalculó 5.184 duraciones de 96 procesos, los hashes de 245 reportes y 86
logs/comprobantes. Con `--staged` también verificó que las 337 fuentes
coinciden byte por byte con el índice Git. La revisión independiente de datos,
límites y herramientas cerró con cero hallazgos; no equivale a aprobar el
presupuesto pendiente ni sustituye la review remota del SHA final.

## Investigación posterior al head inicial del PR 80

El código y los primeros reportes se publicaron en
`8b5431534a6c7b2dbaac6a91bc0ad22a37a740f1`, PR 80 listo para revisión.
La review remota cerró limpia para ese SHA (recibo 6321337456). El run
`39635961966` completó Linux, Windows y los cinco checks de benchmarks;
macOS se canceló sin asignar runner por capacidad arm64 de GitHub. No hubo
pasos macOS ni se acredita esa validación. Los datos de infraestructura están
en `reports/validation/native-class-ownership/ci-39635961966/`.

La investigación local no modificó el SDK ni el arnés original. Se archivaron
los perfiles A B B A de dos versiones del método. La primera carece de marcas
usertiming exportadas y no permite correlación. La segunda exportó 24 marcas
por worker y seis calibraciones: 72 muestras medidas, GC en cero y superposición
garantizada/posible con compilación de fondo en 69. El primer cálculo de cotas
de CPU fue rechazado por review: `tdur` puede superar `dur`. Se preserva como
inválido y se reemplaza por `profiles/v2/analysis-wall.json`, sin inferir CPU
ejecutada a partir de intervalos de pared.

El microdiagnóstico real de `NativeRange.copy` completó 16 bloques A/A y 16 A/B,
72 muestras por etiqueta/fase y 10.000 copias por muestra. Verificó 3.840.000
copias incluyendo warmups, endpoints, independencia y liberación completa de
las copias. A/A +2,0921%; A/B −1,8688%, dentro de los presupuestos de esa
microprueba. No reproduce una penalización del camino modificado del SDK, pero
no sustituye ni aprueba la fila pública original de Range.

`diagnostic-evidence.json` preserva 113 archivos, sus hashes y compresión sin
pérdidas, incluida la invalidación explícita del análisis de CPU anterior.
`verify-diagnostics.cjs` valida los raw, los 32 procesos nativos y vuelve a
calcular el análisis de pared desde gzip. La revisión local cerró el P2 del
análisis tras retirar sus cotas de CPU; los contadores 72/69 y el microdiagnóstico
se recalcularon sin otros hallazgos. Los tres procesos locales terminaron con
exit 0; sus comprobantes están en `diagnostic-terminal-results.json`.

No hay mediciones locales activas ni cambios de producción posteriores al
head inicial. Publicar los diagnósticos, pedir review del nuevo head y seguir
CI de ese SHA; el fallo macOS anterior es terminal y de infraestructura.
El presupuesto público permanece inconcluso. Merge/tag siguen pendientes;
no relanzar las corridas locales para obtener un resultado favorable.

El runner WPT cierra los realms y cede un turno entre fixtures para permitir
liberar targets débiles. La corrida Node 24 que agotó old-space y sus controles
posteriores se preservan; el límite explícito de 2.048 MiB no limita RSS.
Mantener las exclusiones y los fallos de estándar compartidos visibles.

El inventario global continúa abierto y el runtime es híbrido. Este fix de
memoria no cambia los contadores de migración ni habilita un porcentaje global.
Después de integrar el hito, continuar las fases abiertas de ROADMAP.md y
priorizar responsabilidades completas de construcción, clonado y mutación.
Los WIP `feature/native-attribute-copy` y `feature/native-node-clone` permanecen
separados y no deben eliminarse como si estuvieran integrados.

## Registro: XMLSerializer validado, publicación final del PR 79

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
