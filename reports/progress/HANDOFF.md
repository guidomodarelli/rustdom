# Continuar rustdom en otra máquina

## Estado actual: hijos y hermanos Element

La base estable es main, commit `a8886b18a2e2c51134146489e1316c67a4fa3d1c`, tag
`checkpoint-060-collection-members`. El PR 72 está mergeado: ocho checks
aprobados y revisión limpia de `2ae5f2c`; la rama integrada fue eliminada.
Incluye namedItem/nombres soportados en Rust y el fix del factory Float64Array
desde un realm limpio. Los cuatro fallos originales de DOMParser ya están
resueltos desde el PR 70 y checkpoint 58; el registro antiguo de abajo es histórico.

El siguiente hito es `feature/native-element-relatives`: children,
firstElementChild, lastElementChild, nextElementSibling y previousElementSibling
recorren y filtran enlaces en Rust. childElementCount conserva children y su
invalidación; WebIDL, factories y owners siguen usando la integración actual.
El runtime continúa siendo híbrido. Verificar el PR y sus checks antes de asumir
que este hito ya está integrado en main.

La validación local pasó 281 tests Rust en 1.98.1/1.99.1, 3.358 contratos Node
por versión 22.12.0/24.14.1, Jest 21, Vitest 32 y VM 32. Pasaron también 613
focales, 64 contratos del harness y 44 escenarios de GC por Node, HTML5,
paridad WPT, nueve lotes de Memcheck y 40 controles del mismo paquete instalado.
Los ocho reportes de benchmark guardan ambos órdenes y 36 muestras por
fila/motor/etapa/runtime, con todas las regresiones. Consultar resultados y límites:

- [Validación y fuentes](../validation/element-relatives.md).
- [Benchmarks](../benchmarks/element-relatives/README.md).
- [Memoria](../memory/element-relatives/README.md).

El índice global sigue en 45,8% por áreas: no mide compatibilidad completa ni
APIs terminadas. Quedan muchas implementaciones en JavaScript/jsdom. El próximo
bloque identificado es Document.getElementsByName, cuyo filtro/recorrido aún usa
JavaScript y debe conservar una NodeList viva, UTF-16, namespaces y sus owners.

Prompt para retomar:

```text
Retomá rustdom desde feature/native-element-relatives; si fue mergeada, partí
de main. Leé AGENTS.md, reports/progress/HANDOFF.md, ROADMAP.md y
reports/validation/element-relatives.md. Verificá el estado remoto y el SHA
revisado de cada PR antes de dar por integrada una rama.

Los cuatro fallos originales de DOMParser están resueltos. Terminá los checks
o reviews pendientes de este hito y continuá con las APIs aún delegadas,
empezando por Document.getElementsByName si sigue pendiente. Preservá NodeList
viva, identidad, namespaces, UTF-16, orden, mutaciones y liberación de owners.

El objetivo sigue siendo 100% de implementación Rust y compatibilidad
verificable con jsdom; la versión híbrida es intermedia. Instalá lo necesario
sin pedir permiso. Validá Node 22 y 24, guardá benchmarks y análisis de memoria,
y publicá cada hito probado con commit, push y checkpoint. Aplicá
codex-autofix-loop en cada PR; no publiques paquetes npm automáticamente.
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
