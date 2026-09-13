# Indicador provisional de migración a Rust

Evaluación actualizada el 13/09/2026 sobre el estado publicado
`09217850a2ad7361b53b374c7e03184e0bc85a0b` (PR55 en borrador), con main
`b9bbf64a67a9acb42ce30524d732fd348819daba` y checkpoint-048.
Los PR43–55 todavía no están integrados en main. PR43 tiene los ocho checks
aprobados, pero su revisión automática sigue pendiente; PR44–55 conservan
estado de borrador. PR51–55 también tienen todos sus checks aprobados. El driver
de doctype/entidades se consolida en feature/native-xml-doctype y no se
cuenta como un hito integrado en main.

**1 área implementada, 7 parciales y 4 delegadas: índice 37,5%.**

Es un indicador de planificación por áreas, no un porcentaje auditado de APIs,
líneas o esfuerzo. Las 12 áreas reciben el mismo peso: implementada = 1,
parcial = 0,5 y todavía delegada = 0. Cálculo: `(1 + 7 × 0,5) / 12 × 100`.
El 0,5 de un área parcial es una convención, no una medición interna de esa área.
No estima el tiempo restante ni acredita compatibilidad
completa. Un porcentaje por API requeriría inventariar contratos y ponderarlos.

| Área y criterio | Estado de migración | Evidencia y pendiente | Confianza |
|---|---|---|---|
| Almacenamiento del árbol y datos DOM básicos: enlaces, CharacterData, Attr y colecciones canónicos | Implementada | `src/dom/store.rs:353` y `:421`, `src/dom/tree.rs:1085`; bridge usado por los nodos reales y contratos en `reports/validation/slotable-query.md`. Factories y efectos se cuentan en la fila siguiente. | Alta |
| Algoritmos generales de Node, creación, adopción y efectos de mutación | Parcial | `scripts/build.mjs` conecta decisiones nativas; `ROADMAP.md` conserva factories, hooks y otros drivers JS. | Alta |
| Parsing HTML completo | Parcial | `src/parser/bridge.cjs:113` selecciona parseDocumentTape o fallback; scripts, posiciones y otros contextos siguen delegados. | Alta |
| Parsing XML/XHTML | Parcial | `src/xml/` tokeniza, valida estructura/namespaces, interpreta doctype/entidades y emite eventos incrementales nativos; `src/parser/xml.cjs` conecta documentos y fragmentos reales. Persisten construcción y efectos del host; evidencia en `reports/validation/xml-parser.md` y `reports/validation/xml-doctype.md`. | Alta |
| Serialización HTML/XML | Parcial | `scripts/build.mjs:583` conecta serializeHTML nativo; XML y rutas restantes conservan drivers originales. | Alta |
| Selectores CSS completos y XPath | Parcial | `src/dom/tree.rs:1343` expone la consulta nativa; README declara selectores que vuelven al motor original. XPath pendiente. | Alta |
| Range y Selection completos | Parcial | Módulos range_* y controles reales publicados; ROADMAP enumera efectos, creación y Selection pendientes. | Alta |
| Shadow DOM, slots y eventos completos | Parcial | Hosts, retargeting, selección, aplanado, caches, backlinks, cola de señales y driver de asignación usan Rust; ver `reports/validation/slot-assignment-driver.md`. Continúan pendientes microtasks, callbacks y algoritmos generales de eventos. | Alta |
| APIs específicas de elementos HTML, formularios y custom elements | Delegada | El runtime privado conserva sus implementaciones de elementos; los datos/atributos nativos compartidos ya se cuentan arriba. | Media |
| CSSOM, estilos y layout | Delegada | `dist/vendor-jsdom/lib/jsdom/living/helpers/style-rules.js:4` y `:7` usan cssom/cssstyle; no se considera nativo por utilizar selectores nativos debajo. | Media |
| Recursos/red, URL, cookies y navegación | Delegada | Runtime jsdom/Node y rutas de compatibilidad descritos en README; quedan algoritmos de plataforma fuera del core DOM. | Media |
| Blob/File/FormData, almacenamiento y demás APIs de plataforma | Delegada | README documenta reutilización de jsdom/Node y adaptadores JS. La integración funcional no equivale a migración a Rust. | Alta |

Jest y Vitest ya ejercen una versión híbrida funcional: sus adapters están en
`src/environments/`, con pruebas de runners y 18 controles de paquete por cada
runtime Node22/24. Es una dimensión distinta de la migración del motor.

Los 214 tests Rust, 910 contratos Node, 1.784 casos HTML5 comparables y el corpus
WPT ejecutable aprobados son evidencia del alcance probado. No se usan como
denominador del porcentaje: quedan exclusiones, fallos de estándar compartidos
y el bootstrap de Range-deleteContents bloqueado. Tampoco los checkpoints ni
los recuentos de archivos sirven como medida del trabajo total.

El índice pasa a 37,5% porque XML deja de estar completamente delegado y tiene
un parser incremental nativo verificado. Sigue siendo un área parcial. El índice
no se incrementa automáticamente por cada commit, PR o checkpoint.
Los avances publicados incluyen payloads de MutationRecord, registro, colas y
entrega de observadores, preparación de mutaciones y wrappers nativos compartidos.
Quedan callbacks, microtasks y drivers generales en JavaScript. Por eso siguen
siendo áreas parciales, aunque tengan más algoritmos implementados en Rust.

El estado escalar de Event y el fix de BeforeUnloadEvent están publicados en
PR51. El dispatcher agrega recorrido de captura/burbujeo, overrides de target y
filtrado de composedPath nativos, con 41 contratos focales aprobados y ocho
tests Rust de eventos/path. La validación general, los 36 controles del paquete
en Node 22/24 y los cinco modos de memoria del estado compacto pasaron.
El registro de listeners agrega identidad, opciones, orden, membresía y selección
por fases en Rust; conserva el historial de XHR/frames sin nombres vacíos retenidos.
Sus 37 contratos focales, cuatro tests Rust, controles de memoria, corpus y
36 controles instalados también pasaron. Construcción del path, ejecución de
callbacks, integración de AbortSignal y datos/algoritmos de subclases todavía
conservan lógica JavaScript. AbortSignal agrega flags, composición, dependencias
y algoritmos nativos con razones y owners en V8; sus contratos, memoria,
benchmarks y controles instalados están en reports/validation/abort-signal.md.
Estos recuentos tampoco cambian
el denominador ni acreditan compatibilidad total.

XML cuenta con 47 contratos DOM, 2.348 inputs mutados y 2.585 fixtures upstream
comparados, además de pruebas de uso nativo y GC. La validación general pasó
212 tests Rust y 691 Node. El corpus upstream compara strings UTF8, eventos y
errores con la referencia; no certifica todos los encodings o estándares.
Doctype y entidades añaden 216 casos públicos y 902 inputs de comparación de
reglas. La validación general pasó 214 tests Rust y 910 Node, más instalación y
memoria. Estos avances profundizan el área parcial; el índice no cambia por hito.

El hito de recorridos en feature/native-tree-traversal migra los nueve movimientos
de NodeIterator/TreeWalker, el control de filtros y la reparación de referencias a
Rust. Sus 202 contratos focales y 1.598 resultados adicionales de WPT mantuvieron
paridad con jsdom; 26 de esos WPT son fallos de estándar compartidos. La validación
general pasó 218 tests Rust y 1.112 Node. GC focal, estrés de memoria y Memcheck
pasaron dentro de sus límites documentados en reports/validation/tree-traversal.md.
La migración general de Node permanece parcial: este avance no cambia el 37,5%
provisional ni acredita que los PR pendientes estén integrados en main.
