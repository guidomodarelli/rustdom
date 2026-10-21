# Continuar rustdom en otra máquina

## Estado actual: controlador Rust de XMLSerializer en validación

La base estable publicada es `main`, `75db9bb095db8457a6ae567f219e2224a55b9f36`,
tag `checkpoint-066-reference-catalog`, PR 78 mergeado. El catálogo inicial está
integrado; su alcance sigue abierto y no hay un porcentaje global defendible.

Continuar en `feature/native-xml-serializer-controller`, worktree administrado
`migration-inventory`. Se trasladó a Rust el control de serializeToString, su
captura de valores lanzados y la construcción/propagación de la excepción.
El serializador XML central ya era Rust. WebIDL, DOMException y el controlador
de fragmentos permanecen pendientes; no presentar el motor como íntegramente Rust.

Leer `reports/validation/xml-serializer-controller.md` y el protocolo de
`reports/benchmarks/xml-serializer-controller/README.md`. La revisión encontró y
corrigió índices heredados de Array.prototype: hay doce regresiones que fallaban
antes del fix y pasan después. La revisión estática final quedó sin hallazgos.

Pasaron 97 contratos focales y 132 observaciones focales de memoria por Node,
305 tests Rust en ambas toolchains y los paquetes npm/pnpm en Node 22.12.0 y
24.14.1. La matriz final pasó 3.730 contratos, Jest 22, Vitest 33, VM 34 y los
corpus declarados por Node. Memcheck XML pasó nueve tests, con residuos iguales
al control de un test ajeno a XML; la corrida amplia se conserva como interrumpida.
Los resultados de rendimiento ya están guardados, pero no aceptados: A/A mixto
falló en 2/13 filas de Node 22 y 6/13 de Node 24. El piloto aislado por fila
completó 104 procesos de Node 22 y falló solo en getter-error/1 (−4,891% con el
mismo binario). No hubo A/B ni repetición de Node 24 en ese piloto.
El avance se publica como WIP; no hay PR, merge ni tag funcional de esta rama.
El ejecutor declara A/A ±2% antes de habilitar A/B +5% por fila: no cambiar el
presupuesto ni aceptar un resultado si el control de ruido falla. Los controles
XML no resuelven el gate independiente pendiente de clonado.

Siguiente acción concreta: diagnosticar GC, tiering/deopt y CPU frente a wall
time de `xml-serializer-getter-error/1`. No repetir pilotos equivalentes ni
cambiar umbrales. Conservar todas las filas; solo habilitar una nueva aceptación
completa cuando calibre el control. Los ejecutores archivados usan copias frescas
de fuentes sin resultados anteriores: no correrlos sobre los directorios
históricos versionados ni sobrescribir sus muestras. Comprobar procesos vivos
antes de reiniciar cualquier ejecución.

Los resultados grandes de compatibilidad se guardan como JSON gzip sin pérdidas;
el manifest `reports/compatibility/xml-serializer-controller-archives.json`
identifica los bytes originales y comprimidos. Descomprimirlos para usar los
lectores antiguos que esperan `.json`; no sustituir ni descartar las muestras.

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
