# Verificación del alcance de rustdom

Alcance: primera distribución experimental de las fases descritas en `ROADMAP.md`. Se verifica comportamiento público conectado al runtime real; los contadores nativos complementan las comprobaciones de resultados.

| Criterio | Evidencia | Estado |
|---|---|---|
| Parsing HTML5 mediante una biblioteca Rust mantenida | html5ever; 1.784 casos comparados contra jsdom 27.4.0, sin diferencias en los casos incluidos | Verificado |
| Estructura, datos y operaciones realmente nativas | Mutaciones, identificadores estables, UTF-16, selectores Servo y serialización ejercitados por la API JSDOM | Verificado |
| Compatibilidad de APIs y objetos | 98 tests de contrato, incluyendo movimientos, clones, rangos, namespaces, selectores, errores y 240 mutaciones consecutivas | Verificado en los casos documentados |
| Jest y Vitest utilizables desde el paquete | Instalaciones npm y pnpm fuera del checkout; 7 tests Jest, 11 Vitest y 4 en pools VM por instalación | Verificado en Linux/Node 24 |
| Exports y tipos públicos | Consumidores CommonJS y ESM compilados con TypeScript, `skipLibCheck: false`, y luego ejecutados contra el addon | Verificado |
| Archivos auxiliares distribuidos | Estilos por defecto y XHR síncrono contra un servidor real en otro proceso | Verificado con npm y pnpm |
| Memoria y recursos | Estrés con WeakRef para documentos y ventanas, conteos nativos, límites de caches y Valgrind sobre 14 tests Rust | Verificado dentro del alcance del informe de memoria |
| Rendimiento medido y resultados conservados | Benchmarks equivalentes, hashes de documentos, muestras crudas y resultados favorables y desfavorables | Verificado; no implica aceleración universal |
| Instalación multiplataforma y Node 22.12 | Workflow con artefactos Windows/Linux/macOS y consumo del paquete en Node 22.12 | Pendiente de los checks de este PR |
| Reglas y checkpoints persistentes | AGENTS.md, PRs integrados a main, limpieza de ramas y tags incrementales | Aplicado; checkpoint de distribución al terminar CI |

La distribución mantiene wrappers WebIDL, eventos y Web APIs de jsdom. Las rutas que necesitan su comportamiento original siguen explícitas. No se afirma que sea un DOM íntegramente en Rust, conformidad completa con WPT, compatibilidad con toda versión futura de jsdom ni ausencia absoluta de fugas.

Referencias: [validación completa](latest.json), [instalaciones externas](../distribution/2026-09-11T20-32-34.688Z-linux-x64.json), [memoria](../memory/REVIEW.md) y [benchmark final de distribución](../benchmarks/2026-09-11T20-44-58.920Z-linux-x64.md).
