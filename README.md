# rustdom

Experimento de DOM para Node.js, Jest y Vitest, con **compatibilidad con jsdom como prioridad** y parsing HTML en Rust mediante `html5ever` y Node-API.

## Estado real

Esta primera versión es **híbrida y experimental**. Rust realiza el parsing HTML5 y devuelve un árbol en forma de instrucciones. La implementación de objetos DOM, eventos, CSS, selectores y Web APIs sigue siendo la de **jsdom 27.4.0**, fijada en el lockfile. No es todavía un DOM íntegramente en Rust, ni un reemplazo probado de versiones posteriores de jsdom. Tampoco se presupone una mejora de rendimiento: hay que medir el costo completo del puente y de la creación de objetos JavaScript.

El build genera una copia privada de jsdom bajo `dist/vendor-jsdom`, conserva su licencia y sus archivos auxiliares, y sustituye solamente su dependencia de parsing HTML. El jsdom instalado en `node_modules` permanece independiente y se usa como referencia en los tests.

## Desarrollo

Requisitos para compilación nativa: Node.js compatible con `package.json`, Rust estable y un linker de la plataforma. Los usuarios de paquetes binarios futuros no necesitarían Rust. Este repositorio aún no publica esos paquetes.

```sh
npm ci
npm run build
cargo test
npm test
npm run validate
npm run test:memory
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

### Jest 30

```js
module.exports = {
  testEnvironment: '@rustdom/rustdom/jest',
};
```

Instalar `@jest/environment-jsdom-abstract` junto con Jest. Se reutiliza su integración oficial de VM, timers, errores y limpieza. Para ejecutar los tests del propio repositorio se utiliza el archivo de configuración incluido.

### Vitest 5

```js
export default {
  test: {
    environment: '@rustdom/rustdom/vitest',
    environmentOptions: { jsdom: { url: 'http://localhost:3000' } },
  },
};
```

El adaptador inicial usa workers normales; los pools VM no están habilitados todavía.
La integración no replica aún los adaptadores adicionales de Vitest 5 para convertir `Blob`/`FormData` de jsdom al `Request` nativo de Node ni señales `AbortSignal` de otro realm. La compatibilidad de esas combinaciones queda fuera del alcance probado inicial.

## Límites y rutas de compatibilidad

- Documentos con `runScripts: 'dangerously'`: parser original, para preservar scripts durante el parsing y `document.write`.
- `includeNodeLocations`: parser original, para conservar posiciones exactas.
- Custom elements registrados y fragmentos dentro de formularios: parser original, para conservar reacciones y contexto.
- XML/XHTML: implementación original de jsdom.
- `<select>`: parser original para mantener las reglas de jsdom 27, anteriores a los selects personalizables de HTML5 actual.
- Texto con foster parenting en tablas, atributos de raíces repetidas y surrogates UTF-16 incompletos: rutas explícitas para preservar el resultado de jsdom.
- Las APIs de navegación, layout y otras limitaciones de jsdom conservan sus límites originales.

Jest y Vitest usan `runScripts: 'dangerously'` por defecto. Por eso su documento inicial utiliza la ruta compatible; las mutaciones de HTML elegibles sí pueden utilizar Rust. Para suites que no ejecutan scripts HTML se puede configurar explícitamente `runScripts: 'outside-only'`. Cambiar esa opción altera semántica y no se hace automáticamente para mejorar números.

## Diseño y evolución

1. **Parser Rust**: reutilizar HTML5 y evitar callbacks JS por token; recorrido iterativo y una transferencia por parsing.
2. **Adaptador privado**: conservar los hooks de creación de nodos y no modificar globalmente el cargador de módulos.
3. **Compatibilidad verificable**: comparar contra jsdom independiente y ejercer React/Testing Library reales en ambos runners.
4. **Próxima migración**: medir los costos dominantes antes de trasladar almacenamiento, mutaciones y selectores al árbol Rust. Esos cambios requerirán identidad estable de wrappers, colecciones vivas y conformidad WebIDL/WPT.

## Validación y resultados guardados

- `npm run validate`: formato y Clippy de Rust, tests Rust, build nativo, tests de contrato, React/Testing Library en Jest y Vitest y comparación diferencial del corpus HTML5. Guarda logs y estados en `reports/validation/`.
- `npm run test:memory`: procesos separados para jsdom, rustdom, el parser nativo y teardown de Vitest. Repite creación/cierre, comprueba documentos mediante `WeakRef`, incluye timers, observers, iframes y nombres únicos, y guarda heap, memoria externa y RSS en `reports/memory/`.
- `npm run bench`: operaciones públicas equivalentes, procesos independientes, warmup y muestras crudas. Guarda JSON y un resumen Markdown con fecha en `reports/benchmarks/`. Debe ejecutarse sin otras cargas locales de tests/build para reducir interferencias.

La suite de memoria evalúa crecimiento retenido después de GC; no mide memoria pico ni sustituye ASan/LSan. La revisión verifica que el árbol `RcDom` temporal se libere antes de retornar al caller, que el puente no conserve handles nativos y que el cierre de entornos libere referencias y globals. Las pruebas finitas delimitan los escenarios evaluados; no demuestran ausencia absoluta de toda fuga posible.

Los checkpoints usan tags incrementales `checkpoint-*`, con commits y pushes después de validar el hito. CI configura Linux, Windows y macOS; la validación local inicial se realiza en Linux x64 mediante WSL. La configuración de una plataforma en CI no equivale a haber confirmado que su job pasó.

### Primer resultado local

En la [medición final del 11 de septiembre de 2026](reports/benchmarks/2026-09-11T15-58-01.401Z-linux-x64.md), la construcción de documentos elegibles para Rust fue entre **1,12× y 1,26×** más rápida, y `innerHTML` entre **1,20× y 1,65×**, según el tamaño. Scripts, selectores y mutaciones quedaron cerca de la referencia, sin una mejora relevante. Son cargas sintéticas de una máquina; no se extrapolan al tiempo total de cualquier suite.

La [prueba de memoria](reports/memory/2026-09-11T15-54-22.869Z-linux-x64.json) liberó los **880 documentos observados** de rustdom, incluidos iframes, y los **440 documentos del entorno Vitest**. El proceso nativo mostró aproximadamente 0,63 MiB de crecimiento de RSS entre las muestras posteriores al warmup, dentro del presupuesto registrado. La revisión y sus límites están en [el informe de memoria](reports/memory/REVIEW.md).

Referencias: [html5ever](https://github.com/servo/html5ever), [NAPI-RS](https://napi.rs/), [jsdom](https://github.com/jsdom/jsdom), [entornos de Jest](https://jestjs.io/docs/configuration#testenvironment-string), [entornos de Vitest](https://vitest.dev/guide/environment).
