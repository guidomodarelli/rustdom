# Auditoría de parsing XML y construcción de documentos

Se revisaron cuatro módulos de jsdom 27.4.0 y sus sustituciones construidas A0/C
del artefacto oficial 12400802735. Los hashes, originales, diffs y fuentes
compiladas se conservan en la evidencia. Esta auditoría separa el control del
cuerpo de un método de sus dependencias y de su API WebIDL completa.

| Módulo | Clasificación | Responsabilidad actual |
| --- | --- | --- |
| `browser/parser/index.js` | Pendiente | Ambos cuerpos siguen eligiendo HTML/XML y la llamada mediante `_parsingMode` en JavaScript. Llamar a parsers parcialmente nativos no migra este dispatch. |
| `browser/parser/xml.js` | Híbrido | El estado XML, validación, namespaces, doctype y entidades usan `src/xml/` mediante `NativeXmlParser`. La pila de nodos, callbacks, factories, atributos, templates y efectos de scripts conservan control JavaScript. |
| `living/domparsing/DOMParser-impl.js` | Híbrido | El build sustituye los cuerpos por el controlador `dom_parser.rs`; helpers conservan operaciones host y factories. WebIDL y parsers llamados siguen pendientes. |
| `living/nodes/DOMImplementation-impl.js` | Híbrido | La selección MIME, QName y orden de construcción se controlan en `document_implementation*.rs`. Las factories, creación namespaced, mutación y WebIDL son dependencias todavía híbridas o pendientes. |

## Control Rust y alcance de sus anclas

Se revisan seis anclas con control nativo existente: `DOMParser.parseFromString`
y `createScriptingDisabledDocument`; `DOMImplementation.hasFeature`,
`createDocumentType`, `createDocument` y `createHTMLDocument`. Las fuentes de
esos controladores y sus adapters coinciden con las fuentes A0 y C compiladas.
Rust selecciona caminos, ordena llamadas y propaga/captura valores originales
en el scope N-API. QName y MIME de DOMImplementation se deciden en Rust.

Solo `hasFeature` se acredita `rust-complete`: su cuerpo devuelve true desde
Rust sin helpers que fijen semántica. Las otras cinco anclas quedan **híbridas**.
Los helpers de creación conservan encoding, parsingMode, estado, scripting o
namespace; otros fijan TypeError/InvalidCharacterError, diagnósticos y operaciones
específicas de recuperación. Son decisiones del propio cuerpo original, no solo
algoritmos de dependencias. Orquestarlas desde Rust no completa su implementación.
La propuesta inicial de seis cuerpos completos se corrigió tras la revisión;
se conservan las fuentes y pruebas de esa propuesta sin aceptar su taxonomía.

Factories, parser, mutaciones y WebIDL invocados se clasifican además en sus
propias entradas. Las cinco APIs públicas correspondientes quedan híbridas.
No se acredita individualmente ningún constructor, ni las dieciocho anclas del
adaptador XML. No se redefine un cuerpo como solo el control para ganar crédito.

Las dos anclas del router index quedan auditadas como pendientes, sin fuentes
Rust propias. Los módulos y sus APIs no quedan completos por la existencia de
controladores nativos en otro nivel.

## Lo que sigue en JavaScript

El builder XML conserva `openStack`, selección de ownerDocument y templates,
inserción de texto/CDATA/comentarios/PI/elementos, normalización de prefijos,
adopción de atributos y evaluación de scripts al cerrar tags. El shim
`src/parser/xml.cjs` despacha los eventos nativos, convierte atributos al objeto
esperado y resuelve prefijos mediante callbacks; cierra el estado nativo en
`finally`. El build reemplaza saxes y mueve interpretación de doctype/entidades
a Rust, pero no retira la construcción ni sus efectos del host.

DOMParser retiene en JavaScript el acceso al realm/URL, la factory Document,
la entrada general del parser y operaciones sobre parsererror. DOMImplementation
conserva factories Document/DocumentType/Element, creación namespaced y sus
validaciones, append y copia de origin. Las decisiones de esos algoritmos
compartidos se cuentan en sus propios módulos. No hay nuevos algoritmos de
producción implementados por esta entrega: se audita trabajo existente.

## Compatibilidad, rendimiento y memoria

Las suites existentes ejercen ambos runtimes reales, HTML/XML, MIME, errores,
UTF-16, reentrancia, llamadas dinámicas, excepciones primitivas/objeto/símbolo,
realms y contextos retirados. La generación del catálogo usa un jsdom independiente;
el producto probado es A0 mediante un enlace de dist a la preparación autenticada.
No se construyen ni se modifican paquetes oficiales.

Los costos históricos de DOMImplementation siguen explícitos en
`reports/validation/document-implementation.md`: doctype y QName inválido
mostraron aumentos brutos de 46,5% y 37,2%, con controles jsdom también desplazados.
No se reinterpretan como un contraste calibrado nuevo ni como costos medidos en
esta entrega. La optimización y aceptación de rendimiento de esos caminos sigue
pendiente. El benchmark del inventario mide tooling, no esos controladores.

Las pruebas de recursos observan Window y Document por separado, documentos
creados/recuperados, owners, errores y contadores nativos. Los guards N-API son
temporales; no se declara ausencia universal de fugas por GC finito ni por la
inspección de ownership. Scripts, callbacks y cierres requieren conservar sus
propios límites en los reportes.

El inventario pasa de siete a once módulos auditados (ocho híbridos/tres
pendientes), de diecisiete a veinticinco anclas (dos cuerpos Rust/cinco híbridos/
dieciocho pendientes) y de una a seis APIs auditadas, todas híbridas. No cambian las
531 fuentes, 4.374 APIs o 7.246 anclas. Es auditoría de implementación existente,
sin completar módulos, cerrar el alcance ni calcular un porcentaje global.
