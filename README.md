# rustdom

Experimento de DOM para Node.js, Jest y Vitest, con **compatibilidad con jsdom como prioridad** y parsing HTML en Rust mediante `html5ever` y Node-API.

## Estado real

El objetivo activo es migrar el 100% de la implementación a Rust con compatibilidad completa verificable. Ese objetivo **sigue abierto**: los checkpoints iniciales y las pruebas aprobadas de la versión híbrida no lo completan. El alcance restante se mantiene en [ROADMAP.md](ROADMAP.md).

Esta versión es **híbrida y experimental**. Rust realiza el parsing HTML5, almacena la estructura y los datos del árbol, ejecuta mutaciones, consultas CSS compatibles y serialización HTML. Reutiliza `html5ever` y el motor `selectors` de Servo. La capa JavaScript conserva referencias de ownership y caches mediante `symbol-tree`, para mantener identidad de objetos y permitir que V8 recolecte el grafo. Los wrappers WebIDL, eventos, estilos y demás Web APIs reutilizan **jsdom 27.4.0**, fijado en el lockfile. No es un DOM íntegramente en Rust ni un reemplazo probado de versiones posteriores de jsdom.

El build genera una copia privada de jsdom bajo `dist/vendor-jsdom`, conserva su licencia y sus archivos auxiliares, e integra los módulos nativos mediante sustituciones verificadas sobre esa versión fijada. El jsdom instalado en `node_modules` permanece independiente y se usa como referencia en los tests.

La migración de `CharacterData` elimina su copia de texto en JavaScript: `Text`, `Comment`, `CDATASection` y `ProcessingInstruction` leen su valor de Rust. La longitud, los substrings, las sustituciones UTF-16 y `wholeText` se ejecutan sobre ese almacenamiento nativo. Los hooks de rangos, observadores y parte del binding WebIDL todavía usan jsdom y deben migrarse para cumplir el objetivo integral.

`Attr` también conserva nombres, namespaces, prefijos y valores canónicos en Rust. Rust mantiene la colección ordenada, los índices de nombres, la relación con el elemento y las decisiones de inserción/reemplazo/eliminación. `NamedNodeMap` consulta esas estructuras. JavaScript mantiene referencias para GC, wrappers, creación de objetos y entrega a los hooks de observadores/custom elements; esas capas restantes no completan todavía el objetivo integral.

Los índices nativos conservan las peculiaridades observables de jsdom 27 al reemplazar prefijos, incluyendo aliases antiguos de lookup separados de la lista actual. Sus referencias se contabilizan y se eliminan al quedar sin uso.

La visibilidad de nombres Unicode usa las tablas incluidas cuando coinciden con el perfil efectivo del host. Si el identificador es desconocido o está ausente, se obtiene una vez el conjunto de escalares que cambia a minúscula mediante las intrínsecas reales de Node/ICU y se transfiere a Rust. El filtro por atributo sigue en Rust y la cache contiene únicamente datos numéricos, sin nodos ni ventanas. Esta ruta agrega un costo inicial de recorrido Unicode; su medición reproducible es `node benchmarks/unicode-host.cjs`. Ver [alcance, límites y validación](reports/validation/unicode-host-fallback.md).

En la API de bajo nivel, `trySetUnicodeVersion(version)` devuelve `false` sin modificar el perfil si faltan tablas incluidas. `setHostUnicodeCaseChanges(buffer)` copia el `ArrayBuffer` completo de un `Uint32Array` con los escalares del host en orden ascendente, sin duplicados. Rechaza buffers compartidos, desconectados, incompletos y escalares inválidos antes de reemplazar el perfil; el llamador debe proporcionar el conjunto completo obtenido del host. La integración habitual configura esto automáticamente.

En la API de bajo nivel `NativeTree`, `setData`, `setHtmlElement`, `setElementFromAttributes` y `setHtmlElementFromAttributes` reemplazan snapshots sin colección canónica. Después de `initializeAttributeCollection`, esos inicializadores rechazan el elemento con `InvalidArg`, incluso si la lista entrante está vacía; no descartan atributos silenciosamente ni modifican el estado. Para elementos con colección, usar `setElementMetadata`/`setHtmlElementMetadata` para metadata y `appendAttribute`/`setAttribute`/`removeAttribute` para sus atributos. Las APIs de metadata conservan la colección y su ownership.

`initializeAttributeCollection` admite la construcción antes de que exista metadata y la transición desde un snapshot de Element sin atributos. Rechaza con `InvalidArg` un snapshot no vacío o metadata de otro tipo de nodo, preservando datos, consultas y contadores. Repetir la inicialización de una colección canónica existente conserva sus atributos y propietarios.

Las mutaciones de atributos y los owners proporcionados al constructor pasan por la misma frontera. Un owner válido establece una colección canónica después de validar todos los handles; los setters de snapshot no pueden reemplazar ese estado después. Las actualizaciones `set*Metadata` rechazan snapshots existentes con atributos y sin índice, mientras conservan metadata inicial y retipados previamente válidos. Para reemplazar un snapshot deliberadamente se mantienen `setData`, `setHtmlElement` y `set*FromAttributes`. Un refresh sin índice canónico conserva el snapshot; los errores de metadata o de Attr canónicos inválidos siguen siendo errores.

El [benchmark de colecciones nativas](reports/benchmarks/2026-09-12T00-20-27.127Z-linux-x64.md) conserva el costo de esta transición: 0,45× en reemplazos/búsquedas de colecciones, 0,67× en valores de atributos y mejoras en consultas repetidas y serialización. El siguiente trabajo debe reducir llamadas al puente y copias, manteniendo el estado y las decisiones en Rust.

El [benchmark de esta migración](reports/benchmarks/2026-09-11T23-25-11.030Z-linux-x64.md) registra el costo de la transición: la carga de lectura/escritura de atributos mide 0,67× frente a jsdom y la construcción grande 0,76×. Consultas repetidas y serialización conservan mejoras en esa medición. Los resultados guían la migración pendiente de índices y operaciones completas; no se ocultan ni se interpreta esta etapa como una aceleración universal.

## Desarrollo

Requisitos para compilación nativa: Node.js compatible con `package.json`, Rust estable y un linker de la plataforma. Los archivos `.tgz` de distribución contienen el binario y se instalan sin Rust; este repositorio no publica automáticamente paquetes en npm.

```sh
npm ci
npm run build
cargo test
npm test
npm run validate
npm run test:wpt
npm run test:memory
npm run test:native-memory # Linux con Valgrind y símbolos de glibc
npm run bench
```

En esta máquina Windows se usa WSL Ubuntu con herramientas locales del proyecto:

```sh
bash scripts/setup-linux.sh
bash scripts/run-linux.sh npm run build
bash scripts/run-linux.sh cargo test
bash scripts/run-linux.sh npm test
```

Desde PowerShell, anteponer `wsl.exe -d Ubuntu-22.04 --` a esos comandos. La instalación local no modifica perfiles de shell ni instala paquetes del sistema. Los binarios generados en WSL son Linux: para Node nativo de Windows hay que compilar con una toolchain Windows.

## Paquetes y tipos

```sh
npm run package
npm run test:package
npm install ./artifacts/rustdom-rustdom-0.1.0-alpha.0-PLATAFORMA-FECHA.tgz
```

`package` reconstruye el runtime, incluye los tipos, las licencias de dependencias nativas y un manifiesto del binario, y crea un archivo específico de plataforma. El nombre real y su SHA-256 quedan en `artifacts/latest.json`. CI genera artefactos para Linux x64/glibc, Windows x64 y macOS arm64. Instalar el archivo correspondiente al sistema donde se ejecutará Node.

Linux se compila y prueba sobre Ubuntu 22.04 para mantener una base de glibc estable. La matriz también comprueba el paquete construido con Node 24 desde Node 22.12.0, mediante Node-API. La versión de glibc del host de compilación queda registrada en el manifiesto.

Los exports admiten CommonJS (`require`) y ESM (`import`), con declaraciones para la API principal, el addon y ambos entornos. Se reutilizan los tipos de jsdom 27. La prueba de distribución instala el `.tgz` en directorios temporales fuera del checkout mediante npm y pnpm, compila y ejecuta consumidores TypeScript, comprueba estilos y XHR síncrono, y ejecuta React/Testing Library en Jest y Vitest, incluidos ambos pools VM. Guarda comandos, salidas y lockfiles en `reports/distribution/`.

Para verificar un artefacto descargado en su plataforma, `npm run test:package -- ruta/al/manifiesto.json` acepta un manifiesto alternativo con su path local `archive` y su SHA-256. El [registro de aceptación](reports/validation/ACCEPTANCE.md) reúne las evidencias y los límites de esta versión.

La copia privada resuelve sus archivos relativos dentro del paquete y sus dependencias externas desde la instalación fijada de jsdom. Esto permite layouts sin hoisting y mantiene independiente al jsdom utilizado como referencia. Los archivos distribuidos se seleccionan explícitamente para excluir temporales y binarios de compilaciones anteriores.

## API

```js
const { JSDOM, getParserStatistics } = require('@rustdom/rustdom');
const dom = new JSDOM('<!doctype html><p>Hello</p>');
dom.window.document.querySelector('p').textContent = 'Rust';
console.log(dom.serialize());
console.log(getParserStatistics());
dom.window.close();
```

Se conservan los exports de jsdom. `getParserStatistics()` devuelve contadores acumulados por proceso para verificar qué operaciones ejecutaron Rust y cuáles usaron una ruta de compatibilidad.

`getNativeTreeStatistics()` informa los nodos nativos vivos, asignaciones, liberaciones, mutaciones y handles reservados. Los handles se reservan en lotes sin crear registros de nodos hasta usarlos, no se reutilizan y no conservan referencias a ventanas. Las inserciones inválidas se rechazan antes de modificar enlaces. `FinalizationRegistry` libera los registros de nodos recolectados y el almacenamiento reduce su capacidad tras picos de uso.

También expone `dataNodes`, `dataUpdates`, `serializations`, `nativeQueries`, `queryFallbacks`, `selectorCacheHits` y `selectorCacheSize`. Los datos preservan UTF-16, incluidos surrogates aislados. La caché LRU conserva hasta 256 selectores compilados, sin referencias a nodos; las consultas siempre usan los datos actuales. `querySelector`, `querySelectorAll`, `matches` y `closest` devuelven los mismos wrappers originales.

La migración del árbol tiene un costo medido todavía pendiente de optimización: el [benchmark de esta fase](reports/benchmarks/2026-09-11T17-57-32.630Z-linux-x64.md) conserva ganancias en varias cargas de parsing, pero muestra regresiones cercanas al 10–15% en construcción grande, documentos con scripts y mutaciones. Los prototipos anteriores, con regresiones mayores, también quedan guardados. Esto se aborda en las fases de consultas nativas y rendimiento; no se presenta como una mejora global ya conseguida.

Con datos y consultas nativas, el [checkpoint siguiente](reports/benchmarks/2026-09-11T19-33-41.341Z-linux-x64.md) mide **1,89× en consultas repetidas** y **2,22–2,70× en serialización consumida como UTF-8**. La copia de metadatos por nodo agrega costo: construcción de 1.000 filas tarda 86,67 ms frente a 61,83 ms de jsdom, y 100 mutaciones 3,50 ms frente a 2,09 ms. Estas regresiones quedan registradas para optimizar el puente en la fase 5. Cada muestra verifica el documento completo mediante SHA-256 fuera del tiempo medido.

La [optimización posterior](reports/benchmarks/2026-09-11T20-00-26.493Z-linux-x64.md) evita JSON para datos HTML comunes y el árbol JSON intermedio del parser. En esa medición, la construcción elegible mide **1,00–1,22×**, `innerHTML` **1,09–1,49×**, consultas **1,90×** y serialización **2,28–2,67×**. Persisten costos en construcción con scripts (**0,83×**) y escrituras aisladas (**0,69×**). La versión ofrece mejoras en operaciones concretas; no una aceleración universal de cualquier suite. Se conserva también el experimento de inserciones combinadas, descartado porque no mostró un beneficio claro.

La [medición del runtime distribuible](reports/benchmarks/2026-09-11T20-44-58.920Z-linux-x64.md) registra **1,81×** en consultas, **2,10–2,59×** en serialización e **1,08–1,48×** en `innerHTML`. Construcción grande, scripts y mutaciones mantienen ratios inferiores a 1. Se conservan ambas mediciones para mostrar la variación y los costos restantes.

### Jest 30

```js
module.exports = {
  testEnvironment: '@rustdom/rustdom/jest',
};
```

Instalar `@jest/environment-jsdom-abstract` junto con Jest. Se reutiliza su integración oficial de VM, timers, errores y limpieza. Para ejecutar los tests del propio repositorio se utiliza el archivo de configuración incluido.

### Vitest 5

```js
import { fileURLToPath } from 'node:url';

export default {
  test: {
    environment: fileURLToPath(import.meta.resolve('@rustdom/rustdom/vitest')),
    environmentOptions: { jsdom: { url: 'http://localhost:3000' } },
  },
};
```

El adaptador soporta workers normales y los pools `vmForks` y `vmThreads`. El mismo creador de ventanas configura ambos modos y libera sus recursos durante el teardown.

Vitest necesita el path resuelto del subpath: un nombre sin resolver hace que intente buscar un paquete con el prefijo `vitest-environment-`. En configuraciones CommonJS se puede usar `require.resolve('@rustdom/rustdom/vitest')`.

Los adaptadores conservan `Blob`, `File` y `FileReader` de jsdom y convierten cuerpos para `Request`, `Response` y `fetch` nativos. El parser multipart reutiliza `@remix-run/multipart-parser` porque la implementación interna de Node consulta el global `File`, que Vitest reemplaza por el de jsdom. Las señales de abort se traducen en ambos sentidos y las URLs de objetos creadas por el entorno se revocan al cerrarlo.

Las pruebas incluyen consumo único del body, errores multipart, señales ya abortadas, clones, restauración de globals y fallos de setup. El [benchmark de entornos](reports/benchmarks/2026-09-11T16-49-53.762Z-linux-x64.md) registra el costo de setup normal y VM; el [estrés ampliado](reports/memory/2026-09-11T16-48-33.143Z-linux-x64.json) conserva señales externas y callbacks para comprobar su limpieza.

## Límites y rutas de compatibilidad

- Documentos con `runScripts: 'dangerously'`: parser original, para preservar scripts durante el parsing y `document.write`.
- `includeNodeLocations`: parser original, para conservar posiciones exactas.
- Custom elements registrados y fragmentos dentro de formularios: parser original, para conservar reacciones y contexto.
- XML/XHTML: implementación original de jsdom.
- Selectores dinámicos o no implementados por la ruta nativa, `nth-child(... of ...)`, shadow roots y árboles con datos UTF-16 no representables en UTF-8: motor de selectores original. Las ambigüedades de mayúsculas/minúsculas en atributos SVG e identificadores en quirks también conservan el comportamiento de jsdom.
- `<select>`: parser original para mantener las reglas de jsdom 27, anteriores a los selects personalizables de HTML5 actual.
- Texto con foster parenting en tablas, atributos de raíces repetidas y surrogates UTF-16 incompletos: rutas explícitas para preservar el resultado de jsdom.
- Las APIs de navegación, layout y otras limitaciones de jsdom conservan sus límites originales.

Jest y Vitest usan `runScripts: 'dangerously'` por defecto. Por eso su documento inicial utiliza la ruta compatible; las mutaciones de HTML elegibles sí pueden utilizar Rust. Para suites que no ejecutan scripts HTML se puede configurar explícitamente `runScripts: 'outside-only'`. Cambiar esa opción altera semántica y no se hace automáticamente para mejorar números.

## Diseño y evolución

1. **Parser Rust**: reutilizar HTML5 y evitar callbacks JS por token; recorrido iterativo y una transferencia por parsing.
2. **Adaptador privado**: conservar los hooks de creación de nodos y no modificar globalmente el cargador de módulos.
3. **Compatibilidad verificable**: comparar contra jsdom independiente y ejercer React/Testing Library reales en ambos runners.
4. **Datos y operaciones Rust**: preservar identidad de wrappers y colecciones vivas mientras los datos, la topología, las consultas compatibles y la serialización HTML se ejecutan en Rust. La hoja de ruta y los criterios de las fases restantes están en [ROADMAP.md](ROADMAP.md).

## Validación y resultados guardados

- `npm run validate`: formato y Clippy de Rust, tests Rust, build nativo, tests de contrato, React/Testing Library en Jest y Vitest y comparación diferencial del corpus HTML5. Guarda logs y estados en `reports/validation/`.
- `npm run test:wpt`: harness WPT real con fixtures fijados por revisión y hash. Compara nombres, estados y mensajes contra jsdom; los fallos compartidos se reportan por separado y no se presentan como conformidad con el estándar. También integra `validate`.
- `npm run test:memory`: procesos separados para jsdom, rustdom, el parser nativo y teardown de Vitest. Repite creación/cierre, comprueba documentos mediante `WeakRef`, incluye timers, observers, iframes y nombres únicos, y guarda heap, memoria externa y RSS en `reports/memory/`.
- `npm run test:native-memory`: ejecuta los tests Rust reales bajo Valgrind/Memcheck en Linux; falla ante accesos inválidos o fugas definitivas/indirectas y conserva también posibles fugas y allocations alcanzables para revisión.
- `npm run bench`: operaciones públicas equivalentes, procesos independientes, warmup y muestras crudas. Guarda JSON y un resumen Markdown con fecha en `reports/benchmarks/`. Debe ejecutarse sin otras cargas locales de tests/build para reducir interferencias.

La suite de memoria evalúa crecimiento retenido después de GC; no mide memoria pico ni sustituye ASan/LSan. La revisión verifica que el árbol `RcDom` temporal se libere antes de retornar al caller, que los índices del puente usen referencias débiles y que el cierre de entornos libere referencias y globals. Valgrind complementa el estrés del addon con análisis del ejecutable de tests Rust; las allocations pendientes del arnés/runtime se detallan en [el informe de memoria](reports/memory/REVIEW.md). Las pruebas finitas delimitan los escenarios evaluados; no demuestran ausencia absoluta de toda fuga posible.

Los checkpoints usan tags incrementales `checkpoint-*`, con commits y pushes después de validar el hito. La validación local se realiza en Linux x64 mediante WSL. El [primer checkpoint pasó CI en Linux, Windows y macOS](https://github.com/guidomodarelli/rustdom/actions/runs/34619548664), incluidas compilación nativa, integraciones, corpus y pruebas de memoria; el job de benchmarks también pasó.

### Primer resultado local

En la [medición final del 11 de septiembre de 2026](reports/benchmarks/2026-09-11T15-58-01.401Z-linux-x64.md), la construcción de documentos elegibles para Rust fue entre **1,12× y 1,26×** más rápida, y `innerHTML` entre **1,20× y 1,65×**, según el tamaño. Scripts, selectores y mutaciones quedaron cerca de la referencia, sin una mejora relevante. Son cargas sintéticas de una máquina; no se extrapolan al tiempo total de cualquier suite.

La [prueba ampliada de memoria](reports/memory/2026-09-11T16-04-31.852Z-linux-x64.json) liberó los **880 documentos y 880 ventanas observados** de rustdom, incluidos iframes, y los **440 documentos y 440 ventanas del entorno Vitest**. El proceso nativo mostró aproximadamente 0,63 MiB de crecimiento de RSS entre las muestras posteriores al warmup, dentro del presupuesto registrado. La revisión y sus límites están en [el informe de memoria](reports/memory/REVIEW.md).

Referencias: [html5ever](https://github.com/servo/html5ever), [NAPI-RS](https://napi.rs/), [jsdom](https://github.com/jsdom/jsdom), [entornos de Jest](https://jestjs.io/docs/configuration#testenvironment-string), [entornos de Vitest](https://vitest.dev/guide/environment).
