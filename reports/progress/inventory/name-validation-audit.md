# Auditoría de `living/helpers/validate-names.js`

El módulo y sus tres anclas quedan **pendientes de migración**, con clasificación
auditada. Se leyeron los tres cuerpos completos de jsdom 27.4.0. La referencia
ocupa 2.041 bytes, SHA-256
`88ac40c9c076bea44c0e1642df96c765c200c9573dd10a3519ee7c02ad7230ca`.

| Función | Decisiones que siguen en JavaScript |
| --- | --- |
| `name` | Invoca `xml-name-validator.name`, decide el rechazo y construye `InvalidCharacterError` en el realm recibido. |
| `qname` | Invoca `xml-name-validator.qname`, decide el rechazo y construye `InvalidCharacterError`. |
| `validateAndExtract` | Convierte namespace vacío a null, valida QName antes de aplicar restricciones, extrae prefix/localName y decide los errores reservados de xml/xmlns. |

La dependencia externa `xml-name-validator` y la factory WebIDL de DOMException
también conservan trabajo de plataforma. El módulo importa las constantes de
`helpers/namespaces`; esos datos no sustituyen el algoritmo. La resolución de
namespaces de nodos ya presente en `src/dom/namespaces.rs` es otro contrato y no
acredita estas tres anclas.

El build copia este archivo a
`dist/vendor-jsdom/lib/jsdom/living/helpers/validate-names.js` e inyecta el
adaptador de require privado. Los paquetes oficiales A0/C del artefacto
12400802735 contienen el mismo archivo de 2.108 bytes, SHA-256
`3550c358217d3b5db78143645c947b18da5a17d1385875d153ef088edc0a7cb1`.
La diferencia completa se guarda en la evidencia: solo agrega el adaptador.
El catálogo de correspondencia física publicado conserva ambos hashes.

Los contratos públicos ejercen createElement/createAttribute y sus variantes
NS contra jsdom independiente y el A0 real. Incluyen Unicode, surrogates,
colon, namespaces vacíos y reservados, prioridad de errores, coerción y
reentrancia, ausencia de mutación tras error y el realm de la DOMException al
tomar prestado un método. No importan ni mockean el helper interno. Esa prueba
representativa no es cobertura exhaustiva ni conformidad completa del estándar.

Para completar la migración deben trasladarse a Rust las decisiones y la
validación léxica usada por todos los consumidores, preservando orden observable,
coerciones y excepciones del realm. Las dependencias aún JavaScript no quedan
completas por conectar un helper nativo aislado.

La auditoría pasa de cinco a seis módulos revisados y de catorce a diecisiete
anclas revisadas. Las 531 fuentes, 4.374 APIs y 7.246 anclas no cambian. Se
mantienen cuatro módulos híbridos, dos pendientes y una ancla de control Rust
completo. No hay nuevo crédito Rust ni porcentaje global defendible.
