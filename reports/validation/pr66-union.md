# Unión validada de FileReader con los cambios integrados del PR 65

El 15 de septiembre de 2026 se integró el head de PR66 `1c28acd03165d7879c8f48b0982993d8c8ba36ae` con `00b8bd06fa1c6b23780d8565370dc74eb3806622`. Este último quedó mergeado en main como `b40532e1e25adc08cceb192b31d191837ead2b2d`, con árbol idéntico y checkpoint `checkpoint-053-blob-file`.

## Integración y alcance

El código se integró sin conflictos. Los siete conflictos de reportes genéricos se resolvieron conservando los bytes de ambos padres en `pr66-union/parents/`; después se regeneraron los resultados de la unión. `pr66-union/context.json` identifica esos padres y archivos. Se incorporan las correcciones de identidad de slots, npm de CI y trazabilidad de fuentes del benchmark ya revisadas en PR65; los algoritmos propios de FileReader conservan su implementación.

No se modificó el runtime después del build validado. El archivo de paquete usado en ambas versiones de Node tiene SHA-256 `28038a0c01d3282afd673a82de06ddcf4bc02a8da4bb27591382d142c207d33a`; el addon tiene SHA-256 `10daf4eb00763387d8685e9771a888e82ec60bcef1f23740a6d35ecae5b66afc`.

## Validación ejecutada

| Comprobación | Resultado |
|---|---|
| `npm ci` | 475 paquetes; lockfile sin modificaciones |
| `npm run validate` | 7/7 gates aprobados |
| Rust | formato, Clippy y 244 tests aprobados |
| Node | 1803/1803 tests aprobados |
| Jest | 15/15 aprobados |
| Vitest | 26/26 aprobados |
| vmForks/vmThreads | 26/26 aprobados |
| Corpus HTML | 1784/1784 comparables; ocho casos script-on excluidos |
| WPT | 164/164 fixtures en paridad; 48733 resultados comparables |
| Paquete instalado, Node 24.14.1 | 18/18 gates mediante npm y pnpm |
| Paquete instalado, Node 22.12.0 con npm 11.19.0 | 18/18 gates mediante npm y pnpm |

Los WPT incluyen 47538 resultados aprobados de estándares y 1195 fallos compartidos. El reporte mantiene `complete: false`: jsdom 27.4.0 bloquea el bootstrap CDATA del fixture range-deletion. La paridad con esa referencia y este corpus no certifica compatibilidad universal.

Logs y resumen: `pr66-union/full.log`, `validation.json`, `package.log`, `package-node24.log` y `package-node22.log`. Los resultados completos del paquete están en `../distribution/2026-09-15T16-46-33.436Z-linux-x64.json` y `../distribution/2026-09-15T16-49-24.947Z-linux-x64.json`, incluidos los lockfiles de los consumidores.

## Resultados conservados y límites

Los 44934642 bytes del WPT original se conservan sin pérdida en `../compatibility/2026-09-15T16-42-09.812Z-linux-wpt.json.gz`. `pr66-union/wpt-summary.json` registra hashes SHA-256, revisión WPT y verificación byte a byte tras descompresión; no se descartaron diagnósticos repetidos.

La suite incluye los contratos y escenarios de GC existentes para FileReader, callbacks, resultados, documentos, ventanas y estados nativos. Los resultados de memoria nuevos quedan en `../memory/`. La validación de esta unión no añadió un nuevo análisis local de Memcheck; el CI del SHA publicado debe completar ese gate antes del merge. Las pruebas finitas no demuestran ausencia absoluta de fugas.

La implementación específica de FileReader no cambió al integrar estos padres. Se conservan sus mediciones previas y regresiones en `file-reader-performance.md` y `../benchmarks/`; no se atribuyen esas mediciones a esta nueva unión ni se afirma una mejora de rendimiento adicional. Los benchmarks del SHA publicado forman parte de CI.
