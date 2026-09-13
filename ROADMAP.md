# Fases de rustdom

Objetivo activo: migrar el 100% de la implementación a Rust y verificar el 100% de compatibilidad con jsdom. JavaScript queda limitado a los enlaces necesarios con Node/V8 y los runners; mantener implementaciones de DOM en jsdom o rutas de parsing en parse5 no satisface el objetivo. Los hitos siguientes de la primera versión híbrida son históricos, no una declaración de migración completa.

## Migración integral abierta

Avance actual: CharacterData tiene estado canónico y operaciones de texto nativas. Attr, sus colecciones ordenadas, índices y ownership se ejecutan en Rust. La igualdad, contención y posición documental de Node también se calculan en Rust, junto con el almacenamiento de identificadores de DocumentType y targets de ProcessingInstruction. Los wrappers, la construcción de objetos y la entrega de reacciones aún conectan con lógica JS; también quedan otras operaciones de Node/Document/Element, eventos, rangos y el resto de las familias de API. La cobertura WPT versionada amplía la evidencia, sin cerrar por sí sola ningún bloque pendiente.

- Estado y algoritmos de datos de nodos: CharacterData, atributos, colecciones, consultas de namespaces y lectura de nodeValue/textContent ya tienen operaciones nativas. Los setters de texto deciden en Rust el efecto por tipo; quedan sus factories y drivers de mutación, reflexión WebIDL y otras responsabilidades.
- Operaciones completas de Node/Document/Element, rangos, iteradores, selección, observadores y eventos.
- Las restricciones de inserción posteriores a los controles de contenedor/ciclos consultan Rust: referencia, tipos y estructura de Document. Esos controles previos, adopción y entrega de mutaciones conservan sus drivers pendientes de migración.
- Las restricciones de replaceChild reutilizan el módulo nativo común y preservan sus reglas distintas de Document y exclusión del hijo reemplazado. El driver de adopción, remoción, inserción y observadores continúa pendiente.
- Los helpers genéricos de raíz, longitud, ascendencia y orden de árbol usan Rust. Se mantienen separados los enlaces padre/hijo, Attr owners y hosts; las raíces compuestas, ascendencias shadow/host, retargeting y búsqueda de slots ya recorren el registro nativo. Quedan entrega de eventos, backlinks de asignación y algoritmos generales de mutación/creación.
- Los nombres de nodos asignables a slots son canónicos en Rust, con almacenamiento solo para valores no vacíos, compactación y liberación observables. La selección verifica el primer slot por nombre y filtra los hijos del host; el aplanado usa una pila nativa con detección de ciclos y conserva la diferencia entre CDATA asignado/fallback. La caché ordenada y la decisión de señalar cambios también usan Rust, con plan separado del commit para respetar el orden de efectos. Quedan los backlinks `_assignedSlot` y la entrega de señales en sus drivers; las referencias JS del snapshot conservan únicamente ownership visible a V8.
- La planificación de normalize y sus ajustes de rangos usan Rust; queda la entrega de mutaciones y hooks.
- La comparación de puntos de Range usa el árbol Rust; las conversiones WebIDL y otras operaciones de la plataforma siguen pendientes.
- comparePoint, isPointInRange e intersectsNode toman sus decisiones en Rust; el puente entrega las referencias vivas.
- El stringifier de Range reúne el texto seleccionado en Rust; se conservan las particularidades de CDATA y UTF-16 del jsdom de referencia.
- Los ocho setters/selecciones y commonAncestorContainer deciden en Rust; el puente conserva las referencias visibles a V8.
- Los extremos numéricos de Range/StaticRange y collapsed son canónicos en Rust. JS mantiene ownership visible a V8 y snapshots; Selection y validaciones WebIDL generales siguen pendientes.
- La comparación pública de Range, los planes de collapse y la copia de su estado se ejecutan en Rust.
- deleteContents planifica nodos, texto parcial y colapso en Rust; el driver preserva las mutaciones y hooks actuales. Su WPT de iframes está bloqueado por la clonación de CDATA adoptada en HTML del jsdom fijado; el bloqueo y la evidencia permanecen explícitos y no cierran compatibilidad completa.
- cloneContents/extractContents seleccionan ancestro, hijos parciales y contenidos en Rust, junto con el colapso de extracción; sus pilas de control nativas se detallan abajo.
- surroundContents valida nodos parciales y tipo de contenedor en Rust recorriendo ancestros; el driver de extracción/inserción y sus errores tardíos siguen usando los hooks actuales.
- insertNode elige padre/referencia y calcula el offset en Rust en las etapas originales; quedan validación general de jerarquía y entrega de mutaciones/splits.
- Los ajustes de extremos por CharacterData, splitText, inserción, eliminación y normalize se calculan y aplican en Rust. JS conserva enumeración de rangos débiles y entrega de cambios de identidad; quedan los drivers de operaciones y otros métodos de Range/Selection.
- createContextualFragment selecciona contexto y body sintético en Rust; la creación del body y el parser conservan sus drivers actuales, incluidas las rutas XML y scripts pendientes de migración integral.
- cloneContents controla selección, orden de efectos y subclonaciones mediante una pila Rust; JS conserva factories, copia concreta de nodos/cloningSteps y entrega de append/substring.
- extractContents comparte la pila Rust y controla las etapas de texto, movimientos y colapso; el puente conserva factories y efectos. Quedan la copia concreta de nodos, hooks de mutación y otros algoritmos DOM generales.
- Optimizar lecturas y creación/clonado de Range: el benchmark de estado nativo del 12/09 muestra aproximadamente 4× de costo frente a jsdom en esos patrones, aunque otras consultas son más rápidas.
- Optimizar el puente de lectura de caché de slots sin devolver la lógica a JS: el benchmark de caché del 13/09 mide 0,35× frente a jsdom (aproximadamente 2,8× de costo), con 100 lecturas por muestra. Las consultas frescas y reasignaciones densas conservan mejoras; no es una aceleración universal.
- Optimizar escrituras completas de Node: el benchmark de setters del 12/09 muestra 3,5–4× de costo para nodeValue y aproximadamente 1,9× para textContent frente a jsdom.
- Optimizar el reemplazo repetido del elemento raíz de Document: el benchmark del módulo compartido muestra ratios de 0,78×/0,89× frente a jsdom; el reemplazo de comentarios queda cerca de la paridad con mejoras pequeñas.
- Parsing HTML y XML sin rutas de ejecución delegadas; scripts, document.write, posiciones, custom elements, templates y shadow DOM.
- Todos los selectores, XPath, estilos/CSSOM y APIs HTML específicas de elementos.
- URL, cookies, recursos, red, blobs/archivos, almacenamiento y demás APIs públicas de jsdom.
- Compatibilidad completa: corpus upstream y WPT aplicables, errores, realms, módulos, instalación y runners; resultados faltantes, excluidos o no verificados impiden cerrar el objetivo.
- Cada PR requiere el ciclo `codex-autofix-loop`, validaciones, benchmarks pertinentes y revisión de memoria. Ningún milestone parcial marca el objetivo integral como terminado.

## Estado y criterios de cierre

| Fase | Estado | Criterio verificable |
|---|---|---|
| 0. Base integrada | Completa | `main` contiene los checkpoints iniciales; la rama anterior está eliminada; CI en Linux, Windows y macOS. |
| 1. Parser HTML5 y compatibilidad inicial | Completa | Parser real con html5ever, corpus diferencial, rutas de compatibilidad explícitas, React/Jest/Vitest y memoria con Document/Window. |
| 2. Entornos y APIs entre realms | Completa | Vitest con pools VM, conversiones Blob/FormData/Request/URL, señales AbortSignal, errores y teardown verificables. Evidencia en los informes de validación, memoria y benchmarks del 11/09. |
| 3. Estado estructural y mutaciones del árbol Rust | Completa | Identificadores estables, ownership, inserciones, movimientos, eliminación, recorridos y liberación integrados con los nodos reales. Regresiones de rendimiento registradas para la fase 5. |
| 4. Datos, consultas y serialización nativas | Completa | Datos UTF-16, atributos, selectores Servo, contexto y orden correctos, lectura actual después de mutaciones y rutas de compatibilidad documentadas. Validación y memoria aprobadas; benchmarks guardados, con regresiones de construcción para la fase 5. |
| 5. Rendimiento y endurecimiento | Completa | Puente directo para datos comunes, tape sin árbol JSON intermedio, 98 contratos JS, 14 tests Rust, corpus, estrés y Valgrind. Benchmarks finales guardados; quedan costos medidos en escrituras aisladas y parsing con scripts, descritos como límites de esta versión. |
| 6. Distribución reproducible | Completa | Archivos instalables con binarios, exports y tipos públicos; npm/pnpm fuera del checkout; Windows y Linux locales, Node 22.12/24 y macOS en CI. Integración final condicionada a todos los checks del PR. No se publica automáticamente en npm. |

Cada fase se trabaja mediante PR cuando la terminal permite crearlo y mergearlo, y termina con checks y un tag de checkpoint. Las fases no se marcan completas únicamente por haber agregado un arnés o una API nativa que los consumidores reales no usan.

## Evidencia inicial

- `checkpoint-001-native-parser` y `checkpoint-002-memory-guards` están integrados en `main`.
- Los 1.784 casos comparables del corpus no equivalen a conformidad completa con WPT; los casos excluidos y el oráculo están documentados junto a los fixtures.
- Los benchmarks iniciales muestran ganancias en parsing/construcción, y prácticamente ninguna en selectores o mutaciones todavía implementados en JavaScript.
- La ausencia de retención en un estrés finito no es una prueba absoluta de ausencia de toda fuga; se registran escenarios y límites.
