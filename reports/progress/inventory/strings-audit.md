# Auditoría de `living/helpers/strings.js`

Clasificación del módulo y sus trece anclas: **pendiente de migración**,
con clasificación auditada. La referencia es jsdom 27.4.0; sus 5.465 bytes
tienen SHA-256 `1b64d849d40429b27755bcf46b2d4879ef0bc6eb8404c3d1d99d512e195f6702`.
Se inspeccionaron las trece funciones completas, sus exportaciones y el build.

| Funciones | Decisiones que permanecen en JavaScript |
| --- | --- |
| `asciiLowercase`, `asciiUppercase` | Selección de ruta ASCII, lectura de code units, cambio de mayúsculas/minúsculas y reconstrucción de strings. |
| `stripNewlines`, `stripLeadingAndTrailingASCIIWhitespace`, `stripAndCollapseASCIIWhitespace` | Eliminación y colapso de caracteres mediante expresiones regulares JavaScript. |
| `isValidSimpleColor`, `isValidFloatingPointNumber` | Validación léxica y elección del resultado mediante expresiones regulares. |
| `asciiCaseInsensitiveMatch` | Longitud, recorrido de code units y comparación con OR de bits. No se presupone equivalencia completa con un algoritmo normativo. |
| `parseInteger`, `parseNonNegativeInteger`, `parseFloatingPointNumber` | Detección de whitespace no ASCII, parseo, signo, cero y rechazo de valores no finitos. |
| `splitOnASCIIWhitespace`, `splitOnCommas` | Cursores, delimitadores, trimming y construcción de tokens en arrays JavaScript. |

`asciiWhitespaceRe` es además un dato exportado; no es un cuerpo ejecutable
adicional. El módulo no tiene imports propios antes de construir el runtime;
sus primitivas ECMAScript no son prueba de que las decisiones de plataforma
estén migradas. Tampoco lo son primitivas parecidas usadas por otro módulo Rust.

## Ruta ejecutada y procedencia

`scripts/build.mjs` copia el módulo a
`dist/vendor-jsdom/lib/jsdom/living/helpers/strings.js`. Su pasada final
`scopePrivateDependencies` añade el adaptador de `require` local. Por eso los
bytes construidos no coinciden con el archivo original, aunque las funciones
no cambian. En A0 y C del artefacto oficial `12400802735` el archivo completo
tiene SHA-256 `c64058a222602a9a0968a38c5edded30fb11b137d9f7f83911d1b8fb04d6bdf2`.
El diff inspeccionado consiste únicamente en esa inyección. No se modificaron
los paquetes fijados ni el ensayo de ownership activo.

El build retira el import de estos helpers en `living/node.js` al reemplazar
sus consultas de colecciones. Eso no retira el módulo de sus otros consumidores
ni completa sus funciones. La auditoría conserva esa diferencia.

## Evidencia, límites y salida

Los contratos públicos de controles HTML, nombres y tokens se ejercen contra
jsdom independiente y el paquete real A0 en Node 22/24. Prueban comportamientos
representativos y teardown, no todas las entradas de las trece funciones ni
conformidad de estándares. La validación del inventario comprueba que las
trece anclas quedan auditadas y pendientes, sin acreditar fuentes Rust.

La salida requiere trasladar las decisiones a Rust y conectar todos sus
consumidores conservando coerciones, Unicode/code units, números, errores y
orden observable. Si una API permite un binding host, hay que delimitarlo;
no conservar algoritmos de plataforma en ese binding y declararlos migrados.

La auditoría aumenta de cuatro a cinco módulos revisados y de una a catorce
anclas revisadas. Las 531 fuentes, 4.374 APIs y 7.246 anclas mantienen sus
denominadores. Sigue habiendo cuatro módulos híbridos y una ancla con control
Rust completo; las trece nuevas anclas auditadas están pendientes. No hay nuevo
crédito de migración y el porcentaje global continúa desconocido.
