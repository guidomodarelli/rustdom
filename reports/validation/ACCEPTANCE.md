# Verificación del alcance de rustdom

Alcance: primera distribución experimental de las fases descritas en `ROADMAP.md`. Se verifica comportamiento público conectado al runtime real; los contadores nativos complementan las comprobaciones de resultados.

| Criterio | Evidencia | Estado |
|---|---|---|
| Parsing HTML5 mediante una biblioteca Rust mantenida | html5ever; 1.784 casos comparados contra jsdom 27.4.0, sin diferencias en los casos incluidos | Verificado |
| Estructura, datos y operaciones realmente nativas | Mutaciones, identificadores estables, UTF-16, selectores Servo y serialización ejercitados por la API JSDOM | Verificado |
| Compatibilidad de APIs y objetos | 98 tests de contrato, incluyendo movimientos, clones, rangos, namespaces, selectores, errores y 240 mutaciones consecutivas | Verificado en los casos documentados |
| Jest y Vitest utilizables desde el paquete | Instalaciones npm y pnpm fuera del checkout; 7 tests Jest, 11 Vitest y 4 en pools VM por instalación | Verificado en Linux, Windows y macOS |
| Exports y tipos públicos | Consumidores CommonJS y ESM compilados con TypeScript, `skipLibCheck: false`, y luego ejecutados contra el addon | Verificado |
| Archivos auxiliares distribuidos | Estilos por defecto y XHR síncrono contra un servidor real en otro proceso | Verificado con npm y pnpm |
| Memoria y recursos | Estrés con WeakRef para documentos y ventanas, conteos nativos, límites de caches y Valgrind sobre 14 tests Rust | Verificado dentro del alcance del informe de memoria |
| Rendimiento medido y resultados conservados | Benchmarks equivalentes, hashes de documentos, muestras crudas y resultados favorables y desfavorables | Verificado; no implica aceleración universal |
| Instalación multiplataforma y Node 22.12 | Paquetes Windows/Linux/macOS, consumo de Node-API en Node 22.12 y 24 | Verificado mediante instalaciones locales y CI |
| Reglas y checkpoints persistentes | AGENTS.md, PRs integrados a main, limpieza de ramas y tags incrementales | Aplicado; cada checkpoint requiere CI aprobado |

La distribución mantiene wrappers WebIDL, eventos y Web APIs de jsdom. Las rutas que necesitan su comportamiento original siguen explícitas. No se afirma que sea un DOM íntegramente en Rust, conformidad completa con WPT, compatibilidad con toda versión futura de jsdom ni ausencia absoluta de fugas.

Referencias: [validación completa](latest.json), [instalaciones externas](../distribution/2026-09-11T20-32-34.688Z-linux-x64.json), [memoria](../memory/REVIEW.md) y [benchmark final de distribución](../benchmarks/2026-09-11T20-44-58.920Z-linux-x64.md).

La comprobación adicional de [Node 22.12](../distribution/2026-09-11T20-55-47.858Z-linux-x64.json) y la de [Windows local](../distribution/2026-09-11T21-05-10.785Z-win32-x64.json) aprobaron 16 gates cada una. macOS y Linux también aprobaron sus jobs en la [ejecución de CI](https://github.com/guidomodarelli/rustdom/actions/runs/34646541328).

El primer consumidor Windows de CI falló al importar tests desde un alias 8.3 de TEMP; el informe se conserva. El arnés ahora resuelve el path real antes de crear el consumidor, evitando mezclar el alias con los paths canónicos de Vite. La corrección se comprobó con el archivo Windows de CI en una instalación Windows local. El merge y el tag final requieren que todos los checks aprueben el commit actualizado del PR.
