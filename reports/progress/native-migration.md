# Indicador provisional de migración a Rust

Evaluación actualizada el 15/09/2026 UTC sobre Blob/File en
feature/native-blob-file, que parte del commit publicado
`e5135f89cb3d6e9f25029b7f882ed2427ef69edc` (PR64). Main continúa en
`b9bbf64a67a9acb42ce30524d732fd348819daba`, checkpoint-048.
Los PR43–64 todavía no están integrados en main. Los avances de esta rama se
cuentan como implementación, no como una versión integrada en main.

**2 áreas implementadas, 7 parciales y 3 delegadas: índice 45,8%.**

Es un indicador de planificación por áreas, no un porcentaje auditado de APIs,
líneas o esfuerzo. Las 12 áreas reciben el mismo peso: implementada = 1,
parcial = 0,5 y todavía delegada = 0. Cálculo: `(2 + 7 × 0,5) / 12 × 100`.
El 0,5 de un área parcial es una convención, no una medición interna de esa área.
No estima el tiempo restante ni acredita compatibilidad
completa. Un porcentaje por API requeriría inventariar contratos y ponderarlos.

| Área y criterio | Estado de migración | Evidencia y pendiente | Confianza |
|---|---|---|---|
| Almacenamiento del árbol y datos DOM básicos: enlaces, CharacterData, Attr y colecciones canónicos | Implementada | `src/dom/store.rs:353` y `:421`, `src/dom/tree.rs:1085`; bridge usado por los nodos reales y contratos en `reports/validation/slotable-query.md`. Factories y efectos se cuentan en la fila siguiente. | Alta |
| Algoritmos generales de Node, creación, adopción y efectos de mutación | Parcial | `scripts/build.mjs` conecta decisiones nativas; `ROADMAP.md` conserva factories, hooks y otros drivers JS. | Alta |
| Parsing HTML completo | Parcial | `src/parser/bridge.cjs:113` selecciona parseDocumentTape o fallback; scripts, posiciones y otros contextos siguen delegados. | Alta |
| Parsing XML/XHTML | Parcial | `src/xml/` tokeniza, valida estructura/namespaces, interpreta doctype/entidades y emite eventos incrementales nativos; `src/parser/xml.cjs` conecta documentos y fragmentos reales. Persisten construcción y efectos del host; evidencia en `reports/validation/xml-parser.md` y `reports/validation/xml-doctype.md`. | Alta |
| Algoritmos de serialización HTML/XML y concatenación de fragmentos | Implementada | HTML usa `src/dom/serialization.rs`; XML usa `src/xml/serialize*.rs` y `serializeXmlForest`. Las rutas públicas XMLSerializer, innerHTML/outerHTML XML y JSDOM.serialize ejecutan estos algoritmos. El bridge conserva opciones, wrappers y DOMException; los valores e iteradores V8 se acceden desde Rust. Ver `reports/validation/xml-serialization.md`. | Alta |
| Selectores CSS completos y XPath | Parcial | `src/dom/tree.rs:1343` expone la consulta nativa; README declara selectores que vuelven al motor original. XPath pendiente. | Alta |
| Range y Selection completos | Parcial | Módulos range_* y controles reales publicados; ROADMAP enumera efectos, creación y Selection pendientes. | Alta |
| Shadow DOM, slots y eventos completos | Parcial | Hosts, retargeting, selección, aplanado, caches, backlinks, cola de señales y driver de asignación usan Rust; ver `reports/validation/slot-assignment-driver.md`. Continúan pendientes microtasks, callbacks y algoritmos generales de eventos. | Alta |
| APIs específicas de elementos HTML, formularios y custom elements | Delegada | El runtime privado conserva sus implementaciones de elementos; los datos/atributos nativos compartidos ya se cuentan arriba. | Media |
| CSSOM, estilos y layout | Delegada | `dist/vendor-jsdom/lib/jsdom/living/helpers/style-rules.js:4` y `:7` usan cssom/cssstyle; no se considera nativo por utilizar selectores nativos debajo. | Media |
| Recursos/red, URL, cookies y navegación | Delegada | Runtime jsdom/Node y rutas de compatibilidad descritos en README; quedan algoritmos de plataforma fuera del core DOM. | Media |
| Blob/File/FormData, almacenamiento y demás APIs de plataforma | Parcial | Web Storage usa áreas Rust/IndexMap; Blob/File incorporan metadatos, texto, rangos y concatenación ordinaria nativos. Orígenes, eventos, preparación de vistas y drivers FileReader/FormData/XHR conservan su host. Ver reports/validation/web-storage.md y reports/validation/blob-file.md. | Alta |

Jest y Vitest ya ejercen una versión híbrida funcional: sus adapters están en
`src/environments/`, con pruebas de runners y 18 controles de paquete por cada
runtime Node22/24. Es una dimensión distinta de la migración del motor.

Los 238 tests Rust, 1.697 contratos Node, 1.784 casos HTML5 comparables y el corpus
WPT ejecutable aprobados son evidencia del alcance probado. No se usan como
denominador del porcentaje: quedan exclusiones, fallos de estándar compartidos
y el bootstrap de Range-deleteContents bloqueado. Tampoco los checkpoints ni
los recuentos de archivos sirven como medida del trabajo total.

El índice pasó a 37,5% cuando XML dejó de estar completamente delegado y obtuvo
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
provisional de ese momento ni acredita que los PR pendientes estén integrados en main.

La optimización posterior conserva esos algoritmos en Rust y reduce los cruces
N-API y las asignaciones de operaciones. El estado final pasó 218 tests Rust,
1.118 Node, 36 controles de instalación, memoria y benchmarks. En 1.000 filas los
recorridos bajaron 48–49% sin filtro y 16–17% con filtro respecto del hito anterior;
siguen siendo más lentos que jsdom. Ver reports/validation/traversal-performance.md.
Ese avance de rendimiento no modificó el índice, que entonces permaneció en 37,5%.

La serialización XML posterior completa la segunda área de algoritmos migrados y
lleva el indicador a 41,7%. Los accesos a valores/callbacks V8 y el bridge de realms
siguen siendo necesarios para integrarse con Node; no se los presenta como un
reemplazo de todas las APIs de plataforma. La validación general de este hito pasó
220 tests Rust, 1.301 Node y 45.348 resultados WPT en paridad, con 1.058 fallos de
estándar compartidos. El porcentaje no mide esa compatibilidad ni el rendimiento,
que todavía necesita mejoras.

DOMTokenList agrega parsing, validación, membresía, orden y decisiones de escritura
nativas sobre los atributos existentes. Pasó 224 tests Rust, 1.482 Node, 36 controles
instalados y memoria. En 1.000 tokens, parsing/alta/búsqueda mejoraron frente a jsdom;
reemplazo y listas pequeñas conservan regresiones. Ver reports/validation/dom-token-list.md.
Es otra familia dentro de las áreas compartidas de Node/atributos; no cambia el
indicador provisional de 41,7% ni implica integración de los PR pendientes en main.

DOMStringMap migra enumeración, lectura y conversión/validación de nombres de
dataset a Rust. Conserva el Proxy WebIDL y los hooks de mutación del host. La
validación general pasó 227 tests Rust, 1.567 Node, 10 Jest, 21 Vitest y 26 Vitest VM;
el mismo paquete pasó 36 controles instalados en Node 22/24. WPT conserva 47.002
resultados en paridad, incluidos 1.067 fallos de estándar compartidos. Memoria,
muestras crudas y diferencias de rendimiento están en reports/validation/dom-string-map.md.
El área general de Node/atributos sigue parcial y el indicador permanece en 41,7%.

DOMRect y DOMRectReadOnly incorporan estado y cálculos geométricos nativos,
con wrappers y realms conservados en el host. Los 70 WPT nuevos pasaron y la
validación general mantuvo 47.072 resultados en paridad. Los 12 ciclos de memoria
focal y los 36 controles instalados pasaron; la prueba adicional de setters
heredados se ejecutó después de los 1.595 contratos Node del run general.
Ver reports/validation/dom-rect.md. Este hito no completa CSSOM/layout ni cambia
el estado global de las áreas; el índice se mantiene en 41,7%.

La optimización siguiente elimina snapshots redundantes de atributos canónicos
y migra sus lectores a vistas prestadas. Pasaron 231 tests Rust, 1.605 Node,
12 Jest, 23 Vitest, 26 Vitest VM, corpus, memoria y 36 controles de instalación.
Escritura/borrado de 1.000 atributos mejoraron 5,1/5,6 veces frente al estado
anterior; los lectores conservan regresiones de 9–34% que se documentan en
reports/validation/attribute-cache.md. Este trabajo de rendimiento no completa
otra área de migración ni incrementa el indicador de 41,7%.

Web Storage incorpora almacenamiento ordenado, cuotas y cursores nativos para
localStorage/sessionStorage. Pasaron 235 tests Rust, 1.657 Node, 13 Jest,
24 Vitest, 26 Vitest VM, corpus, memoria y 36 controles de instalación. El bloque
de APIs de plataforma pasa de delegado a parcial y el índice convencional a
45,8%. Esto no significa que la mitad de ese bloque esté migrada: el peso de
0,5 es la convención del indicador. Orígenes, entrega de eventos y otras APIs
permanecen pendientes; ver reports/validation/web-storage.md.

Blob/File agregan algoritmos y metadatos nativos, preservando buffers compartidos
con sus consumidores. También se corrigió una fuga de referencias de constructores
en napi y se verificó el cierre/recarga de workers. Pasaron 238 tests Rust,
1.697 Node, 14 Jest, 25 Vitest, 26 Vitest VM, memoria y 36 controles de instalación.
Las diferencias de licencia del archivo final y las regresiones de slice están
documentadas en reports/validation/blob-file.md. El área sigue parcial y el
indicador permanece en 45,8%.
