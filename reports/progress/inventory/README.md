# Catálogo de jsdom 27.4.0, esquema 2

Este catálogo hace reproducible la enumeración previa a la auditoría de
migración. **No publica todavía un porcentaje de Rust.** El alcance está abierto
y la mayoría de las rutas no tiene una clasificación revisada. No sustituye el
objetivo de migrar toda la implementación ni demuestra compatibilidad completa.

## Qué se cuenta

| Dimensión | Cantidad actual | Qué representa |
| --- | ---: | --- |
| Archivos de referencia | 531 | 528 JavaScript, dos datos de `lib` y `package.json` |
| Entradas de API observadas | 4.374 | Descriptores propios de objetos públicos y bases heredadas no enumeradas, incluidos globals, constantes, accesores, métodos y símbolos públicos |
| Cuerpos ejecutables | 7.246 | Funciones, callbacks, métodos, constructores y accesores con cuerpo, con archivo/línea/columna |
| Módulos con clasificación revisada | 7 | Cinco híbridos (Node-impl, Element-impl, XMLSerializer-impl, living/node y parser/html); strings.js y validate-names.js pendientes de migración |
| APIs con clasificación revisada | 1 | XMLSerializer.serializeToString mantiene WebIDL y la factory de excepciones en el host |
| Anclas con clasificación revisada | 17 | Una con control Rust (serializeToString), trece de strings.js y tres de validate-names.js pendientes; no acredita dependencias ni APIs completas |

Las tres primeras dimensiones se solapan y **no se suman**. Las APIs se cuentan
por declaración propia de cada objeto o prototipo observado: la herencia y los
aliases se registran aparte para no expandir cada método heredado en todos sus
descendientes. Las bases que todavía no tienen otra declaración reciben un ID
que identifica su receptor, lado constructor/instancia y profundidad. Los cuerpos ejecutables
son anclas de implementación; incluyen helpers y callbacks triviales, y todavía
deben agruparse en algoritmos semánticos. Ningún recuento estima esfuerzo restante.

El conjunto de archivos es todo `lib/` del paquete fijado más `package.json`.
Cada archivo tiene tamaño, SHA-256 y dependencias estáticas resueltas. Las
dependencias dinámicas y las que no se pueden resolver quedan explícitas. La
versión y los rangos de dependencias del proveedor se conservan; el árbol de
instalación reproducible lo fija `package-lock.json` del proyecto.

## Archivos y contrato

- `reference.json`: procedencia, digest del conjunto de fuentes, archivos y grafo.
- `surface.json`: perfil observado, descriptores públicos, bindings construibles,
  herencia, bases no enumeradas, aliases y exclusiones de miembros privados o globals ECMAScript.
- `implementation-units.json`: anclas de todos los cuerpos ejecutables, incluido
  código generado de conversiones y diccionarios.
- `audits.json`: clasificaciones manuales revisables, ligadas a IDs estables.
- `classification.json`: una fila por archivo/API/ancla, con estado, referencias,
  fuentes nativas/JavaScript, pruebas, evidencia y pendientes.
- `summary.json`: recuentos separados y las razones que impiden cerrar el alcance.
- `denominator-v2.json`: cambio explícito de 4.331 a 4.374 APIs, con los 43 IDs
  agregados y comprobación de que las declaraciones anteriores no cambiaron.

`rust-complete`, `hybrid` y `pending` son los estados del ledger.
`auditComplete=true` significa que **la clasificación de esa fila** fue revisada;
no significa que su migración esté completa. `pending` con `auditComplete=false`
es una clasificación conservadora todavía sin auditar, y no prueba que no haya
implementación Rust. Los campos vacíos son pendientes de documentación, no prueba
de ausencia de tests o código. Ninguna fila sin evidencia acredita Rust completo.

Los IDs de anclas incluyen posiciones dentro de la versión fijada. Una
actualización del proveedor puede cambiarlos: deben revisarse los IDs, el digest,
las clasificaciones afectadas y el denominador; no heredar aprobaciones a ciegas.

## Observación real y límites

El generador usa un jsdom independiente instalado, no el runtime privado de
rustdom. Observa un documento vacío con URL HTTPS sintética y scripting default.
Los getters de prototipos DOM no se ejecutan. Se leen instancias conocidas para
capturar miembros unforgeable, como `Location.href`, y getters de namespaces del
paquete para descubrir bindings de cookies. Los valores de datos mutables no se
congelan dentro del catálogo: por ejemplo, `Cookie.cookiesCreated` cambia después
de usar cookies y no debe alterar la identidad del inventario.

`constructors` identifica bindings construibles por JavaScript, incluidas
factories y funciones ordinarias construibles; no es una lista certificada de
interfaces WebIDL. `Reflect.construct` usa Object como target para comprobar
construibilidad sin invocar el constructor observado. Los constructores sin
miembros propios se conservan.

Las bases heredadas se recorren después de enumerar los constructores expuestos;
las ya conocidas y los intrínsecos ECMAScript no se duplican. No se evalúan getters
de esas bases ni se descubre recursivamente la superficie de sus valores.
Faltan otras APIs y algoritmos de dependencias externas, familias de propiedades indexadas/nominadas y proxies,
diccionarios/opciones, otros perfiles de realms y agrupaciones semánticas de
algoritmos. El inventario tampoco presupone que cada cuerpo corresponda a un
algoritmo de estándar. Estas brechas impiden cerrar `scopeClosed` y calcular
`migrationPercent`; ambos están explícitos en el resumen.

## Cambio del denominador en esquema 2

Se incorporan 43 declaraciones antes omitidas: 32 de las bases constructor/instancia
de `VirtualConsole` (`EventEmitter` de Node), diez de la base de `CSSStyleSheet`
y el símbolo público de `WindowProperties`. Los IDs con `[[Inherited...]]`
identifican nodos reales de la cadena de prototipos; no son nombres de propiedades
que el usuario deba invocar literalmente. Se conservan también declaraciones
de la base que pueden estar cubiertas por un override del descendiente.

Las 4.331 entradas existentes conservan exactamente sus registros. Las 531 fuentes,
las 7.246 anclas y sus bytes tampoco cambian. Node 22.12.0 y 24.14.1 producen las
mismas 4.374 declaraciones; el historial completo está en `denominator-v2.json`.
Las nuevas filas quedan pendientes de auditoría. Las referencias de módulo indican
el punto de exposición en jsdom; el código de una base externa requiere su propio
mapeo. Una declaración heredada de Node no acredita Rust ni obliga a reimplementar
un adaptador que el objetivo permite conservar en Node.

La validación final tiene once contratos reales por Node, con listener/once,
inserción/borrado CSS, propiedades nominadas, CLI y memoria. Se conservan las
ejecuciones anteriores, incluido un timeout del CLI en Node 22 sobre NTFS montado
en WSL. La copia Linux conserva las mismas fuentes verificadas y el límite de
30 segundos. Sus once pruebas pasaron en ambos Node; no se amplió el timeout.

## Reproducción y validación

```sh
npm ci
npm run inventory
npm run test:validation
```

El CLI admite `--reference`, `--audits` y `--output` para seleccionar el paquete
independiente fijado, las clasificaciones y la salida. Rechaza versiones
diferentes, IDs desconocidos, evidencia inexistente y aprobaciones Rust que
conserven pendientes. Es tooling de desarrollo; TypeScript ya forma parte de las
dependencias de desarrollo y no se agrega al runtime publicado.

La generación se validó en Node 22.12.0 y 24.14.1. Coinciden las APIs, los
constructores, los aliases y los archivos/anclas de referencia. Los perfiles
conservan diferencias reales de globals ECMAScript excluidos: Node 24 agrega
SuppressedError, DisposableStack, AsyncDisposableStack y Float16Array.

Los IDs se ordenan por unidades UTF-16, independientemente de ICU. La regresión
ejecuta el CLI con locales inglés y turco en POSIX y verifica el orden ordinal
en todos los hosts. En Windows ICU conserva el locale del usuario; no se cambia
la configuración del sistema ni se afirma haber ejercido dos locales allí.

Los contratos, la regresión negativa de locale y las observaciones de liberación
están en `reports/validation/migration-inventory/`. Los benchmarks del CLI están
en `reports/benchmarks/migration-inventory/`: miden esta herramienta, no el motor
DOM ni Rust. La evidencia de GC observa Window y Document por separado en tres
ciclos mientras retiene los reportes JSON; no prueba ausencia universal de fugas.

## Próxima entrega necesaria

La [auditoría del helper de nodos](node-helpers-audit.md) identifica sus siete
exports y las decisiones de clonado/conversión pendientes. Agrega trazabilidad;
no cambia el denominador ni acredita nuevas APIs o anclas Rust completas.

Completar el mapeo de cada contrato público a sus decisiones Rust y JavaScript,
agrupar anclas en algoritmos, inventariar dependencias de plataforma externas y
cerrar las brechas de contratos dinámicos. Auditar cada clasificación con pruebas
de comportamiento y evidencia por SHA antes de habilitar un porcentaje. El
índice histórico de 45,8% por áreas está retirado y no debe recuperarse como
aproximación del avance actual.

## Auditoría de strings sin cambio de denominador

[La auditoría del helper](strings-audit.md) identifica trece funciones todavía
ejecutadas en JavaScript. Se clasifican como pendientes con auditoría completa,
sin acreditar Rust. Hay cinco módulos y catorce anclas revisadas; permanecen
531 fuentes, 4.374 APIs y 7.246 anclas. La validación conserva contratos públicos
reales en ambos Node, perfiles ECMAScript distintos y las mismas declaraciones DOM.

## Ruta física de cada fuente en el runtime

[El mapa de correspondencia](runtime-correspondence/README.md) conecta cada una
de las 531 fuentes con su archivo construido A0/C y sus hashes: 473 JavaScript
conservan el texto salvo el adaptador de require, 55 están reescritos y tres
son datos. Se verificó en ambos Node sobre la preparación oficial autenticada.
Es evidencia estructural, sin auditoría de alcance de ejecución ni nuevo crédito
Rust; no cambia el denominador o migrationPercent. Las APIs y anclas se enlazan
mediante sus referenceModuleIds y el grafo existente de dependencias.
