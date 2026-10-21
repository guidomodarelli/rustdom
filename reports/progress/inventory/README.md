# Catálogo inicial de jsdom 27.4.0

Este catálogo hace reproducible la enumeración previa a la auditoría de
migración. **No publica todavía un porcentaje de Rust.** El alcance está abierto
y la mayoría de las rutas no tiene una clasificación revisada. No sustituye el
objetivo de migrar toda la implementación ni demuestra compatibilidad completa.

## Qué se cuenta

| Dimensión | Cantidad actual | Qué representa |
| --- | ---: | --- |
| Archivos de referencia | 531 | 528 JavaScript, dos datos de `lib` y `package.json` |
| Entradas de API observadas | 4.331 | Descriptores propios de objetos públicos, incluidos globals, constantes, accesores, métodos y símbolos públicos |
| Cuerpos ejecutables | 7.246 | Funciones, callbacks, métodos, constructores y accesores con cuerpo, con archivo/línea/columna |
| Módulos con clasificación revisada | 4 | Node-impl, Element-impl, XMLSerializer-impl y living/node: híbridos, con rutas Rust y JavaScript, pruebas y pendientes |
| APIs con clasificación revisada | 1 | XMLSerializer.serializeToString mantiene WebIDL y la factory de excepciones en el host |
| Anclas con clasificación revisada | 1 | El control del método serializeToString se ejecuta en Rust; no acredita sus dependencias pendientes |

Las tres primeras dimensiones se solapan y **no se suman**. Las APIs se cuentan
por exposición propia: la herencia y los aliases se registran aparte para no
expandir cada método heredado en todos sus descendientes. Los cuerpos ejecutables
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
  herencia, aliases y exclusiones de miembros privados o globals ECMAScript.
- `implementation-units.json`: anclas de todos los cuerpos ejecutables, incluido
  código generado de conversiones y diccionarios.
- `audits.json`: clasificaciones manuales revisables, ligadas a IDs estables.
- `classification.json`: una fila por archivo/API/ancla, con estado, referencias,
  fuentes nativas/JavaScript, pruebas, evidencia y pendientes.
- `summary.json`: recuentos separados y las razones que impiden cerrar el alcance.

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

Faltan APIs heredadas de dependencias externas que no estén expuestas como otro
constructor enumerado, familias de propiedades indexadas/nominadas y proxies,
diccionarios/opciones, otros perfiles de realms y agrupaciones semánticas de
algoritmos. El inventario tampoco presupone que cada cuerpo corresponda a un
algoritmo de estándar. Estas brechas impiden cerrar `scopeClosed` y calcular
`migrationPercent`; ambos están explícitos en el resumen.

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
