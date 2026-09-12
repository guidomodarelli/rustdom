# Fases de rustdom

Objetivo activo: migrar el 100% de la implementación a Rust y verificar el 100% de compatibilidad con jsdom. JavaScript queda limitado a los enlaces necesarios con Node/V8 y los runners; mantener implementaciones de DOM en jsdom o rutas de parsing en parse5 no satisface el objetivo. Los hitos siguientes de la primera versión híbrida son históricos, no una declaración de migración completa.

## Migración integral abierta

Avance actual: CharacterData tiene estado canónico y operaciones de texto nativas. Attr, sus colecciones ordenadas, índices y ownership se ejecutan en Rust. La igualdad, contención y posición documental de Node también se calculan en Rust, junto con el almacenamiento de identificadores de DocumentType y targets de ProcessingInstruction. Los wrappers, la construcción de objetos y la entrega de reacciones aún conectan con lógica JS; también quedan otras operaciones de Node/Document/Element, eventos, rangos y el resto de las familias de API. La cobertura WPT versionada amplía la evidencia, sin cerrar por sí sola ningún bloque pendiente.

- Estado y algoritmos de datos de nodos: CharacterData, atributos, colecciones, consultas de namespaces y lectura de nodeValue/textContent ya tienen operaciones nativas; quedan setters de Node y reflexión WebIDL, entre otras responsabilidades.
- Operaciones completas de Node/Document/Element, rangos, iteradores, selección, observadores y eventos.
- La planificación de normalize usa Rust; quedan su driver de mutaciones y los ajustes de rangos.
- La comparación de puntos de Range usa el árbol Rust; quedan estado, conversiones WebIDL y otras operaciones de Range.
- comparePoint, isPointInRange e intersectsNode toman sus decisiones en Rust; quedan el estado, la entrega de referencias vivas y otras operaciones de Range.
- El stringifier de Range reúne el texto seleccionado en Rust; se conservan las particularidades de CDATA y UTF-16 del jsdom de referencia.
- Los ocho setters/selecciones y commonAncestorContainer deciden en Rust; las referencias vivas y ajustes durante otras mutaciones todavía conservan responsabilidades JS.
- Los extremos numéricos de Range/StaticRange y collapsed son canónicos en Rust. JS mantiene ownership visible a V8 y snapshots para consumidores existentes; quedan los algoritmos de ajuste por mutaciones, Selection y otros métodos.
- La comparación pública de Range, los planes de collapse y la copia de su estado se ejecutan en Rust; quedan operaciones de contenidos y ajustes de rangos por otras mutaciones.
- deleteContents planifica nodos, texto parcial y colapso en Rust; el driver preserva las mutaciones y hooks actuales. Su WPT de iframes está bloqueado por la clonación de CDATA adoptada en HTML del jsdom fijado; el bloqueo y la evidencia permanecen explícitos y no cierran compatibilidad completa.
- cloneContents/extractContents seleccionan ancestro, hijos parciales y contenidos en Rust, junto con el colapso de extracción; quedan creación de nodos/clones, recursión y entrega de mutaciones de sus drivers.
- surroundContents valida nodos parciales y tipo de contenedor en Rust recorriendo ancestros; el driver de extracción/inserción y sus errores tardíos siguen usando los hooks actuales.
- Optimizar lecturas y creación/clonado de Range: el benchmark de estado nativo del 12/09 muestra aproximadamente 4× de costo frente a jsdom en esos patrones, aunque otras consultas son más rápidas.
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
