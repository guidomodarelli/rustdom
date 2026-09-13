# Indicador provisional de migración a Rust

Evaluación del estado publicado `9ac52d49c14e3c325e398f4d88045a6caa42163c`
(PR37), sobre main `f6087d70aee6e126791d6f056a3af62f098c6b51`.
El aplanado en preparación no se cuenta como implementado.

**1 área implementada, 6 parciales y 5 delegadas: índice 33,3%.**

Es un indicador de planificación por áreas, no un porcentaje auditado de APIs,
líneas o esfuerzo. Las 12 áreas reciben el mismo peso: implementada = 1,
parcial = 0,5 y todavía delegada = 0. Cálculo: `(1 + 6 × 0,5) / 12 × 100`.
El 0,5 de un área parcial es una convención, no una medición interna de esa área.
No implica que falte exactamente dos tercios del tiempo ni acredita compatibilidad
completa. Un porcentaje por API requeriría inventariar contratos y ponderarlos.

| Área y criterio | Estado de migración | Evidencia y pendiente | Confianza |
|---|---|---|---|
| Almacenamiento del árbol y datos DOM básicos: enlaces, CharacterData, Attr y colecciones canónicos | Implementada | `src/dom/store.rs:353` y `:421`, `src/dom/tree.rs:1085`; bridge usado por los nodos reales y contratos en `reports/validation/slotable-query.md`. Factories y efectos se cuentan en la fila siguiente. | Alta |
| Algoritmos generales de Node, creación, adopción y efectos de mutación | Parcial | `scripts/build.mjs` conecta decisiones nativas; `ROADMAP.md` conserva factories, hooks y otros drivers JS. | Alta |
| Parsing HTML completo | Parcial | `src/parser/bridge.cjs:113` selecciona parseDocumentTape o fallback; scripts, posiciones y otros contextos siguen delegados. | Alta |
| Parsing XML/XHTML | Delegada | `README.md`, límites: conserva implementación original; entrada pública `src/index.cjs:5` usa el runtime privado de jsdom. | Media |
| Serialización HTML/XML | Parcial | `scripts/build.mjs:583` conecta serializeHTML nativo; XML y rutas restantes conservan drivers originales. | Alta |
| Selectores CSS completos y XPath | Parcial | `src/dom/tree.rs:1343` expone la consulta nativa; README declara selectores que vuelven al motor original. XPath pendiente. | Alta |
| Range y Selection completos | Parcial | Módulos range_* y controles reales publicados; ROADMAP enumera efectos, creación y Selection pendientes. | Alta |
| Shadow DOM, slots y eventos completos | Parcial | `src/dom/slots.rs:63` selecciona asignados; hosts/retargeting son nativos. Aplanado, caches y entrega de eventos/señales siguen pendientes. | Alta |
| APIs específicas de elementos HTML, formularios y custom elements | Delegada | El runtime privado conserva sus implementaciones de elementos; los datos/atributos nativos compartidos ya se cuentan arriba. | Media |
| CSSOM, estilos y layout | Delegada | `dist/vendor-jsdom/lib/jsdom/living/helpers/style-rules.js:4` y `:7` usan cssom/cssstyle; no se considera nativo por utilizar selectores nativos debajo. | Media |
| Recursos/red, URL, cookies y navegación | Delegada | Runtime jsdom/Node y rutas de compatibilidad descritos en README; quedan algoritmos de plataforma fuera del core DOM. | Media |
| Blob/File/FormData, almacenamiento y demás APIs de plataforma | Delegada | README documenta reutilización de jsdom/Node y adaptadores JS. La integración funcional no equivale a migración a Rust. | Alta |

Jest y Vitest ya ejercen una versión híbrida funcional: sus adapters están en
`src/environments/`, con pruebas de runners y 18 controles de paquete por cada
runtime Node22/24. Es una dimensión distinta de la migración del motor.

Los 148 tests Rust, 495 contratos Node, 1.784 casos HTML5 comparables y el corpus
WPT ejecutable aprobados son evidencia del alcance probado. No se usan como
denominador del porcentaje: quedan exclusiones, fallos de estándar compartidos
y el bootstrap de Range-deleteContents bloqueado. Tampoco los checkpoints ni
los recuentos de archivos sirven como medida del trabajo total.
