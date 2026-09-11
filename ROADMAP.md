# Fases de rustdom

Objetivo: trasladar el trabajo del DOM a Rust sin perder los contratos que esperan Jest, Vitest y los consumidores de jsdom. La superficie JavaScript y WebIDL puede reutilizar jsdom; el estado y las operaciones que se declaren nativas deben ejecutarse realmente en Rust y tener pruebas que lo comprueben.

## Estado y criterios de cierre

| Fase | Estado | Criterio verificable |
|---|---|---|
| 0. Base integrada | Completa | `main` contiene los checkpoints iniciales; la rama anterior está eliminada; CI en Linux, Windows y macOS. |
| 1. Parser HTML5 y compatibilidad inicial | Completa | Parser real con html5ever, corpus diferencial, rutas de compatibilidad explícitas, React/Jest/Vitest y memoria con Document/Window. |
| 2. Entornos y APIs entre realms | Completa | Vitest con pools VM, conversiones Blob/FormData/Request/URL, señales AbortSignal, errores y teardown verificables. Evidencia en los informes de validación, memoria y benchmarks del 11/09. |
| 3. Estado estructural y mutaciones del árbol Rust | Completa | Identificadores estables, ownership, inserciones, movimientos, eliminación, recorridos y liberación integrados con los nodos reales. Regresiones de rendimiento registradas para la fase 5. |
| 4. Datos, consultas y serialización nativas | Completa | Datos UTF-16, atributos, selectores Servo, contexto y orden correctos, lectura actual después de mutaciones y rutas de compatibilidad documentadas. Validación y memoria aprobadas; benchmarks guardados, con regresiones de construcción para la fase 5. |
| 5. Rendimiento y endurecimiento | Completa | Puente directo para datos comunes, tape sin árbol JSON intermedio, 98 contratos JS, 14 tests Rust, corpus, estrés y Valgrind. Benchmarks finales guardados; quedan costos medidos en escrituras aisladas y parsing con scripts, descritos como límites de esta versión. |
| 6. Distribución reproducible | En curso | Paquetes instalables desde artefactos, tipos públicos, binarios por plataforma y pruebas del paquete fuera del checkout. No requiere publicación pública en npm. |

Cada fase se trabaja mediante PR cuando la terminal permite crearlo y mergearlo, y termina con checks y un tag de checkpoint. Las fases no se marcan completas únicamente por haber agregado un arnés o una API nativa que los consumidores reales no usan.

## Evidencia inicial

- `checkpoint-001-native-parser` y `checkpoint-002-memory-guards` están integrados en `main`.
- Los 1.784 casos comparables del corpus no equivalen a conformidad completa con WPT; los casos excluidos y el oráculo están documentados junto a los fixtures.
- Los benchmarks iniciales muestran ganancias en parsing/construcción, y prácticamente ninguna en selectores o mutaciones todavía implementados en JavaScript.
- La ausencia de retención en un estrés finito no es una prueba absoluta de ausencia de toda fuga; se registran escenarios y límites.
